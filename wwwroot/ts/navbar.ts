/**
 * navbar.js
 * @fileoverview URL display component with glass surface effect
 * @description Handles the glass surface URL bar with responsive burger menu
 */

import { createGlassSurface } from './glassSurface';
import { isMobile } from './common';
import stateManager, { ViewState } from './stateManager';

class Navbar {
    [key: string]: any;
    constructor() {
        this.container = null;
        this.glassSurface = null;
        this.burgerButton = null;
        this.navLinks = null;
        this.isMenuOpen = false;
        this.urlText = null;
        this.mobilePhotosLinks = []; // Store mobile photos links for dynamic updates
        this.mobileProjectsLinks = []; // Store mobile projects links for dynamic updates
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
            saturation: 0.8,
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
            this.glassSurface.element.addEventListener('click', (e: MouseEvent) => {
                // Only trigger on mobile (when burger is visible)
                if (window.innerWidth <= 768) {
                    // Don't toggle if clicking on a link
                    const target = e.target as Element | null;
                    if (!target?.closest('.url-link')) {
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
            if ((link as Element).closest('.url-nav-links.mobile')) {
                this.mobilePhotosLinks.push(link);
            }

            (link as HTMLElement).addEventListener('click', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Close mobile navbar dropdown if open
                if (this.isMenuOpen) {
                    this.closeMenu();
                }
                
                // Determine if SPA navigation is possible on this page
                const hasContainers = !!document.querySelector('.photo-gallery-container') && !!document.querySelector('.card-container');
                const canSpa = hasContainers && !!window.photoGalleryInstance && !!window.card3DInstance;

                if (canSpa) {
                    // Determine target view based on current state
                    const currentView = stateManager.getCurrentView();
                    const targetView = currentView === ViewState.PHOTOS ? ViewState.CARD : ViewState.PHOTOS;
                    stateManager.navigateToView(targetView, true);
                } else {
                    // Fallback to full navigation
                    const path = window.location.pathname;
                    if (path.toLowerCase().startsWith('/photos')) {
                        window.location.reload();
                    } else {
                        window.location.href = '/photos';
                    }
                }
            });
        });

        // Intercept projects link clicks
        const projectLinks = document.querySelectorAll('.url-link-projects');
        projectLinks.forEach(link => {
            if ((link as Element).closest('.url-nav-links.mobile')) {
                this.mobileProjectsLinks.push(link);
            }

            (link as HTMLElement).addEventListener('click', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();

                if (this.isMenuOpen) {
                    this.closeMenu();
                }

                const hasContainers = !!document.querySelector('.projects-container') && !!document.querySelector('.card-container');
                const canSpa = hasContainers && !!window.projectsInstance && !!window.card3DInstance;

                if (canSpa) {
                    const currentView = stateManager.getCurrentView();
                    const targetView = currentView === ViewState.PROJECTS ? ViewState.CARD : ViewState.PROJECTS;
                    stateManager.navigateToView(targetView, true);
                } else {
                    const path = window.location.pathname;
                    if (path.toLowerCase() === '/projects') {
                        window.location.reload();
                    } else {
                        window.location.href = '/projects';
                    }
                }
            });
        });

        // Make URL text clickable to return home (desktop only)
        if (this.urlText) {
            this.urlText.addEventListener('click', (e: MouseEvent) => {
                // Only work on desktop
                if (window.innerWidth > 768) {
                    e.preventDefault();
                    e.stopPropagation();

                    const hasContainers = !!document.querySelector('.card-container'); // does card container exist?
                    const canSpa = hasContainers && !!window.card3DInstance; // do card container & card3d both exist?

                    if (canSpa) {
                        // Navigate to card view
                        stateManager.navigateToView(ViewState.CARD, true);
                    } else {
                        window.location.href = '/';
                    }
                }
            });
        }

        // Listen for view changes to update mobile nav
        stateManager.onViewChange((view: string) => {
            this.updateMobileNav(view);
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e: MouseEvent) => {
            if (this.isMenuOpen && !this.container.contains(e.target as Node)) {
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
    updateMobileNav(view: string) {
        // Update Photos link state
        this.mobilePhotosLinks.forEach((link: Element) => {
            if (view === ViewState.PHOTOS) {
                link.innerHTML = `
                    <img src="/assets/svg/bt-logo-boxed.svg" alt="" width="20" height="20" />
                    <span>Card</span>
                `;
            } else {
                link.innerHTML = `
                    <img src="/assets/svg/polaroid-filled.svg" alt="" width="20" height="20" />
                    <span>Photos</span>
                `;
            }
        });

        // Update Projects link state
        this.mobileProjectsLinks.forEach((link: Element) => {
            if (view === ViewState.PROJECTS) {
                link.innerHTML = `
                    <img src="/assets/svg/bt-logo-boxed.svg" alt="" width="20" height="20" />
                    <span>Card</span>
                `;
            } else {
                link.innerHTML = `
                    <img src="/assets/svg/project-filled.svg" alt="" width="20" height="20" />
                    <span>Projects</span>
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
(window as any).navbarManagerInstance = navbarManager;

export default navbarManager;
