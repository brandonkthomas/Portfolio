//
// site.js
//
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
    const urlDisplay = document.querySelector('.url-display');
    if (urlDisplay) {
        urlDisplay.addEventListener('click', (e) => {
            // Only toggle if we're on a mobile device (no hover capability)
            if (window.matchMedia('(hover: none)').matches) {
                urlDisplay.classList.toggle('active');
            }
        });

        // Close the menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!urlDisplay.contains(e.target)) {
                urlDisplay.classList.remove('active');
            }
        });
    }

    // Update initially and when the path changes
    updateUrlPath();
    window.addEventListener('popstate', updateUrlPath);
});