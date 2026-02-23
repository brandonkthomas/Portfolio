/**
 * stateManager.js
 * @fileoverview State management for single-page application routing
 * @description Handles view transitions between card and photo gallery views
 */

import { isMobile, isErrorPage, logEvent, LogData, LogLevel } from './common.js';
import { triggerStarfieldWarp } from './starfield.js';

//==============================================================================================
// Early init: Hide card immediately if we're loading /photos
// This prevents the card from flashing before JS modules initialize
(() => {
    const path = window.location.pathname;
    if (path === '/photos' || path === '/Photos') {
        const cardContainer = document.querySelector('.card-container');
        const photoContainer = document.querySelector('.photo-gallery-container');
        if (cardContainer) {
            (cardContainer as HTMLElement).classList.add('hidden');
        }
        if (photoContainer) {
            (photoContainer as HTMLElement).classList.add('visible');
        }
        logEvent('stateManager', 'Early Route Applied', { path: '/photos' });
    } else if (path === '/projects' || path === '/Projects') {
        const cardContainer = document.querySelector('.card-container');
        const projectsContainer = document.querySelector('.projects-container');
        if (cardContainer) {
            (cardContainer as HTMLElement).classList.add('hidden');
        }
        if (projectsContainer) {
            (projectsContainer as HTMLElement).classList.add('visible');
        }
        logEvent('stateManager', 'Early Route Applied', { path: '/projects' });
    }
})();

//==============================================================================================
/**
 * View state enumeration
 * @enum {string}
 */
export const ViewState = Object.freeze({
    CARD: 'card',
    PHOTOS: 'photos',
    PROJECTS: 'projects'
});

//==============================================================================================
/**
 * State manager for single-page application routing
 * @constructor
 * @description Handles view transitions between card and photo gallery views
 * @property {ViewState} currentView - Current view state
 * @property {boolean} isTransitioning - Whether a transition is in progress
 * @property {Array} listeners - Array of listeners for view changes
 * @property {boolean} initialRevealDone - Whether the initial reveal has been done
 * @property {AbortController} initialRevealAbortController - Abort controller for initial reveal
 * @property {Object} starfield - Reference to starfield module
 * @property {Object} card - Reference to card module
 * @property {Object} photoGallery - Reference to photo gallery module
 * @property {Object} projects - Reference to projects module
 * @property {Object} navbar - Reference to navbar module
 */
class StateManager {
    private currentView: string;
    private isTransitioning: boolean;
    private listeners: Array<(view: string) => void>;
    private initialRevealDone: boolean;
    private initialRevealAbortController: AbortController | null;
    private starfield: any;
    private card: any;
    private photoGallery: any;
    private projects: any;
    private navbar: any;
    constructor() {
        this.currentView = ViewState.CARD;
        this.isTransitioning = false;
        this.listeners = [];
        
        // Loop controlling initial reveal state
        this.initialRevealDone = false;
        this.initialRevealAbortController = null;
        
        // References to other modules (will be set via setters)
        this.starfield = null;
        this.card = null;
        this.photoGallery = null;
        this.projects = null;
        this.navbar = null;
        
        this.init();
    }

    private log(event: string, data?: LogData, note?: string, level: LogLevel = 'info') {
        logEvent('stateManager', event, data, note, level);
    }

    private describeView(view: string) {
        if (view === (ViewState as any).PHOTOS) return 'photos';
        if (view === (ViewState as any).PROJECTS) return 'projects';
        return 'card';
    }

