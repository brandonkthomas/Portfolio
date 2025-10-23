/**
 * common.js
 * @fileoverview Main site JavaScript functionality
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
 * Check user prefers-reduced-motion setting
 * @returns {boolean} True if user prefers reduced motion
 */
export function isReducedMotion() {
    try {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

//==============================================================================================
/**
 * Schedule a callback during browser idle time
 * @param {Function} cb - Callback to run when idle
 */
export function whenIdle(cb) {
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => cb());
    } else {
        // Small timeout to yield to TTI
        setTimeout(() => cb(), 60);
    }
}

//==============================================================================================
/**
 * Ensure THREE global is loaded (lazy-loads from CDN if needed)
 * @returns {Promise<any>} Resolves with window.THREE
 */
export function ensureThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (window.__threePromise) return window.__threePromise;

    const CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    window.__threePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = CDN_URL;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        script.onload = () => resolve(window.THREE);
        script.onerror = (e) => reject(new Error('Failed to load three.js'));
        document.head.appendChild(script);
    });
    return window.__threePromise;
}

//==============================================================================================
/**
 * Resolve when an element becomes visible in the viewport
 * @param {Element} el - Element to observe
 * @param {number} [threshold=0.01] - Intersection threshold
 * @returns {Promise<void>} Resolves once visible
 */
export function whenElementVisible(el, threshold = 0.01) {
    if (!el) return Promise.resolve();
    return new Promise((resolve) => {
        const io = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry && entry.isIntersecting) {
                io.disconnect();
                resolve();
            }
        }, { threshold });
        io.observe(el);
    });
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
 * @function supportsSVGFilters
 * @param {string} filterId - The filter ID to test
 * @returns {boolean} True if SVG filters are supported
 */
export function supportsSVGFilters(filterId) {
    const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);

    if (isWebkit || isFirefox) {
        return false;
    }

    const div = document.createElement('div');
    div.style.backdropFilter = `url(#${filterId})`;
    return div.style.backdropFilter !== '';
}

//==============================================================================================

document.addEventListener('DOMContentLoaded', () => {

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