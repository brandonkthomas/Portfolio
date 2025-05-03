/**
 * starfield.js
 * @fileoverview Three.js starfield background with warp effect
 * @description Creates an interactive starfield background with a triggerable warp effect using Three.js
 */

import { isMobile } from './common.js';
import { createCircleTexture } from './textures.js';
import { createNebulae, updateNebulae } from './nebulae.js';
import { generateStarColor, triggerWarpPulse, setupKonamiCode } from './starfieldUtils.js';

class Starfield {

    //==============================================================================================
    /**
     * Creates new starfield instance -- call init() to start the starfield effect
     * @constructor
     * @description Initializes a Three.js scene with a starfield background effect with triggerable warp effect
     * @property {THREE.Scene} scene - The Three.js scene containing the starfield
     * @property {THREE.PerspectiveCamera} camera - The camera used to view the scene
     * @property {THREE.WebGLRenderer} renderer - The renderer used to display the scene
     * @property {Array} stars - Array to store star objects
     * @property {number} starCount - Number of stars in the field
     * @property {number} starSize - Size of the stars (mobile-specific case for better visibility)
     * @property {Array} nebulae - Array to store nebula objects
     * @property {number} nebulaCount - Number of nebulae in the field
     * @property {THREE.Points} starField - The points object containing all stars
     * @property {number} warpIntensity - Current intensity of the warp effect (0-1)
     * @property {HTMLElement} cardContainer - Reference to the card container element
     * @property {number} minFrameInterval - Minimum frame interval to maintain 120fps
     * @property {number} maxFrameInterval - Maximum frame interval to prevent large gaps
     */
    constructor() {
        // Three.js setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#1A1A1A');
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('starfield'),
            antialias: true
        });

        // Star configuration
        this.stars = [];
        this.starCount = isMobile() ? 1500 : 2000;
        this.starField = null;
        this.warpIntensity = 0;
        this.cardContainer = document.querySelector('.card-container');
        this.starSize = isMobile() ? 0.2 : 0.15;

        // Nebula configuration
        this.nebulae = [];
        this.nebulaCount = isMobile() ? 8 : 12;

        // Konami code setup
        this.konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        this.konamiHandler = setupKonamiCode(this.konamiCode, () => this.triggerKonamiWarp());
        this.originalBackgroundColor = this.scene.background.clone();

        this.init();

        // Cap FPS to 120 without affecting motion timing
        this.minFrameInterval = 1000 / 120; // 1000ms / 120fps = ~8.33ms per frame max
        this.maxFrameInterval = 100;    // clamp large resume gaps to 100ms to prevent resets
        this.animate();
    }

    //==============================================================================================
    /**
     * Initialize the starfield effect
     * @description Sets up the renderer, creates the star field and trails, and sets up event listeners
     */
    init() {
        // Renderer setup
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio); // mobile-specific pixel ratio for better visibility
        this.camera.position.z = 5;

        // Create stars with varying colors and speeds
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const speeds = [];
        const originalSpeeds = []; // Store original speeds for warp effect
        const opacities = []; // Store opacity values for fade effect

        // Create a cylindrical distribution of stars
        for (let i = 0; i < this.starCount; i++) {
            // Create an even distribution along Z-axis first
            const z = -50 + (i / this.starCount) * 60; // Distribute evenly from -50 to +10 (matches reset point in animation code)

            // Cylindrical coordinates with wider distribution
            const radius = 8 + Math.random() * 20; // Increased range for more spread
            const theta = Math.random() * Math.PI * 2;

            // Convert to Cartesian coordinates
            const x = radius * Math.cos(theta);
            const y = radius * Math.sin(theta);

            positions.push(x, y, z);

            const color = generateStarColor();
            colors.push(color.r, color.g, color.b, 1.0); // Add alpha channel

            // Random speed between 0.01 and 0.05
            const speed = 0.01 + Math.random() * 0.05;
            speeds.push(speed);
            originalSpeeds.push(speed);
            opacities.push(1.0); // Start fully opaque
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); // 4 components for RGBA
        geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));
        geometry.setAttribute('originalSpeed', new THREE.Float32BufferAttribute(originalSpeeds, 1));
        geometry.setAttribute('opacity', new THREE.Float32BufferAttribute(opacities, 1));

        const material = new THREE.PointsMaterial({
            size: this.starSize, // mobile-specific size for better visibility
            vertexColors: true,
            transparent: true,
            map: createCircleTexture(),
            alphaTest: 0.1,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending, // used for fade-in when resetting stars to back of scene
            depthWrite: true  // Stars should write to depth buffer (required for correct draw order when also rendering nebulae)
        });

        this.starField = new THREE.Points(geometry, material);
        this.scene.add(this.starField);
        this.starMaterial = material;

        // Create nebulae (MUST come after stars to ensure correct draw order)
        this.nebulae = createNebulae(this.nebulaCount, this.scene);

        // Create trail geometry for warp pulse effect
        this.trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(this.starCount * 2 * 3);
        this.trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPositions, 3));
        const trailMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending
        });
        this.trails = new THREE.LineSegments(this.trailGeometry, trailMaterial);
        this.scene.add(this.trails);
        this.trailMaterial = trailMaterial;

        // Add card click detection
        this.setupClickDetection();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio); // mobile-specific pixel ratio for better visibility
        });
    }

    //==============================================================================================
    /**
     * Set up click detection for warp effect
     * @description Exposes a global function to trigger the warp effect
     */
    setupClickDetection() {
        // Allow card to trigger warp pulse
        window.triggerStarfieldWarp = () => {
            triggerWarpPulse((intensity) => {
                this.warpIntensity = intensity;
            });
        };
    }

    //==============================================================================================
    /**
     * Trigger Konami warp effect
     * @description Initiates a Konami warp that fades out over 5 seconds
     */
    triggerKonamiWarp() {
        console.log('todo');
    }

    //==============================================================================================
    /**
     * Main animation loop
     * @description Updates star positions, trails, and visual effects
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        const now = performance.now();
        // On first frame or after long background, initialize lastFrameTime
        if (this.lastFrameTime === undefined) {
            this.lastFrameTime = now;
            return;
        }
        const elapsed = now - this.lastFrameTime;
        // Skip frames too soon (capped at 120fps)
        if (elapsed < this.minFrameInterval) {
            return;
        }
        // Clamp huge elapsed times to avoid pushing all stars to the back
        const deltaMs = Math.min(elapsed, this.maxFrameInterval);
        const deltaTime = deltaMs / 1000;
        this.lastFrameTime = now;

        const positions = this.starField.geometry.attributes.position;
        const speeds = this.starField.geometry.attributes.speed;
        const originalSpeeds = this.starField.geometry.attributes.originalSpeed;
        const colors = this.starField.geometry.attributes.color;

        for (let i = 0; i < positions.count; i++) {
            // Calculate warp speed (up to 50x faster when warping)
            const warpSpeed = originalSpeeds.array[i] * (1 + this.warpIntensity * 299);
            speeds.array[i] = warpSpeed;

            // Move star using delta time
            positions.array[i * 3 + 2] += speeds.array[i] * deltaTime * 60; // Scale by 60 to maintain original speed

            // Apply stretch effect when warping - only stretch along Z axis
            if (this.warpIntensity > 0) {
                const stretchFactor = 1 + this.warpIntensity * 1;
                // Apply stretch by moving the star an additional distance
                positions.array[i * 3 + 2] += speeds.array[i] * (stretchFactor - 1) * deltaTime * 60;
            }

            // Reset star if it's too close
            if (positions.array[i * 3 + 2] > 10) {
                positions.array[i * 3 + 2] = -50;

                // Reset position maintaining original X and Y
                const radius = 8 + Math.random() * 20;
                const theta = Math.random() * Math.PI * 2;
                positions.array[i * 3 + 0] = radius * Math.cos(theta);
                positions.array[i * 3 + 1] = radius * Math.sin(theta);

                // Only start fade in if we're not warping 
                // (0.05 for a little bit of buffer toward the end when the warp is slowing down)
                if (this.warpIntensity < 0.05) {
                    colors.array[i * 4 + 3] = 0; // Set alpha to 0
                } else {
                    colors.array[i * 4 + 3] = 1; // Keep fully opaque during warp
                }
            }

            // Handle fade in only when not warping, using delta time
            if (this.warpIntensity === 0 && colors.array[i * 4 + 3] < 1) {
                colors.array[i * 4 + 3] = Math.min(1, colors.array[i * 4 + 3] + 0.4 * deltaTime); // 0.4 units per second
            }
        }

        positions.needsUpdate = true;
        speeds.needsUpdate = true;
        colors.needsUpdate = true;

        // Update nebulae positions
        updateNebulae(this.nebulae, deltaTime, this.warpIntensity);

        // Update subtle trails during warp pulse
        const trailPositions = this.trailGeometry.attributes.position.array;
        for (let i = 0; i < positions.count; i++) {
            const base3 = i * 3;
            const base6 = i * 6;
            const x = positions.array[base3];
            const y = positions.array[base3 + 1];
            const z = positions.array[base3 + 2];
            // Trail length scales with warpIntensity and star speed
            const trailLen = this.warpIntensity * speeds.array[i] * 5;
            // Start point at current star position
            trailPositions[base6] = x;
            trailPositions[base6 + 1] = y;
            trailPositions[base6 + 2] = z;
            // End point slightly behind along Z axis for faint trail
            trailPositions[base6 + 3] = x;
            trailPositions[base6 + 4] = y;
            trailPositions[base6 + 5] = z - trailLen;
        }
        this.trailGeometry.attributes.position.needsUpdate = true;

        // Subtle glow effect: scale star size and trail opacity during warp
        this.starField.material.size = this.starSize + this.warpIntensity * 0.05;
        this.trailMaterial.opacity = (isMobile() ? 0.225 : 0.1) + this.warpIntensity * 0.05;

        this.camera.position.z = 5;
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize starfield when the page loads
window.addEventListener('load', () => {
    new Starfield();
});