    //==============================================================================================
    /**
     * Initialize state manager -- call ctor first
     * @returns {void}
     */
    init() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e: PopStateEvent) => {
            const state = (e.state || {}) as { view?: string };
            const viewString = state.view || (ViewState as any).CARD;
            // Map string to enum (for backward compatibility)
            const view = viewString === (ViewState as any).PHOTOS
                ? (ViewState as any).PHOTOS
                : (viewString === (ViewState as any).PROJECTS ? (ViewState as any).PROJECTS : (ViewState as any).CARD);
            this.navigateToView(
                /* view */ view, 
                /* pushHistory */ false, 
                /* skipAnimations */ false
            );
        });

        // Check initial URL and navigate accordingly
        this.checkInitialRoute();

        // Setup initial reveal for card and photo gallery
        // This will fade in the card and photo gallery when the page loads
        // BT 2025-10-31: finally got this working last week and then Safari 26 decided to cause 
        //   issues... to investigate
        this.setupInitialReveal();
        this.log('Initialized');
    }


    //==============================================================================================
    /**
     * Check initial route on page load
     * @returns {void}
     */
    checkInitialRoute() {
        const path = window.location.pathname;
        
        if (path === '/photos' || path === '/Photos') {
            // Set current view immediately (DOM already updated by early init)
            this.currentView = (ViewState as any).PHOTOS;
            history.replaceState({ view: (ViewState as any).PHOTOS }, '', '/photos');
            this.log('Initial Route', { path: '/photos' });
            
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
        } else if (path === '/projects' || path === '/Projects') {
            // Set current view immediately (DOM already updated by early init)
            this.currentView = (ViewState as any).PROJECTS;
            history.replaceState({ view: (ViewState as any).PROJECTS }, '', '/projects');
            this.log('Initial Route', { path: '/projects' });

            // Notify listeners immediately so navbar updates
            this.notifyListeners();

            // Wait for modules to be ready, then finalize setup (no animations needed)
            this.waitForModules(() => {
                if (this.starfield) {
                    this.starfield.setStarDirection(-1);
                    this.starfield.reduceStars();
                }
                this.waitForProjects(() => {
                    if (this.projects && !this.projects.isGridVisible()) {
                        this.projects.show();
                    }
                });
            });
        } else {
            // Default to card view; do not rewrite URL for non-SPA routes (i.e. /projects/slug)
            this.currentView = (ViewState as any).CARD;
            
            if (path === '/' || path === '') {
                history.replaceState({ view: (ViewState as any).CARD }, '', '/');
                this.log('Initial Route', { path: '/' });

                // Ensure modules are connected, then trigger card.show() so CTA scheduling starts on initial load
                this.waitForModules(() => {
                    if (this.card) {
                        this.card.show();
                    }
                });
            } else {
                this.log('Initial Route', { path: path || '(other)' });
            }
        }
    }

    //==============================================================================================
    /**
     * Wait for all modules to be ready, then call callback
     * @param {function} callback - Function to call when all modules are ready
     */
    waitForModules(callback: () => void) {
        const checkModules = () => {
            this.connectModules();
            
            // Check if all critical modules are connected
            if (this.starfield && this.card && this.photoGallery) {
                this.log('Core Modules Ready', {
                    starfield: Number(Boolean(this.starfield)),
                    card: Number(Boolean(this.card)),
                    photoGallery: Number(Boolean(this.photoGallery))
                });
                if (callback) callback();
            } else {
                // Check again in 50ms
                setTimeout(checkModules, 50);
            }
        };
        
        setTimeout(checkModules, 100);
    }

    //==============================================================================================
    /**
     * Wait for projects module then call callback
     * @param {function} callback - Function to call when projects module is ready
     * @returns {void}
     */
    waitForProjects(callback: () => void) {
        const check = () => {
            this.connectModules();
            if (this.projects) {
                this.log('Projects Module Ready');
                if (callback) callback();
            } else {
                setTimeout(check, 50);
            }
        };
        setTimeout(check, 50);
    }

    //==============================================================================================
    /**
     * Connect to module instances exposed on window
     * @returns {void}
     */
    connectModules() {
        if (window.starfieldInstance && !this.starfield) {
            this.starfield = window.starfieldInstance;
            this.log('Module Connected', { module: 'starfield' });
        }
        if (window.card3DInstance && !this.card) {
            this.card = window.card3DInstance;
            this.log('Module Connected', { module: 'card' });
        }
        if (window.photoGalleryInstance && !this.photoGallery) {
            this.photoGallery = window.photoGalleryInstance;
            this.log('Module Connected', { module: 'photoGallery' });
        }
        if (window.projectsInstance && !this.projects) {
            this.projects = window.projectsInstance;
            this.log('Module Connected', { module: 'projects' });
        }
        if (window.navbarManagerInstance && !this.navbar) {
            this.navbar = window.navbarManagerInstance;
            this.log('Module Connected', { module: 'navbar' });
        }
    }

    //==============================================================================================
    /**
     * Register a listener for view changes
     * @param {function} callback - Function to call when view changes
     */
    onViewChange(callback: (view: string) => void) {
        this.listeners.push(callback);
        this.log('Listener Registered', { total: this.listeners.length });
    }

    //==============================================================================================
    /**
     * Notify all listeners of view change
     */
    notifyListeners() {
        this.listeners.forEach((listener: (view: string) => void) => listener(this.currentView));
        this.log('Listeners Notified', {
            listeners: this.listeners.length,
            view: this.describeView(this.currentView)
        });
    }

    //==============================================================================================
    /**
     * Initialize on-load reveal for card and photo gallery
     * @returns {void}
     */
    setupInitialReveal() {
        if (this.initialRevealDone) {
            this.log('Initial Reveal Skipped', { reason: 'already-done' });
            return;
        }
        this.log('Initial Reveal Started');

        // Create abort controller to abort initial reveal if needed (if loading /photos or /projects)
        const abortController = new AbortController();
        this.initialRevealAbortController = abortController;

        // Add initial reveal classes to elements
        this.getInitialRevealElements().forEach(({ element, className }) => {
            if (element) {
                element.classList.add(className);
            }
        });

        // Collect module ready promises
        const moduleReadyPromises: Promise<any>[] = [];
        
        const collectModules = () => {
            this.connectModules();

            if (this.card && this.card.readyPromise && !moduleReadyPromises.includes(this.card.readyPromise)) {
                moduleReadyPromises.push(this.card.readyPromise);
            }

            if (this.starfield && this.starfield.readyPromise && !moduleReadyPromises.includes(this.starfield.readyPromise)) {
                moduleReadyPromises.push(this.starfield.readyPromise);
            }

            if (this.navbar && this.navbar.readyPromise && !moduleReadyPromises.includes(this.navbar.readyPromise)) {
                moduleReadyPromises.push(this.navbar.readyPromise);
            }

            // Dont block initial reveal on pages without the card container (error page)
            const hasCardContainer = !!document.querySelector('.card-container');
            if (!hasCardContainer || isErrorPage()) {
                return true;
            }

            // On pages with card, wait for both card and starfield
            return this.card && this.starfield;
        };

        // Try to finalize initial reveal
        const tryFinalize = () => {
            if (abortController.signal.aborted) {
                return;
            }

            const promises = moduleReadyPromises.length ? moduleReadyPromises : [Promise.resolve()];
            Promise.allSettled(promises).then(() => {
                if (abortController.signal.aborted) {
                    return;
                }

                const revealDelay = isMobile() ? 50 : 30;
                setTimeout(() => {
                    if (abortController.signal.aborted) return;
                    this.triggerInitialReveal();
                }, revealDelay);
            });
        };

        // Check if modules are ready every 50ms
        const moduleInterval = setInterval(() => {
            if (collectModules()) {
                clearInterval(moduleInterval);
                tryFinalize();
            }
        }, 50);

        // Abort initial reveal if needed
        abortController.signal.addEventListener('abort', () => {
            clearInterval(moduleInterval);
            this.log('Initial Reveal Aborted');
        });
    }

    //==============================================================================================
    /**
     * Trigger initial reveal for card and photo gallery
     * @description Fades in the card and photo gallery
     */
    triggerInitialReveal() {
        if (this.initialRevealDone) {
            return;
        }

        this.initialRevealDone = true;
        (document.body as any).dataset.initialState = 'ready';
        this.log('Initial Reveal Triggered');

        const mainElements = this.getInitialRevealElements();
        mainElements.forEach(({ element, className }) => {
            if (!element) return;

            element.classList.add(className);

            requestAnimationFrame(() => {
                element.classList.remove(className);
                element.classList.add(`${className}--enter`);

                setTimeout(() => {
                    element.classList.remove(`${className}--enter`);
                }, 200);
            });
        });

        if (this.initialRevealAbortController) {
            this.initialRevealAbortController.abort();
            this.initialRevealAbortController = null;
        }
    }

    //==============================================================================================
    /**
     * Retrieve initial reveal elements
     * @returns {Array} Array of elements to reveal
     */
    getInitialRevealElements(): Array<{ element: HTMLElement | null; className: string }> {
        const path = window.location.pathname;
        const elements = [
            { element: document.querySelector('.card-container') as HTMLElement | null, className: 'card-initial' },
            { element: document.getElementById('starfield') as HTMLElement | null, className: 'starfield-initial' },
            { element: document.querySelector('.photo-gallery-container') as HTMLElement | null, className: 'photo-gallery-initial' }
        ];
        // Only include projects container in initial reveal when landing directly on /projects
        if (path === '/projects' || path === '/Projects') {
            elements.push({ element: document.querySelector('.projects-container') as HTMLElement | null, className: 'projects-initial' });
        }
        return elements;
    }

    //==============================================================================================
    /**
     * Navigate to a specific view
     * @param {ViewState} view - View state enum value
     * @param {boolean} pushHistory - Whether to push to browser history
     * @param {boolean} skipAnimations - Whether to skip animations (for initial load)
     */
    async navigateToView(view: string, pushHistory: boolean = true, skipAnimations: boolean = false) {
        if (this.isTransitioning || view === this.currentView) {
            this.log('Navigation Ignored', {
                to: this.describeView(view),
                reason: this.isTransitioning ? 'transitioning' : 'already-active'
            });
            return;
        }

        // Ensure modules are connected
        if (!this.starfield || !this.card || !this.photoGallery || (view === (ViewState as any).PROJECTS && !this.projects)) {
            this.log('Modules Pending', { view: this.describeView(view) }, 'Waiting for dependencies', 'warn');
            this.waitForModules(() => {
                if (view === (ViewState as any).PROJECTS) {
                    this.waitForProjects(() => {
                        this.navigateToView(
                            /* view */ view, 
                            /* pushHistory */ pushHistory, 
                            /* skipAnimations */ skipAnimations
                        );
                    });
                    return;
                }
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
            let path = '/';
            if (view === (ViewState as any).PHOTOS) path = '/photos';
            else if (view === (ViewState as any).PROJECTS) path = '/projects';
            history.pushState({ view }, '', path);
        }

        // Perform transition
        if (view === (ViewState as any).PHOTOS) {
            await this.transitionToPhotos(skipAnimations);
        } else if (view === (ViewState as any).PROJECTS) {
            await this.transitionToProjects(skipAnimations);
        } else {
            await this.transitionToCard(skipAnimations);
        }

        this.currentView = view;
        this.isTransitioning = false;
        this.notifyListeners();
        this.log('Navigation Completed', {
            view: this.describeView(view)
        });
    }

    //==============================================================================================
    /**
     * Transition to photo gallery view
     * @param {boolean} skipAnimations - Whether to skip animations
     */
    async transitionToPhotos(skipAnimations: boolean = false) {
        this.log('Transition Photos Start', {
            skipAnimations: Number(skipAnimations),
            from: this.describeView(this.currentView)
        });
        
        // Set star direction to reverse (away from camera)
        if (this.starfield) {
            this.starfield.setStarDirection(-1);
        }
        
        if (skipAnimations) {
            // No animations - instantly show photos view
            if (this.card) {
                this.card.hide();
            }
            if (this.projects) {
                this.projects.hide();
            }
            if (this.photoGallery) {
                this.photoGallery.show();
            }
            // Only reduce stars when coming from CARD
            if (this.starfield && this.currentView === (ViewState as any).CARD) {
                this.starfield.reduceStars();
            }
            return;
        }
        
        // Start both animations simultaneously for 3D effect
        // Only warp when transitioning from CARD
        if (this.currentView === (ViewState as any).CARD) {
            triggerStarfieldWarp(true); // true = reverse
        }

        // Hide card (scale down, fade, blur)
        if (this.card) {
            this.card.hide();
        } else {
            this.log('Module Missing', { module: 'card', transition: 'photos' }, 'Unable to hide card', 'warn');
        }

        // Hide projects if visible, then show photo gallery
        if (this.projects) {
            this.projects.hide();
        }
        // Show photo gallery immediately (we'll animate it in)
        if (this.photoGallery) {
            this.photoGallery.show();
        } else {
            this.log('Module Missing', { module: 'photoGallery', transition: 'photos' }, 'Unable to show gallery', 'warn');
        }

        // Wait for animations to complete
        await new Promise(resolve => setTimeout(resolve, 250));

        // Reduce star count during card exit transition
        if (this.currentView === (ViewState as any).CARD) {
            if (this.starfield) {
                this.starfield.reduceStars();
            } else {
                this.log('Module Missing', { module: 'starfield', transition: 'photos' }, 'Reduce stars skipped', 'warn');
            }
        }
        
    }

    //==============================================================================================
    /**
     * Transition to projects view
     * @param {boolean} skipAnimations - Whether to skip animations
     */
    async transitionToProjects(skipAnimations: boolean = false) {
        this.log('Transition Projects Start', {
            skipAnimations: Number(skipAnimations),
            from: this.describeView(this.currentView)
        });

        // Set star direction to reverse (away from camera)
        if (this.starfield) {
            this.starfield.setStarDirection(-1);
        }

        // Instantly show projects view if no animations are requested, then short circuit
        if (skipAnimations) {
            if (this.card) this.card.hide();
            if (this.photoGallery) this.photoGallery.hide();
            if (this.projects) this.projects.show();
            // Only reduce stars when coming from CARD
            if (this.starfield && this.currentView === (ViewState as any).CARD) {
                this.starfield.reduceStars();
            }
            return;
        }

        // Only warp when transitioning from CARD
        if (this.currentView === (ViewState as any).CARD) {
            triggerStarfieldWarp(true);
        }

        // Hide card
        if (this.card) this.card.hide();

        // Hide photo gallery if visible
        if (this.photoGallery) this.photoGallery.hide();

        // Show projects grid
        if (this.projects) this.projects.show();

        // Wait for CSS animations to complete
        await new Promise(resolve => setTimeout(resolve, 250));

        // Reduce star count
        if (this.starfield && this.currentView === (ViewState as any).CARD) {
            this.starfield.reduceStars();
        }
    }

    //==============================================================================================
    /**
     * Transition to card view
     * @param {boolean} skipAnimations - Whether to skip animations
     */
    async transitionToCard(skipAnimations: boolean = false) {
        this.log('Transition Card Start', {
            skipAnimations: Number(skipAnimations),
            from: this.describeView(this.currentView)
        });
        
        // Set star direction to forward (toward camera)
        if (this.starfield) {
            this.starfield.setStarDirection(1);
        }
        
        if (skipAnimations) {
            // No animations - instantly show card view
            if (this.photoGallery) this.photoGallery.hide();
            if (this.projects) this.projects.hide();
            if (this.card) this.card.show();
            if (this.starfield) this.starfield.restoreStars();
            return;
        }
        
        // Start both animations simultaneously for 3D effect
        // Hide photo gallery (scales up, fades, blurs)
        if (this.photoGallery) this.photoGallery.hide();
        if (this.projects) this.projects.hide();

        // Show card immediately (we'll animate it in)
        if (this.card) {
            this.card.show();
        } else {
            this.log('Module Missing', { module: 'card', transition: 'card' }, 'Unable to show card', 'warn');
        }

        // Trigger starfield warp (forward direction)
        triggerStarfieldWarp(false); // false = forward

        // Wait for animations to complete
        await new Promise(resolve => setTimeout(resolve, 250));

        // Restore star count during transition
        if (this.starfield) {
            this.starfield.restoreStars();
        } else {
            this.log('Module Missing', { module: 'starfield', transition: 'card' }, 'Restore stars skipped', 'warn');
        }
        
    }

    //==============================================================================================
    /**
     * Retrieve current view
     * @returns {ViewState} Current view state
     */
    getCurrentView() {
        return this.currentView;
    }
}

// Create and export singleton instance
const stateManager = new StateManager();
(window as any).stateManagerInstance = stateManager;

export default stateManager;
