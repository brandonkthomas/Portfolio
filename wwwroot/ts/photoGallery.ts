/**
 * photoGallery.js
 * @fileoverview Photo gallery component with lightbox functionality
 * @description Handles photo grid display and image expansion
 */

import PhotoLightbox from './components/photoLightbox.js';
import { logEvent, LogData, LogLevel } from './common.js';

type PhotoItem = { url: string; width: number; height: number; aspectRatio: number; index: number };
type ManifestImageEntry = string | { url?: string; width?: number; height?: number };
type LightboxController = { init(): void; destroy(): void };
type PhotoLoadRequest = {
    generation: number;
    img: HTMLImageElement;
    photoItem: HTMLElement;
    photo: PhotoItem;
    url: string;
    approximateTop: number;
    columnIndex: number;
    photoIndex: number;
};

const DEFAULT_PHOTO_WIDTH = 1000;
const DEFAULT_PHOTO_HEIGHT = 1500;

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
    private listenersBound: boolean;
    private imageObserver: IntersectionObserver | null;
    private imageRequests: Map<HTMLImageElement, PhotoLoadRequest>;
    private imageLoadQueue: PhotoLoadRequest[];
    private queuedImages: WeakSet<HTMLImageElement>;
    private activeImageLoads: number;
    private imageLoadingEnabled: boolean;
    private imageLoadingTimer: number | null;
    private renderGeneration: number;

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
        this.listenersBound = false;
        this.imageObserver = null;
        this.imageRequests = new Map();
        this.imageLoadQueue = [];
        this.queuedImages = new WeakSet();
        this.activeImageLoads = 0;
        this.imageLoadingEnabled = false;
        this.imageLoadingTimer = null;
        this.renderGeneration = 0;
        
        this.init();
    }

    private log(event: string, data?: LogData, note?: string, level: LogLevel = 'info') {
        logEvent('photoGallery', event, data, note, level);
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
                this.log('Container Missing', { path }, 'Expected .photo-gallery-container', 'warn');
            }
            return;
        }

        this.log('Container Ready', { path: window.location.pathname || '/' });

        // Create gallery HTML structure
        this.createGalleryHTML();

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

            const finalize = (w?: number, h?: number, note?: string) => {
                if (settled) return;
                settled = true;
                const width = Math.max(1, w || fallback.width);
                const height = Math.max(1, h || fallback.height);
                this.log('Image Measured', { width, height }, note ? `${note} – ${url}` : url);
                resolve({ width, height });
            };

            const img = new Image();
            const timer = setTimeout(() => finalize(fallback.width, fallback.height, 'timeout fallback'), timeoutMs);

            img.onload = () => {
                clearTimeout(timer);
                finalize(img.naturalWidth, img.naturalHeight, 'natural size');
            };
            img.onerror = () => {
                clearTimeout(timer);
                finalize(fallback.width, fallback.height, 'load error');
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
     * Create PhotoItem from a manifest entry
     * @param {ManifestImageEntry} entry
     * @param {number} index
     * @returns {{ photo: PhotoItem | null, hasDimensions: boolean }}
     */
    createPhotoFromManifestEntry(entry: ManifestImageEntry, index: number) {
        let url: string | null = null;
        let width = DEFAULT_PHOTO_WIDTH;
        let height = DEFAULT_PHOTO_HEIGHT;
        let hasDimensions = false;

        if (typeof entry === 'string') {
            url = entry;
        } else if (entry && typeof entry.url === 'string') {
            url = entry.url;
            if (this.isValidDimension(entry.width) && this.isValidDimension(entry.height)) {
                width = entry.width!;
                height = entry.height!;
                hasDimensions = true;
            }
        }

        if (!url) {
            this.log('Manifest Entry Invalid', { entryIndex: index }, 'Missing URL', 'warn');
            return { photo: null, hasDimensions: false };
        }

        const photo: PhotoItem = {
            url,
            width,
            height,
            aspectRatio: width / height,
            index
        };

        if (!hasDimensions) {
            this.log('Manifest Missing Dimensions', { entryIndex: index });
        }

        return { photo, hasDimensions };
    }

    //==============================================================================================
    /**
     * Validate manifest dimension value
     * @param {number | null} value
     * @returns {boolean}
     */
    isValidDimension(value?: number | null) {
        return typeof value === 'number' && Number.isFinite(value) && value > 0;
    }

    //==============================================================================================
    /**
     * Backfill photo dimensions when manifest data is missing
     * @param {PhotoItem} photo
     */
    backfillPhotoDimensions(photo: PhotoItem) {
        this.measureImage(photo.url).then(({ width, height }) => {
            photo.width = width;
            photo.height = height;
            photo.aspectRatio = width / height;
            this.log('Dimensions Backfilled', {
                photoIndex: photo.index,
                width,
                height
            });

            const selector = `.photo-item[data-photo-index="${photo.index}"]`;
            const photoItem = this.container?.querySelector(selector) as HTMLElement | null;
            if (photoItem) {
                photoItem.style.aspectRatio = `${width} / ${height}`;
                const trigger = photoItem.querySelector('.photo-item-link') as HTMLElement | null;
                if (trigger) {
                    trigger.setAttribute('data-photo-lightbox-width', `${width}`);
                    trigger.setAttribute('data-photo-lightbox-height', `${height}`);
                }
            }
        }).catch((error) => {
            this.log(
                'Dimension Backfill Failed',
                { photoIndex: photo.index },
                error instanceof Error ? error.message : String(error),
                'warn'
            );
        });
    }

    //==============================================================================================
    /**
     * Retrieve/read photos from manifest
     * This won't actually render yet - just reads manifest and calculates image data/mesaurements
     */
    async retrievePhotos() {
        const grid = this.container!.querySelector('.photo-grid');
        if (!grid) {
            this.log('Retrieve Skipped', {}, 'Photo grid missing', 'warn');
            return;
        }

        try {
            const response = await fetch('/assets/images/reel/manifest.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`Failed to load manifest: ${response.status}`);
            const manifest = await response.json();
            const entries: ManifestImageEntry[] = Array.isArray(manifest.images) ? manifest.images : [];

            const normalizedPhotos: PhotoItem[] = [];
            entries.forEach((entry: ManifestImageEntry, index: number) => {
                const { photo } = this.createPhotoFromManifestEntry(entry, index);
                if (!photo) {
                    return;
                }
                normalizedPhotos.push(photo);
            });

            this.photos = normalizedPhotos;
            this.log('Manifest Loaded', {
                entries: entries.length,
                normalized: normalizedPhotos.length
            });
        } catch (err) {
            this.log(
                'Manifest Load Failed',
                {},
                err instanceof Error ? err.message : String(err),
                'error'
            );
            this.photos = [];
        }

        await this.renderPhotoGrid();
    }

    //==============================================================================================
    /**
     * Render photo grid with column layout (round-robin distribution)
     */
    async renderPhotoGrid() {
        const grid = this.container!.querySelector('.photo-grid') as HTMLElement | null;
        if (!grid) {
            this.log('Render Skipped', {}, 'Photo grid missing', 'warn');
            return;
        }

        const generation = ++this.renderGeneration;
        this.resetImageLoader();

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
        const predictedHeights = columns.map(() => paddingTop + paddingBottom);
        // Read layout once. Reading targetColumn.clientWidth inside the photo loop forced a full layout
        // for every item and was the largest synchronous render cost on a cold gallery load.
        const columnWidths = columns.map(column => column.clientWidth);

        // Track ordered queue of images to load (we want to load DOM from top down)
        const loadQueue: PhotoLoadRequest[] = [];

        const batchSize = window.innerWidth < 768 ? 8 : 16;
        for (let photoPosition = 0; photoPosition < this.photos.length; photoPosition++) {
            if (generation !== this.renderGeneration) return;
            const photo = this.photos[photoPosition];
            // Create photo item with skeleton
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item photo-item--loading';
            photoItem.style.aspectRatio = `${photo.width} / ${photo.height}`;
            photoItem.dataset.photoIndex = `${photo.index}`;

            // Create skeleton loader
            const skeleton = document.createElement('div');
            skeleton.className = 'photo-skeleton';

            // Create image
            const img = document.createElement('img');
            img.alt = `Photo ${photo.index + 1}`;
            img.loading = 'lazy';
            img.decoding = 'async'; // Ensure async decoding
            // Disable drag/save interactions on grid images
            img.setAttribute('draggable', 'false');
            img.addEventListener('dragstart', (e) => e.preventDefault());
            img.addEventListener('contextmenu', (e) => e.preventDefault());

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.dataset.photoLightboxSrc = photo.url;
            trigger.dataset.photoLightboxWidth = `${photo.width}`;
            trigger.dataset.photoLightboxHeight = `${photo.height}`;
            trigger.dataset.photoLightboxOrder = `${photo.index}`;
            trigger.className = 'photo-item-link';
            trigger.setAttribute('aria-label', `View photo ${photo.index + 1}`);
            trigger.addEventListener('contextmenu', (event) => event.preventDefault());

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
            const approximateTop = predictedHeights[targetIndex];
            targetColumn.appendChild(photoItem);

            // Update prediction by adding this item's estimated rendered height
            // The item width equals the column content width
            const columnWidth = columnWidths[targetIndex] || 1;
            const estimatedItemHeight = Math.round(columnWidth / (photo.width / photo.height));
            
            // Include the row gap only if not the very first item in that column (heuristic)
            const addGap = predictedHeights[targetIndex] > 0 ? rowGap : 0;
            predictedHeights[targetIndex] += estimatedItemHeight + addGap;

            // Add to load queue for later processing
            loadQueue.push({
                generation,
                img,
                photoItem,
                photo,
                url: photo.url,
                approximateTop,
                columnIndex: targetIndex,
                photoIndex: photo.index
            });

            this.observeImageRequest(loadQueue[loadQueue.length - 1]);

            // Yield after a small amount of DOM work so the transition and starfield get a paint.
            if ((photoPosition + 1) % batchSize === 0 && photoPosition + 1 < this.photos.length) {
                await this.yieldToNextFrame();
            }
        }

        this.initPhotoLightbox();
        this.log('Grid Rendered', {
            columns: columnCount,
            photos: this.photos.length,
            queue: loadQueue.length
        });
    }

    //==============================================================================================
    /** Yield gallery construction so animation and input get a frame between DOM batches. */
    yieldToNextFrame(): Promise<void> {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    //==============================================================================================
    /** Reset observer and queue state before a responsive grid rebuild. */
    resetImageLoader() {
        this.imageObserver?.disconnect();
        this.imageObserver = null;
        this.imageRequests.clear();
        this.imageLoadQueue = [];
        this.queuedImages = new WeakSet();
        this.activeImageLoads = 0;
    }

    //==============================================================================================
    /** Observe an image until it is within one viewport of the gallery viewport. */
    observeImageRequest(request: PhotoLoadRequest) {
        this.imageRequests.set(request.img, request);

        if (!('IntersectionObserver' in window)) {
            this.enqueueImageRequest(request);
            return;
        }

        if (!this.imageObserver) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const img = entry.target as HTMLImageElement;
                    const queuedRequest = this.imageRequests.get(img);
                    if (!queuedRequest) return;
                    this.imageObserver?.unobserve(img);
                    this.enqueueImageRequest(queuedRequest);
                });
            }, {
                root: this.container,
                rootMargin: '100% 0px',
                threshold: 0.01
            });
        }

        this.imageObserver.observe(request.img);
    }

    //==============================================================================================
    /** Add a visible/near-visible image to the priority queue exactly once. */
    enqueueImageRequest(request: PhotoLoadRequest) {
        if (request.img.dataset.photoSrcAssigned === 'true' || this.queuedImages.has(request.img)) return;
        this.queuedImages.add(request.img);
        this.imageLoadQueue.push(request);
        this.sortImageQueue();
        this.drainImageQueue();
    }

    sortImageQueue() {
        const viewportCenter = (this.container?.scrollTop || 0) + (this.container?.clientHeight || window.innerHeight) / 2;
        this.imageLoadQueue.sort((a, b) => {
            const distanceA = Math.abs(a.approximateTop - viewportCenter);
            const distanceB = Math.abs(b.approximateTop - viewportCenter);
            return distanceA - distanceB || a.photoIndex - b.photoIndex;
        });
    }

    //==============================================================================================
    /** Start only a small number of network/decode jobs at once. */
    drainImageQueue() {
        if (!this.imageLoadingEnabled || !this.isVisible) return;
        const maxConcurrent = window.innerWidth < 768 ? 2 : 3;
        this.sortImageQueue();

        while (this.activeImageLoads < maxConcurrent && this.imageLoadQueue.length) {
            const request = this.imageLoadQueue.shift()!;
            if (!request.img.isConnected || request.generation !== this.renderGeneration) continue;
            this.startImageLoad(request);
        }
    }

    startImageLoad(request: PhotoLoadRequest) {
        const { img, photoItem, photo } = request;
        this.activeImageLoads += 1;
        img.dataset.photoSrcAssigned = 'true';
        img.loading = 'eager';
        const viewportBottom = (this.container?.scrollTop || 0) + (this.container?.clientHeight || window.innerHeight);
        img.fetchPriority = request.approximateTop <= viewportBottom ? 'high' : 'auto';
        photoItem.classList.add('photo-item--active-load');

        let settled = false;
        const finish = async (loaded: boolean) => {
            if (settled) return;
            settled = true;
            if (request.generation !== this.renderGeneration) return;

            if (loaded) {
                try {
                    await img.decode();
                } catch {
                    // The load event is authoritative; decode() may reject for valid browser-managed images.
                }
            }

            await this.yieldToNextFrame();
            if (request.generation !== this.renderGeneration) return;

            photoItem.classList.remove('photo-item--active-load', 'photo-item--loading');
            if (loaded) {
                photoItem.classList.add('photo-item--loaded');
                if (img.naturalWidth && img.naturalHeight) {
                    photo.width = img.naturalWidth;
                    photo.height = img.naturalHeight;
                    photo.aspectRatio = img.naturalWidth / img.naturalHeight;
                    photoItem.style.aspectRatio = `${photo.width} / ${photo.height}`;
                }
            } else {
                photoItem.classList.add('photo-item--error');
                this.log('Image Load Failed', { photoIndex: photo.index }, photo.url, 'warn');
            }

            this.activeImageLoads = Math.max(0, this.activeImageLoads - 1);
            this.drainImageQueue();
        };

        img.addEventListener('load', () => { void finish(true); }, { once: true });
        img.addEventListener('error', () => { void finish(false); }, { once: true });
        img.src = request.url;
        this.log('Image Load Started', {
            photoIndex: request.photoIndex,
            active: this.activeImageLoads,
            queued: this.imageLoadQueue.length
        });
    }

    //==============================================================================================
    /** Hold decode work until the SPA transition has had time to finish painting. */
    scheduleImageLoading() {
        this.imageLoadingEnabled = false;
        if (this.imageLoadingTimer != null) window.clearTimeout(this.imageLoadingTimer);
        this.imageLoadingTimer = window.setTimeout(() => {
            this.imageLoadingTimer = null;
            if (!this.isVisible) return;
            this.imageLoadingEnabled = true;
            this.drainImageQueue();
        }, 350);
    }

    //==============================================================================================
    /**
     * (Re)initialize PhotoLightbox after the grid renders
     */
    initPhotoLightbox() {
        const grid = this.container?.querySelector('.photo-grid');
        if (!grid) {
            this.log('Lightbox Init Skipped', {}, 'Photo grid missing', 'warn');
            return;
        }

        if (this.lightboxInstance) {
            this.lightboxInstance.destroy();
            this.lightboxInstance = null;
            this.log('Lightbox Destroyed');
        }

        this.lightboxInstance = new PhotoLightbox({
            gallery: grid as HTMLElement,
            children: '[data-photo-lightbox-width]',
            loop: true,
            closeOnBackdrop: true,
            showCounter: false
        });

        this.lightboxInstance.init();
        this.log('Lightbox Initialized', {
            slides: this.photos.length
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
            this.log('Resize Reflow', {
                from: this.currentColumnCount,
                to: newColumnCount
            });
            void this.renderPhotoGrid();
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

        this.log('Event Listeners Bound');
    }


    //==============================================================================================
    /**
     * Show the photo gallery
     */
    show() {
        if (!this.container) {
            this.log('Show Skipped', {}, 'Container missing', 'warn');
            return;
        }

        // Bind event listeners only when the gallery is first shown
        if (!this.listenersBound) {
            this.setupEventListeners();
            this.listenersBound = true;
        }
                
        // Generate photos on first show (lazy initialization)
        if (!this.photosGenerated) {
            this.photosGenerated = true;

            // The user has entered the gallery, so its manifest is critical navigation work.
            void this.retrievePhotos();
            this.log('Manifest Load Started', { strategy: 'immediate' });
        }
        
        this.container.classList.add('visible');
        this.container.setAttribute('aria-hidden', 'false');
        this.container.removeAttribute('inert');
        this.isVisible = true;
        this.scheduleImageLoading();
        
        // Enable scrolling
        document.body.style.overflow = 'auto';
        this.log('Gallery Shown');
    }

    //==============================================================================================
    /**
     * Hide the photo gallery
     */
    hide() {
        if (!this.container) {
            this.log('Hide Skipped', {}, 'Container missing', 'warn');
            return;
        }
        
        this.container.classList.remove('visible');
        this.container.setAttribute('aria-hidden', 'true');
        this.container.setAttribute('inert', '');
        this.isVisible = false;
        this.imageLoadingEnabled = false;
        if (this.imageLoadingTimer != null) {
            window.clearTimeout(this.imageLoadingTimer);
            this.imageLoadingTimer = null;
        }
        
        // Disable scrolling
        document.body.style.overflow = 'hidden';

        // Lightbox UI (photoLightbox) manages its own visibility; we're done here
        this.log('Gallery Hidden');
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
