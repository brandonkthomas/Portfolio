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
        this.container.innerHTML = `
            <div class="photo-gallery">
                <div class="photo-grid"></div>
            </div>
            <div class="photo-lightbox">
                <div class="lightbox-control lightbox-close-wrapper"></div>
                <div class="lightbox-control lightbox-prev-wrapper"></div>
                <div class="lightbox-control lightbox-next-wrapper"></div>
                <div class="lightbox-content">
                    <img src="" alt="" class="lightbox-image">
                </div>
            </div>
        `;

        this.lightbox = this.container.querySelector('.photo-lightbox');
        
        // Create glass surface controls
        this.createLightboxControls();
    }

    //==============================================================================================
    /**
     * Create glass surface lightbox controls
     */
    createLightboxControls() {
        // Close button
        const closeWrapper = this.container.querySelector('.lightbox-close-wrapper');
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
        closeWrapper.appendChild(closeGlass.element);
        this.lightboxControls.close = closeGlass;

        // Previous button
        const prevWrapper = this.container.querySelector('.lightbox-prev-wrapper');
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
        prevWrapper.appendChild(prevGlass.element);
        this.lightboxControls.prev = prevGlass;

        // Next button
        const nextWrapper = this.container.querySelector('.lightbox-next-wrapper');
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
        nextWrapper.appendChild(nextGlass.element);
        this.lightboxControls.next = nextGlass;
    }

    //==============================================================================================
    /**
     * Generate photos from manifest
     */
    async generatePhotos() {
        const grid = this.container.querySelector('.photo-grid');
        if (!grid) return;

        try {
            const response = await fetch('/assets/images/reel/manifest.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`Failed to load manifest: ${response.status}`);
            const manifest = await response.json();
            const images = Array.isArray(manifest.images) ? manifest.images : [];

            // Build photo objects with basic aspect ratio guess (lazy load real dimensions)
            this.photos = images.map((url, index) => ({
                url,
                width: 800,
                height: 1200,
                aspectRatio: 800 / 1200,
                index
            }));
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

        // Distribute photos across columns (round-robin)
        this.photos.forEach((photo, index) => {
            const columnIndex = index % columnCount;
            const column = columns[columnIndex];

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
            column.appendChild(photoItem);
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

        // Lightbox controls
        const closeBtn = this.container.querySelector('.lightbox-close');
        const prevBtn = this.container.querySelector('.lightbox-prev');
        const nextBtn = this.container.querySelector('.lightbox-next');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeLightbox());
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.showPreviousPhoto());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.showNextPhoto());
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
                    this.generatePhotos();
                }, { timeout: 100 });
            } else {
                setTimeout(() => {
                    this.generatePhotos();
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
