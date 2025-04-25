//
// site.js
//
document.addEventListener('DOMContentLoaded', () => {

    // Card interaction code
    const card = document.querySelector('.card');
    if (card) {
        // Handle card click for flipping
        card.addEventListener('click', () => {
            card.classList.toggle('flipped');
        });

        // Handle mouse movement for perspective effect
        const cardContainer = document.querySelector('.card-container');
        const cardInner = document.querySelector('.card-inner');

        // Track first dynamic movement to allow initial smooth entry
        let isFirstMove = false;

        // Utility to compute and apply 3D transform
        const applyTransform = (clientX, clientY) => {
            const rect = cardContainer.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;
            cardInner.style.transform = `scale(1.05) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        };

        // On initial hover, enable transitions and apply the first transform smoothly
        cardContainer.addEventListener('mouseenter', (e) => {
            if (card.classList.contains('flipped')) return;
            cardInner.style.transition = '';
            isFirstMove = true;
            applyTransform(e.clientX, e.clientY);
        });

        // On movement, disable transition after the first smooth update for instant tracking
        cardContainer.addEventListener('mousemove', (e) => {
            if (card.classList.contains('flipped')) return;
            if (isFirstMove) {
                cardInner.style.transition = 'none';
                isFirstMove = false;
            }
            applyTransform(e.clientX, e.clientY);
        });

        // Reset transform when mouse leaves
        cardContainer.addEventListener('mouseleave', () => {
            if (!card.classList.contains('flipped')) {
                // Restore CSS transition for smooth exit
                cardInner.style.transition = '';
                cardInner.style.transform = '';
            }
        });
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
        
        // External links use default browser behavior with target="_blank"...
        // No JavaScript intervention needed for external links
    }

    // Update initially and when the path changes
    updateUrlPath();
    window.addEventListener('popstate', updateUrlPath);
});
 