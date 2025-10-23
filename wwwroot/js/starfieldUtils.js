/**
 * starfieldUtils.js
 * @fileoverview Utility functions for starfield and warp effects
 */

//==============================================================================================
/**
 * Generate a random star color
 * @returns {THREE.Color} The generated color
 */
export function generateStarColor() {
    const hue = Math.random() * 360; // Full hue range for rainbow
    const saturation = 0.08 + Math.random() * 0.05; // Low saturation (8-15%)
    const lightness = 0.5 + Math.random() * 0.2; // Medium-high lightness (50-70%)

    const color = new THREE.Color();
    color.setHSL(hue / 360, saturation, lightness);
    return color;
}

//==============================================================================================
/**
 * Trigger warp effect
 * @param {function} setWarpIntensity - Function to set warp intensity
 * @param {boolean} reverse - If true, warp direction is reversed (default: false)
 * @description Initiates a warp pulse that fades out over 0.5 seconds
 */
export function triggerWarpPulse(setWarpIntensity, reverse = false) {
    // Set warp intensity to 1 immediately with direction
    setWarpIntensity(reverse ? -1 : 1);

    // smooth fade out over 0.5 seconds
    const startTime = Date.now();
    const duration = 500;

    const fadeOut = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // easeOutQuart for smoother deceleration at the end
        const intensity = Math.pow(1 - progress, 4);
        setWarpIntensity(reverse ? -intensity : intensity);

        if (progress < 1) {
            requestAnimationFrame(fadeOut);
        }
    };

    requestAnimationFrame(fadeOut);
}

//==============================================================================================
/**
 * Handle Konami code detection and warp effect
 * @param {Array} konamiCode - Array of keys for the Konami code sequence
 * @param {function} triggerWarpCallback - Function to call when Konami code is detected
 * @returns {object} Konami code handler object with methods
 */
export function setupKonamiCode(konamiCode, triggerWarpCallback) {
    let konamiIndex = 0;
    let isKonamiWarpActive = false;

    const keydownHandler = (event) => {
        if (isKonamiWarpActive) return; // Ignore inputs during Konami warp

        // Check if the pressed key matches the next key in the sequence
        if (event.key === konamiCode[konamiIndex]) {
            konamiIndex++;

            // If the full sequence is entered
            if (konamiIndex === konamiCode.length) {
                triggerWarpCallback();
                konamiIndex = 0; // Reset the sequence
            }
        } else {
            konamiIndex = 0; // Reset on wrong input
            // If the new key is the start of the sequence
            if (event.key === konamiCode[0]) {
                konamiIndex = 1;
            }
        }
    };

    // Add listener for Konami code
    document.addEventListener('keydown', keydownHandler);

    return {
        setKonamiWarpActive: (active) => {
            isKonamiWarpActive = active;
        },
        getKonamiWarpActive: () => isKonamiWarpActive,
        resetKonamiIndex: () => {
            konamiIndex = 0;
        }
    };
} 