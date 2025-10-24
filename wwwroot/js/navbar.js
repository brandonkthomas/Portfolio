/**
 * navbar.js
 * @fileoverview URL display component with glass surface effect
 * @description Handles the glass surface URL bar with responsive burger menu
 */

import { createGlassSurface } from './glassSurface.js';
import { isMobile } from './common.js';
import stateManager, { ViewState } from './stateManager.js';

class Navbar {
    constructor() {
        this.container = null;
        this.glassSurface = null;
        this.burgerButton = null;
        this.navLinks = null;
        this.isMenuOpen = false;
        this.urlText = null;
        this.mobilePhotosLinks = []; // Store mobile photos links for dynamic updates
        this.readyPromise = new Promise((resolve) => { // Signal to subscribers that the navbar is ready
            this._resolveReady = resolve;
        });
        this.init();
    }

    //==============================================================================================
    /**
     * Initialize the URL display with glass surface
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
     * Setup the glass surface and event listeners
     */
    setup() {
        this.container = document.querySelector('.url-display');
        if (!this.container) return;

        // Get references to elements
        this.burgerButton = this.container.querySelector('.burger-menu');
        this.navLinks = this.container.querySelector('.url-nav-links');

        // Create glass surface wrapper
        const glassSurfaceWrapper = this.container.querySelector('.glass-surface-wrapper');
        if (!glassSurfaceWrapper) return;

        // Get the content that should be inside the glass surface
        const content = glassSurfaceWrapper.querySelector('.url-display-content');
        if (!content) return;

        // Create glass surface with appropriate dimensions
        this.glassSurface = createGlassSurface({
            width: 'auto',
            height: 'auto',
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
            className: 'url-display-glass',
            style: {
                minHeight: '48px',
                transition: 'height 0.3s ease'
            }
        });

        // Move content into glass surface
        this.glassSurface.contentElement.appendChild(content);

        // Replace wrapper with glass surface
        glassSurfaceWrapper.replaceWith(this.glassSurface.element);

        // Setup event listeners
        this.setupEventListeners();
        
        // Initial responsive check
        this.handleResize();

        // Signal to subscribers that the navbar is ready
        if (this._resolveReady) {
            this._resolveReady();
            this._resolveReady = null;
        }
    }

    //==============================================================================================
    /**
     * Setup event listeners for burger menu and resize
     */
    setupEventListeners() {
        // Get URL text element
        this.urlText = document.querySelector('.url-text');

        // On mobile, make the entire bar clickable
        if (this.glassSurface && this.glassSurface.element) {
            this.glassSurface.element.addEventListener('click', (e) => {
                // Only trigger on mobile (when burger is visible)
                if (window.innerWidth <= 768) {
                    // Don't toggle if clicking on a link
                    if (!e.target.closest('.url-link')) {
                        e.stopPropagation();
                        this.toggleMenu();
                    }
                }
            });
        }

        // Intercept photos link clicks for SPA navigation (no router, so we need to handle this ourselves)
        const photoLinks = document.querySelectorAll('.url-link-photos');
        photoLinks.forEach(link => {
            // Store mobile links for later updates
            if (link.closest('.url-nav-links.mobile')) {
                this.mobilePhotosLinks.push(link);
            }

            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Close mobile menu if open
                if (this.isMenuOpen) {
                    this.closeMenu();
                }
                
                // Determine target view based on current state
                const currentView = stateManager.getCurrentView();
                const targetView = currentView === ViewState.PHOTOS ? ViewState.CARD : ViewState.PHOTOS;
                
                // Navigate to target view
                stateManager.navigateToView(targetView, true);
            });
        });

        // Make URL text clickable to return home (desktop only)
        if (this.urlText) {
            this.urlText.addEventListener('click', (e) => {
                // Only work on desktop
                if (window.innerWidth > 768) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Navigate to card view
                    stateManager.navigateToView(ViewState.CARD, true);
                }
            });
        }

        // Listen for view changes to update mobile nav
        stateManager.onViewChange((view) => {
            this.updateMobileNav(view);
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isMenuOpen && !this.container.contains(e.target)) {
                this.closeMenu();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    //==============================================================================================
    /**
     * Update mobile nav based on current view
     * TODO: dont hardcode this HTML
     * @param {ViewState} view - Current view state
     */
    updateMobileNav(view) {
        // Only update mobile links
        this.mobilePhotosLinks.forEach(link => {
            if (view === ViewState.PHOTOS) {
                // Change Photos link to Card link
                link.innerHTML = `
                    <img src="/assets/svg/bt-logo-boxed.svg" alt="" width="20" height="20" />
                    <span>Card</span>
                `;
            } else {
                // Change back to Photos link
                link.innerHTML = `
                    <img src="/assets/svg/polaroid-filled.svg" alt="" width="20" height="20" />
                    <span>Photos</span>
                `;
            }
        });
    }

    //==============================================================================================
    /**
     * Toggle the burger menu
     */
    toggleMenu() {
        if (this.isMenuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    //==============================================================================================
    /**
     * Open the burger menu
     */
    openMenu() {
        this.isMenuOpen = true;
        this.container.classList.add('menu-open');
        if (this.burgerButton) {
            this.burgerButton.setAttribute('aria-expanded', 'true');
        }
    }

    //==============================================================================================
    /**
     * Close the burger menu
     */
    closeMenu() {
        this.isMenuOpen = false;
        this.container.classList.remove('menu-open');
        if (this.burgerButton) {
            this.burgerButton.setAttribute('aria-expanded', 'false');
        }
    }

    //==============================================================================================
    /**
     * Handle window resize
     */
    handleResize() {
        // Close menu if switching from mobile to desktop
        if (!isMobile() && this.isMenuOpen) {
            this.closeMenu();
        }
    }

    //==============================================================================================
    /**
     * Cleanup
     */
    destroy() {
        if (this.glassSurface) {
            this.glassSurface.destroy();
        }
    }
}

// Initialize when module loads
const navbarManager = new Navbar();
window.navbarManagerInstance = navbarManager;

export default navbarManager;
