/**
 * photoGallery.js
 * @fileoverview Photo gallery component with lightbox functionality
 * @description Handles photo grid display and image expansion
 */

import { isMobile } from './common.js';
import { createGlassSurface } from './glassSurface.js';

class PhotoGallery {
    constructor() {
        this.container = null;
        this.lightbox = null;
        this.photos = [];
        this.currentPhotoIndex = -1;
        this.isVisible = false;
        this.lightboxControls = {}; // Store glass surface controls
        this.currentColumnCount = 0; // Track current column count for resize handling
        this.photosGenerated = false; // Track if photos have been generated
        
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
            console.warn('Photo gallery container not found');
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
        this.container.innerHTML = `
            <div class="photo-gallery">
                <div class="photo-grid"></div>
            </div>
        `;

        // Create lightbox directly in body so it's fixed to viewport
        const lightboxHTML = `
            <div class="photo-lightbox">
                <div class="lightbox-control lightbox-close-wrapper"></div>
                <div class="lightbox-control lightbox-prev-wrapper"></div>
                <div class="lightbox-control lightbox-next-wrapper"></div>
                <div class="lightbox-content">
                    <img src="" alt="" class="lightbox-image">
                </div>
            </div>
        `;

        // Check if lightbox already exists (in case of re-initialization)
        this.lightbox = document.querySelector('.photo-lightbox');
        if (!this.lightbox) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = lightboxHTML;
            this.lightbox = tempDiv.firstElementChild;
            document.body.appendChild(this.lightbox);
        }

        // Harden lightbox image against saving interactions
        const lightboxImg = this.lightbox.querySelector('.lightbox-image');
        if (lightboxImg) {
            lightboxImg.setAttribute('draggable', 'false');
            lightboxImg.addEventListener('dragstart', (e) => e.preventDefault());
            lightboxImg.addEventListener('contextmenu', (e) => e.preventDefault());
        }
        
