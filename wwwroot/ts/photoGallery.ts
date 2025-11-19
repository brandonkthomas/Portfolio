/**
 * photoGallery.js
 * @fileoverview Photo gallery component with lightbox functionality
 * @description Handles photo grid display and image expansion
 */

import PhotoLightbox from './photoLightbox';

type PhotoItem = { url: string; width: number; height: number; aspectRatio: number; index: number };
type LightboxController = { init(): void; destroy(): void };

//==============================================================================================
/**
 * PhotoGallery class
 * @description Handles photo grid display and image expansion
 */
class PhotoGallery {

    //==============================================================================================
    // Private properties
    //==============================================================================================
    private container: HTMLElement | null;
    private photos: PhotoItem[];
    private isVisible: boolean;
    private currentColumnCount: number;
    private photosGenerated: boolean;
    private lightboxInstance: LightboxController | null;

    //==============================================================================================
    // Constructor
    //==============================================================================================
    constructor() {
        this.container = null;
        this.photos = [];
        this.isVisible = false;
        this.currentColumnCount = 0; // Track current column count for resize handling
        this.photosGenerated = false; // Track if photos have been generated
        this.lightboxInstance = null;
        
        this.init();
    }

    //==============================================================================================
    /**
     * Initialize photo gallery
     */
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    //==============================================================================================
    /**
     * Setup the photo gallery
     */
    setup() {
        this.container = document.querySelector('.photo-gallery-container');
        if (!this.container) {
            const path = (window.location.pathname || '').toLowerCase();
            if (path === '/photos' || path === '/photos/') {
                console.warn('Photo gallery container not found');
            }
            return;
        }

        // Create gallery HTML structure
        this.createGalleryHTML();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Note: Photo generation is deferred until gallery is first shown
        // This prevents blocking initial page load
    }

    //==============================================================================================
    /**
     * Create gallery HTML structure
     */
    createGalleryHTML() {
        // Create gallery grid structure inside container
        this.container!.innerHTML = `
            <div class="photo-gallery">
                <div class="photo-grid"></div>
            </div>
        `;
    }


    //==============================================================================================
    /**
     * Measure an image's natural width/height before rendering
     * @param {string} url
     * @param {number} timeoutMs
     * @returns {Promise<{width:number,height:number}>}
     */
    measureImage(url: string, timeoutMs: number = 8000) {
        return new Promise<{ width: number; height: number }>((resolve) => {
            const fallback = { width: 800, height: 1200 };
            let settled = false;

            const done = (w?: number, h?: number) => {
                if (settled) return;
                settled = true;
                resolve({ width: Math.max(1, w || fallback.width), height: Math.max(1, h || fallback.height) });
            };

            const img = new Image();
            const timer = setTimeout(() => done(fallback.width, fallback.height), timeoutMs);

            img.onload = () => {
                clearTimeout(timer);
                done(img.naturalWidth, img.naturalHeight);
            };
            img.onerror = () => {
                clearTimeout(timer);
                done(fallback.width, fallback.height);
            };

            // Avoid blocking rendering; decode if supported
            try {
                img.decoding = 'async';
            } catch (_) { /* no-op */ }

            img.src = url;
        });
    }

