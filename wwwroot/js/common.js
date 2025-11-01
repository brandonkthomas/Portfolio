/**
 * common.js
 * @fileoverview Shared functions used by other modules
 * @description Handles mobile detection, URL path display, navigation
 */

//==============================================================================================
/**
 * Detects if the current device is a mobile device
 * @function isMobile
 * @returns {boolean} true if mobile; else false
 * @description Checks for touch capability and screen width to determine if device is mobile
 */
export function isMobile() {
    // Check if device has touch capability
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Check screen width (768px as common breakpoint)
    const isSmallScreen = window.innerWidth <= 768;

    return hasTouch && isSmallScreen;
}

//==============================================================================================
/**
 * Checks if the current page is an error page
 * @function isErrorPage
 * @returns {boolean} true if error page; else false
 * @description Checks for presence of error-message element to determine if page is an error page
 */
export function isErrorPage() {
    return !!document.querySelector('.error-message');
}

//==============================================================================================
/**
 * Check if browser supports SVG filters with backdrop-filter
 * BT 2025-10-24: is user agent still the most reliable way to figure this out?
 * @function supportsSVGFilters
 * @param {string} filterId - The filter ID to test
 * @returns {boolean} True if SVG filters are supported
 */
export function supportsSVGFilters(filterId) {
    const ua = navigator.userAgent || '';
    const isIOS = /iP(hone|ad|od)/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isFirefox = /Firefox/i.test(ua);
    const isWebkit = /Safari/.test(ua) && !/Chrome/.test(ua);

    // Force fallback on iOS/WebKit (Safari, Chrome on iOS, in-app WebViews like Instagram) and Firefox
    if (isIOS || isWebkit || isFirefox) {
        return false;
    }

    // Ensure backdrop-filter is supported at all
    const hasBackdrop = (window.CSS && (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)')));
    if (!hasBackdrop) {
        return false;
    }

    // Heuristic: property assignment acceptance (not fully reliable but sufficient for non-iOS Blink)
    const div = document.createElement('div');
    div.style.backdropFilter = `url(#${filterId})`;
    return div.style.backdropFilter !== '';
}

//==============================================================================================
/**
 * wait for a given number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after the given number of milliseconds
 */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//==============================================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // Minimal global pinch-zoom prevention (does not affect single-tap/double-tap)
    const isTouchEnv = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchEnv) {
        const preventIfPinch = (e) => {
            if (e.touches && e.touches.length > 1) {
                e.preventDefault();
            }
        };
        document.addEventListener('touchstart', preventIfPinch, { passive: false });
        document.addEventListener('touchmove', preventIfPinch, { passive: false });

        const preventGesture = (e) => { e.preventDefault(); };
        document.addEventListener('gesturestart', preventGesture, { passive: false });
        document.addEventListener('gesturechange', preventGesture, { passive: false });
        document.addEventListener('gestureend', preventGesture, { passive: false });
    }
    // Update URL path display
    const updateUrlPath = () => {
        const pathElement = document.querySelector('.url-path');
        if (pathElement) {
            const path = window.location.pathname;
            pathElement.textContent = path === '/' ? '/' : path;
        }
    };

    // Handle path option clicks with separate handlers for internal and external links
    const urlPaths = document.querySelector('.url-paths');
    if (urlPaths) {
        const internalLinks = document.querySelectorAll('.url-path-option:not(.url-external)');

        // Handle internal navigation
        internalLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const href = link.getAttribute('href');
                history.pushState({}, '', href);
                updateUrlPath();
            });
        });
    }

    // Handle mobile tap/click for URL display
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        navbar.addEventListener('click', (e) => {
            // Only toggle if we're on a mobile device (no hover capability)
            if (window.matchMedia('(hover: none)').matches) {
                navbar.classList.toggle('active');
            }
        });

        // Close the menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navbar.contains(e.target)) {
                navbar.classList.remove('active');
            }
        });
    }

    // Update initially and when the path changes
    updateUrlPath();
    window.addEventListener('popstate', updateUrlPath);
});
