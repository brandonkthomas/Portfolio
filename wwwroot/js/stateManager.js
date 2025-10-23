/**
 * stateManager.js
 * @fileoverview State management for single-page application routing
 * @description Handles view transitions between card and photo gallery views
 */

import { isMobile } from './common.js';

//==============================================================================================
// Early init: Hide card immediately if we're loading /photos
// This prevents the card from flashing before JS modules initialize
(() => {
    const path = window.location.pathname;
    if (path === '/photos' || path === '/Photos') {
        const cardContainer = document.querySelector('.card-container');
        const photoContainer = document.querySelector('.photo-gallery-container');
        if (cardContainer) {
            cardContainer.classList.add('hidden');
        }
        if (photoContainer) {
            photoContainer.classList.add('visible');
        }
    }
})();

//==============================================================================================
/**
 * View state enumeration
 * @enum {string}
 */
export const ViewState = Object.freeze({
    CARD: 'card',
    PHOTOS: 'photos'
});

class StateManager {
    constructor() {
        this.currentView = ViewState.CARD;
        this.isTransitioning = false;
        this.listeners = [];
        
        // References to other modules (will be set via setters)
        this.starfield = null;
        this.card = null;
        this.photoGallery = null;
        
        this.init();
    }

    /**
     * Initialize state manager
     */
    init() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            const state = e.state || {};
            const viewString = state.view || ViewState.CARD;
            // Map string to enum (for backward compatibility)
            const view = viewString === ViewState.PHOTOS ? ViewState.PHOTOS : ViewState.CARD;
            this.navigateToView(
                /* view */ view, 
                /* pushHistory */ false, 
                /* skipAnimations */ false
            );
        });

        // Check initial URL and navigate accordingly
        this.checkInitialRoute();
    }

    /**
     * Check initial route on page load
     */
    checkInitialRoute() {
        const path = window.location.pathname;
        
        if (path === '/photos' || path === '/Photos') {
            // Set current view immediately (DOM already updated by early init)
            this.currentView = ViewState.PHOTOS;
            history.replaceState({ view: ViewState.PHOTOS }, '', '/photos');
            
            // Notify listeners immediately so navbar updates
            this.notifyListeners();
            
            // Wait for modules to be ready, then finalize setup (no animations needed)
            this.waitForModules(() => {
                // Set star direction for photos view
                if (this.starfield) {
                    this.starfield.setStarDirection(-1);
                    this.starfield.reduceStars();
                }
                // Ensure photo gallery is initialized
                if (this.photoGallery && !this.photoGallery.isGalleryVisible()) {
                    this.photoGallery.show();
                }
            });
        } else {
            // Default to card view
            this.currentView = ViewState.CARD;
            history.replaceState({ view: ViewState.CARD }, '', '/');
            
            // Still connect modules for later use
            this.waitForModules();
        }
    }

    /**
     * Wait for all modules to be ready, then call callback
     */
    waitForModules(callback) {
        const checkModules = () => {
            this.connectModules();
            
            // Check if all critical modules are connected
            if (this.starfield && this.card && this.photoGallery) {
                if (callback) callback();
            } else {
                // Check again in 50ms
                setTimeout(checkModules, 50);
            }
        };
        
        setTimeout(checkModules, 100);
    }

    /**
     * Connect to module instances exposed on window
     */
    connectModules() {
        if (window.starfieldInstance && !this.starfield) {
            this.setStarfield(window.starfieldInstance);
        }
        if (window.card3DInstance && !this.card) {
            this.setCard(window.card3DInstance);
        }
        if (window.photoGalleryInstance && !this.photoGallery) {
            this.setPhotoGallery(window.photoGalleryInstance);
        }
    }

    /**
     * Set module references
     */
    setStarfield(starfield) {
        this.starfield = starfield;
    }

    setCard(card) {
        this.card = card;
    }

    setPhotoGallery(photoGallery) {
        this.photoGallery = photoGallery;
    }

    /**
     * Register a listener for view changes
     * @param {function} callback - Function to call when view changes
     */
    onViewChange(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notify all listeners of view change
     */
    notifyListeners() {
        this.listeners.forEach(listener => listener(this.currentView));
    }

    /**
     * Navigate to a specific view
     * @param {ViewState} view - View state enum value
     * @param {boolean} pushHistory - Whether to push to browser history
     * @param {boolean} skipAnimations - Whether to skip animations (for initial load)
     */
    async navigateToView(view, pushHistory = true, skipAnimations = false) {
        if (this.isTransitioning || view === this.currentView) {
            return;
        }

        // Ensure modules are connected
        if (!this.starfield || !this.card || !this.photoGallery) {
            console.warn('Waiting for modules to be ready...');
            this.waitForModules(() => {
                this.navigateToView(
                    /* view */ view, 
                    /* pushHistory */ pushHistory, 
                    /* skipAnimations */ skipAnimations
                );
            });
            return;
        }

        this.isTransitioning = true;

        // Update browser history
        if (pushHistory) {
            const path = view === ViewState.PHOTOS ? '/photos' : '/';
            history.pushState({ view }, '', path);
        }

        // Perform transition
        if (view === ViewState.PHOTOS) {
            await this.transitionToPhotos(skipAnimations);
        } else {
            await this.transitionToCard(skipAnimations);
        }

        this.currentView = view;
        this.isTransitioning = false;
        this.notifyListeners();
    }

    /**
     * Transition to photo gallery view
     * @param {boolean} skipAnimations - Whether to skip animations
     */
    async transitionToPhotos(skipAnimations = false) {
        
        // Set star direction to reverse (away from camera)
        if (this.starfield) {
            this.starfield.setStarDirection(-1);
        }
        
        if (skipAnimations) {
            // No animations - instantly show photos view
            if (this.card) {
                this.card.hide();
            }
            if (this.photoGallery) {
                this.photoGallery.show();
            }
            if (this.starfield) {
                this.starfield.reduceStars();
            }
            return;
        }
        
        // Start both animations simultaneously for 3D effect
        // Trigger starfield warp in reverse
        if (window.triggerStarfieldWarp) {
            window.triggerStarfieldWarp(true); // true = reverse
        }

        // Hide card (scales down, fades, blurs)
        if (this.card) {
            this.card.hide();
        } else {
            console.warn('Card instance not available');
        }

        // Show photo gallery immediately (will animate in)
        if (this.photoGallery) {
            this.photoGallery.show();
        } else {
            console.warn('Photo gallery instance not available');
        }

        // Wait for animations to complete
        await this.wait(250);

        // Reduce star count during transition
        if (this.starfield) {
            this.starfield.reduceStars();
        } else {
            console.warn('Starfield instance not available');
        }
        
    }

    /**
     * Transition to card view
     * @param {boolean} skipAnimations - Whether to skip animations
     */
    async transitionToCard(skipAnimations = false) {
        
        // Set star direction to forward (toward camera)
        if (this.starfield) {
            this.starfield.setStarDirection(1);
        }
        
        if (skipAnimations) {
            // No animations - instantly show card view
            if (this.photoGallery) {
                this.photoGallery.hide();
            }
            if (this.card) {
                this.card.show();
            }
            if (this.starfield) {
                this.starfield.restoreStars();
            }
            return;
        }
        
        // Start both animations simultaneously for 3D effect
        // Hide photo gallery (scales up, fades, blurs)
        if (this.photoGallery) {
            this.photoGallery.hide();
        } else {
            console.warn('Photo gallery instance not available');
        }

        // Show card immediately (will animate in)
        if (this.card) {
            this.card.show();
        } else {
            console.warn('Card instance not available');
        }

        // Trigger starfield warp (forward direction)
        if (window.triggerStarfieldWarp) {
            window.triggerStarfieldWarp(false); // false = forward
        }

        // Wait for animations to complete
        await this.wait(250);

        // Restore star count during transition
        if (this.starfield) {
            this.starfield.restoreStars();
        } else {
            console.warn('Starfield instance not available');
        }
        
    }

    /**
     * Utility function to wait
     * @param {number} ms - Milliseconds to wait
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current view
     * @returns {ViewState} Current view state
     */
    getCurrentView() {
        return this.currentView;
    }
}

// Create and export singleton instance
const stateManager = new StateManager();

export default stateManager;