    //==============================================================================================
    /**
     * Retrieve/read photos from manifest
     * This won't actually render yet - just reads manifest and calculates image data/mesaurements
     * @returns {Promise<void>}
     */
    async retrievePhotos() {
        const grid = this.container!.querySelector('.photo-grid');
        if (!grid) return;

        try {
            const response = await fetch('/assets/images/reel/manifest.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`Failed to load manifest: ${response.status}`);
            const manifest = await response.json();
            const images: string[] = Array.isArray(manifest.images) ? (manifest.images as string[]) : [];

            // Pre-measure images to obtain accurate aspect ratios for balanced layout
            const measured = await Promise.allSettled(
                images.map((url: string) => this.measureImage(url))
            );

            this.photos = images.map((url: string, index: number) => {
                const result = measured[index];
                const width = result?.status === 'fulfilled' ? result.value.width : 800;
                const height = result?.status === 'fulfilled' ? result.value.height : 1200;
                return {
                    url,
                    width,
                    height,
                    aspectRatio: width / height,
                    index
                };
            });
        } catch (err) {
            console.error('Error loading photo manifest', err);
            this.photos = [];
        }

        this.renderPhotoGrid();
    }

    //==============================================================================================
    /**
     * Render photo grid with column layout (round-robin distribution)
     */
    renderPhotoGrid() {
        const grid = this.container!.querySelector('.photo-grid') as HTMLElement | null;
        if (!grid) return;

        // Clear existing content
        grid.innerHTML = '';

        // Determine number of columns based on viewport
        const columnCount = this.getColumnCount();
        this.currentColumnCount = columnCount;

        // Create columns
        const columns: HTMLElement[] = [];
        for (let i = 0; i < columnCount; i++) {
            const column = document.createElement('div');
            column.className = 'photo-column';
            columns.push(column);
            grid.appendChild(column);
        }

        // Distribute photos across columns by predicted (and then actual) column height
        const getColumnGapPx = () => {
            const parentStyles = window.getComputedStyle(grid);

            // row-gap is defined on the column, but using the grid's column gap here is fine for estimate
            const columnStyles = columns[0] ? window.getComputedStyle(columns[0]) : null;
            const rowGap = columnStyles ? parseFloat(columnStyles.rowGap || '0') : 0;
            const paddingTop = columnStyles ? parseFloat(columnStyles.paddingTop || '0') : 0;
            const paddingBottom = columnStyles ? parseFloat(columnStyles.paddingBottom || '0') : 0;

            // Include vertical gaps and paddings in height estimate
            return { rowGap, paddingTop, paddingBottom };
        };

        const { rowGap, paddingTop, paddingBottom } = getColumnGapPx();

        // Track predicted heights to avoid bias from yet-to-load images
        const predictedHeights = columns.map(col => col.offsetHeight + paddingTop + paddingBottom);

        this.photos.forEach((photo: PhotoItem) => {
            // Create photo item with skeleton
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item photo-item--loading';
            photoItem.style.aspectRatio = `${photo.width} / ${photo.height}`;

            // Create skeleton loader
            const skeleton = document.createElement('div');
            skeleton.className = 'photo-skeleton';

            // Create image
            const img = document.createElement('img');
            img.src = photo.url;
            img.alt = `Photo ${photo.index + 1}`;
            img.loading = 'lazy';
            img.decoding = 'async'; // Ensure async decoding
            // Disable drag/save interactions on grid images
            img.setAttribute('draggable', 'false');
            img.addEventListener('dragstart', (e) => e.preventDefault());
            img.addEventListener('contextmenu', (e) => e.preventDefault());

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.dataset.pswpSrc = photo.url;
            trigger.dataset.pswpWidth = `${photo.width}`;
            trigger.dataset.pswpHeight = `${photo.height}`;
            trigger.dataset.pswpOrder = `${photo.index}`;
            trigger.className = 'photo-item-link';
            trigger.setAttribute('aria-label', `View photo ${photo.index + 1}`);
            trigger.addEventListener('contextmenu', (event) => event.preventDefault());

            // After load, update actual aspect ratio for better layout stability
            img.addEventListener('load', () => {
                photoItem.classList.remove('photo-item--loading');
                photoItem.classList.add('photo-item--loaded');
                if (img.naturalWidth && img.naturalHeight) {
                    photo.width = img.naturalWidth;
                    photo.height = img.naturalHeight;
                    photo.aspectRatio = img.naturalWidth / img.naturalHeight;
                    photoItem.style.aspectRatio = `${photo.width} / ${photo.height}`;
                }
            });

            // Handle image error
            img.addEventListener('error', () => {
                photoItem.classList.remove('photo-item--loading');
                photoItem.classList.add('photo-item--error');
            });

            trigger.appendChild(skeleton);
            trigger.appendChild(img);
            photoItem.appendChild(trigger);

            // Find the current shortest column using predicted heights
            let targetIndex = 0;
            let minPredicted = predictedHeights[0] ?? 0;
            for (let i = 1; i < predictedHeights.length; i++) {
                if (predictedHeights[i] < minPredicted) {
                    minPredicted = predictedHeights[i];
                    targetIndex = i;
                }
            }
            const targetColumn = columns[targetIndex]!;
            targetColumn.appendChild(photoItem);

            // Update prediction by adding this item's estimated rendered height
            // The item width equals the column content width
            const columnWidth = targetColumn.clientWidth; // excludes scrollbar
            const estimatedItemHeight = Math.round(columnWidth / (photo.width / photo.height));
            
            // Include the row gap only if not the very first item in that column (heuristic)
            const addGap = predictedHeights[targetIndex] > 0 ? rowGap : 0;
            predictedHeights[targetIndex] += estimatedItemHeight + addGap;

            // When image actually loads and aspect ratio updates, no need to reflow everything;
            // we rely on CSS aspect-ratio to minimize jumps
        });

        this.initPhotoLightbox();
    }

    //==============================================================================================
    /**
     * (Re)initialize PhotoLightbox after the grid renders
     */
    initPhotoLightbox() {
        const grid = this.container?.querySelector('.photo-grid');
        if (!grid) {
            return;
        }

        if (this.lightboxInstance) {
            this.lightboxInstance.destroy();
            this.lightboxInstance = null;
        }

        this.lightboxInstance = new PhotoLightbox({
            gallery: grid as HTMLElement,
            children: '[data-pswp-width]',
            loop: true,
            closeOnBackdrop: true,
            showCounter: false
        });

        this.lightboxInstance.init();
    }

    //==============================================================================================
    /**
     * Handle window resize
     */
    handleResize() {
        // Only re-render if column count changes
        const newColumnCount = this.getColumnCount();
        if (newColumnCount !== this.currentColumnCount) {
            this.renderPhotoGrid();
        }
    }

    //==============================================================================================
    /**
     * Get number of columns based on viewport width
     * @returns {number} Number of columns
     */
    getColumnCount() {
        const width = window.innerWidth;
        if (width >= 1200) return 4;
        if (width >= 768) return 3;
        return 2;
    }

    //==============================================================================================
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (!this.container) return;

        // Block context menu and drag on images within gallery container (desktop)
        this.container.addEventListener('contextmenu', (e: MouseEvent) => {
            const target = e.target as any;
            if (target && target.tagName === 'IMG') {
                const imgEl = target;
                if (imgEl.closest('.photo-item')) {
                    e.preventDefault();
                }
            }
        }, { capture: true });

        this.container.addEventListener('dragstart', (e: DragEvent) => {
            const target = e.target as any;
            if (target && target.tagName === 'IMG') {
                e.preventDefault();
            }
        }, { capture: true });

        // Handle window resize for responsive column layout
        window.addEventListener('resize', () => this.handleResize());
    }


    //==============================================================================================
    /**
     * Show the photo gallery
     */
    show() {
        if (!this.container) { return; }
                
        // Generate photos on first show (lazy initialization)
        if (!this.photosGenerated) {
            this.photosGenerated = true;
            
            // Load manifest and render
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => {
                    this.retrievePhotos();
                }, { timeout: 100 });
            } else {
                setTimeout(() => {
                    this.retrievePhotos();
                }, 0);
            }
        }
        
        this.container.classList.add('visible');
        this.isVisible = true;
        
        // Enable scrolling
        document.body.style.overflow = 'auto';
    }

    //==============================================================================================
    /**
     * Hide the photo gallery
     */
    hide() {
        if (!this.container) { return; }
        
        this.container.classList.remove('visible');
        this.isVisible = false;
        
        // Disable scrolling
        document.body.style.overflow = 'hidden';

        // Lightbox UI (photoLightbox) manages its own visibility; we're done here
    }

    //==============================================================================================
    /**
     * Check if gallery is visible
     * @returns {boolean}
     */
    isGalleryVisible() {
        return this.isVisible;
    }
}

// Initialize and export
const photoGallery = new PhotoGallery();

// Expose to window for state manager
window.photoGalleryInstance = photoGallery;

export default photoGallery;