        // Create glass surface controls
        this.createLightboxControls();
    }

    //==============================================================================================
    /**
     * Create glass surface lightbox controls
     */
    createLightboxControls() {
        // Close button
        const closeWrapper = this.lightbox?.querySelector('.lightbox-close-wrapper');
        const closeGlass = createGlassSurface({
            width: 'auto',
            height: '48px',
            borderRadius: 24,
            borderWidth: 0.07,
            brightness: 50,
            opacity: 0.93,
            blur: 50,
            displace: 0,
            backgroundOpacity: 0.12,
            saturation: 1.2,
            distortionScale: -15,
            redOffset: 8,
            greenOffset: 8,
            blueOffset: 8,
            xChannel: 'R',
            yChannel: 'G',
            mixBlendMode: 'difference',
            className: 'lightbox-button-glass',
            style: {
                cursor: 'pointer'
            }
        });
        closeGlass.contentElement.innerHTML = `
            <button class="lightbox-button lightbox-close" aria-label="Close lightbox">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>Close</span>
            </button>
        `;
        if (closeWrapper) {
            closeWrapper.appendChild(closeGlass.element);
        }
        this.lightboxControls.close = closeGlass;

        // Previous button
        const prevWrapper = this.lightbox?.querySelector('.lightbox-prev-wrapper');
        const prevGlass = createGlassSurface({
            width: 'auto',
            height: '48px',
            borderRadius: 24,
            borderWidth: 0.07,
            brightness: 50,
            opacity: 0.93,
            blur: 50,
            displace: 0,
            backgroundOpacity: 0.12,
            saturation: 1.2,
            distortionScale: -15,
            redOffset: 8,
            greenOffset: 8,
            blueOffset: 8,
            xChannel: 'R',
            yChannel: 'G',
            mixBlendMode: 'difference',
            className: 'lightbox-button-glass',
            style: {
                cursor: 'pointer'
            }
        });
        prevGlass.contentElement.innerHTML = `
            <button class="lightbox-button lightbox-prev" aria-label="Previous photo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span>Prev</span>
            </button>
        `;
        if (prevWrapper) {
            prevWrapper.appendChild(prevGlass.element);
        }
        this.lightboxControls.prev = prevGlass;

        // Next button
        const nextWrapper = this.lightbox?.querySelector('.lightbox-next-wrapper');
        const nextGlass = createGlassSurface({
            width: 'auto',
            height: '48px',
            borderRadius: 24,
            borderWidth: 0.07,
            brightness: 50,
            opacity: 0.93,
            blur: 50,
            displace: 0,
            backgroundOpacity: 0.12,
            saturation: 1.2,
            distortionScale: -15,
            redOffset: 8,
            greenOffset: 8,
            blueOffset: 8,
            xChannel: 'R',
            yChannel: 'G',
            mixBlendMode: 'difference',
            className: 'lightbox-button-glass',
            style: {
                cursor: 'pointer'
            }
        });
        nextGlass.contentElement.innerHTML = `
            <button class="lightbox-button lightbox-next" aria-label="Next photo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span>Next</span>
            </button>
        `;
        if (nextWrapper) {
            nextWrapper.appendChild(nextGlass.element);
        }
        this.lightboxControls.next = nextGlass;
    }

    //==============================================================================================
    /**
     * Measure an image's natural width/height before rendering
     * @param {string} url
     * @param {number} timeoutMs
     * @returns {Promise<{width:number,height:number}>}
     */
    measureImage(url, timeoutMs = 8000) {
        return new Promise((resolve) => {
            const fallback = { width: 800, height: 1200 };
            let settled = false;

            const done = (w, h) => {
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
        const grid = this.container.querySelector('.photo-grid');
        if (!grid) return;

        try {
            const response = await fetch('/assets/images/reel/manifest.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`Failed to load manifest: ${response.status}`);
            const manifest = await response.json();
            const images = Array.isArray(manifest.images) ? manifest.images : [];

            // Pre-measure images to obtain accurate aspect ratios for balanced layout
            const measured = await Promise.allSettled(
                images.map((url) => this.measureImage(url))
            );

            this.photos = images.map((url, index) => {
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
        const grid = this.container.querySelector('.photo-grid');
        if (!grid) return;

        // Clear existing content
        grid.innerHTML = '';

        // Determine number of columns based on viewport
        const columnCount = this.getColumnCount();
        this.currentColumnCount = columnCount;

        // Create columns
        const columns = [];
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

        this.photos.forEach((photo) => {
            // Create photo item with skeleton
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item photo-item--loading';
            photoItem.style.aspectRatio = `${photo.width} / ${photo.height}`;
            photoItem.dataset.index = photo.index;

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

            photoItem.appendChild(skeleton);
            photoItem.appendChild(img);

            // Find the current shortest column using predicted heights
            let targetIndex = 0;
            let minPredicted = predictedHeights[0] ?? 0;
            for (let i = 1; i < predictedHeights.length; i++) {
                if (predictedHeights[i] < minPredicted) {
                    minPredicted = predictedHeights[i];
                    targetIndex = i;
                }
            }
            const targetColumn = columns[targetIndex];
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
        const grid = this.container.querySelector('.photo-grid');
        if (!grid) return;

        // Click on photo to open lightbox
        grid.addEventListener('click', (e) => {
            const photoItem = e.target.closest('.photo-item');
            if (photoItem) {
                const index = parseInt(photoItem.dataset.index);
                this.openLightbox(index);
            }
        });

        // Block context menu and drag on images within gallery container (desktop)
        this.container.addEventListener('contextmenu', (e) => {
            const target = e.target;
            if (target && target.tagName === 'IMG') {
                const imgEl = target;
                if (imgEl.classList.contains('lightbox-image') || imgEl.closest('.photo-item')) {
                    e.preventDefault();
                }
            }
        }, { capture: true });

        this.container.addEventListener('dragstart', (e) => {
            const target = e.target;
            if (target && target.tagName === 'IMG') {
                e.preventDefault();
            }
        }, { capture: true });

        // Lightbox controls
        const closeBtn = this.lightbox?.querySelector('.lightbox-close');
        const prevBtn = this.lightbox?.querySelector('.lightbox-prev');
        const nextBtn = this.lightbox?.querySelector('.lightbox-next');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeLightbox());
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.showPreviousPhoto());
            // Prevent double-tap zoom on mobile for prev button only
            this.addDoubleTapGuard(prevBtn, () => this.showPreviousPhoto());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.showNextPhoto());
            // Prevent double-tap zoom on mobile for next button only
            this.addDoubleTapGuard(nextBtn, () => this.showNextPhoto());
        }

        // Close lightbox when clicking outside image
        if (this.lightbox) {
            this.lightbox.addEventListener('click', (e) => {
                if (e.target === this.lightbox || e.target.classList.contains('lightbox-content')) {
                    this.closeLightbox();
                }
            });
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.lightbox.classList.contains('active')) return;

            if (e.key === 'Escape') {
                this.closeLightbox();
            } else if (e.key === 'ArrowLeft') {
                this.showPreviousPhoto();
            } else if (e.key === 'ArrowRight') {
                this.showNextPhoto();
            }
        });

        // Touch swipe for mobile
        this.setupTouchSwipe();

        // Handle window resize for responsive column layout
        window.addEventListener('resize', () => this.handleResize());
    }

    //==============================================================================================
    /**
     * Add a targeted double-tap guard to a specific element
     * - Blocks UA double-tap zoom without affecting the rest of the page
     * - Synthesizes a click on second tap to keep fast navigation responsive
     * @param {Element} element
     * @param {Function} onDoubleTap - Optional action to invoke on double tap
     */
    addDoubleTapGuard(element, onDoubleTap) {
        if (!element) return;
        let lastTap = 0;
        const DOUBLE_TAP_MS = 300;

        element.addEventListener('touchend', (e) => {
            const now = Date.now();
            const delta = now - lastTap;
            if (delta > 0 && delta <= DOUBLE_TAP_MS) {
                e.preventDefault();
                // Prefer explicit handler if provided; otherwise synthesize click
                if (typeof onDoubleTap === 'function') {
                    onDoubleTap();
                } else {
                    element.click();
                }
            }
            lastTap = now;
        }, { passive: false });
    }

    //==============================================================================================
    /**
     * Setup touch swipe for mobile navigation
     */
    setupTouchSwipe() {
        if (!this.lightbox) return;

        let touchStartX = 0;
        let touchEndX = 0;

        this.lightbox.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        this.lightbox.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        });

        const handleSwipe = () => {
            const swipeThreshold = 50;
            const diff = touchStartX - touchEndX;

            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    // Swipe left - next photo
                    this.showNextPhoto();
                } else {
                    // Swipe right - previous photo
                    this.showPreviousPhoto();
                }
            }
        };

        this.handleSwipe = handleSwipe;
    }

    //==============================================================================================
    /**
     * Open lightbox with specific photo
     * @param {number} index - Photo index
     */
    openLightbox(index) {
        if (!this.lightbox || index < 0 || index >= this.photos.length) return;

        this.currentPhotoIndex = index;
        const photo = this.photos[index];

        // Set image
        const img = this.lightbox.querySelector('.lightbox-image');
        if (img) {
            img.src = photo.url;
            img.alt = `Photo ${index + 1}`;
        }

        // Show lightbox
        this.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    //==============================================================================================
    /**
     * Close lightbox
     */
    closeLightbox() {
        if (!this.lightbox) return;

        this.lightbox.classList.remove('active');
        document.body.style.overflow = '';
        this.currentPhotoIndex = -1;
    }

    //==============================================================================================
    /**
     * Show previous photo in lightbox
     */
    showPreviousPhoto() {
        if (this.currentPhotoIndex > 0) {
            this.openLightbox(this.currentPhotoIndex - 1);
        } else {
            // Wrap around to last photo
            this.openLightbox(this.photos.length - 1);
        }
    }

    //==============================================================================================
    /**
     * Show next photo in lightbox
     */
    showNextPhoto() {
        if (this.currentPhotoIndex < this.photos.length - 1) {
            this.openLightbox(this.currentPhotoIndex + 1);
        } else {
            // Wrap around to first photo
            this.openLightbox(0);
        }
    }

    //==============================================================================================
    /**
     * Show the photo gallery
     */
    show() {
        if (!this.container) {
            console.warn('Photo gallery container not found for show()');
            return;
        }
                
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
        if (!this.container) {
            console.warn('Photo gallery container not found for hide()');
            return;
        }
        
        this.container.classList.remove('visible');
        this.isVisible = false;
        
        // Disable scrolling
        document.body.style.overflow = 'hidden';
        
        // Close lightbox if open
        this.closeLightbox();
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
