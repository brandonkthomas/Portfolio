//
// starfield.js
//
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
     * @property {THREE.Points} starField - The points object containing all stars
     * @property {number} warpIntensity - Current intensity of the warp effect (0-1)
     * @property {HTMLElement} cardContainer - Reference to the card container element
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
        this.starCount = 2000;
        this.starField = null;
        this.warpIntensity = 0;
        this.cardContainer = document.querySelector('.card-container');

        this.init();
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
        this.camera.position.z = 5;

        // Create stars with varying colors and speeds
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const speeds = [];
        const originalSpeeds = []; // Store original speeds for warp effect
        const opacities = []; // Store opacity values for fade effect

        const generateOffWhiteColor = () => {
            // Generate subtle variations of white
            const hue = Math.random() * 360; // Any hue
            const saturation = Math.random() * 0.1; // Very low saturation (0-10%)
            const lightness = 0.95 + Math.random() * 0.05; // Very high lightness (95-100%)

            const color = new THREE.Color();
            color.setHSL(hue / 360, saturation, lightness);
            return color;
        };

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

            const color = generateOffWhiteColor();
            colors.push(color.r, color.g, color.b, 1.0); // Add alpha channel

            // Random speed between 0.01 and 0.02
            const speed = 0.01 + Math.random() * 0.01;
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
            size: 0.15,
            vertexColors: true,
            transparent: true,
            map: this.createCircleTexture(),
            alphaTest: 0.1,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending, // used for fade-in when resetting stars to back of scene
            depthWrite: false
        });

        this.starField = new THREE.Points(geometry, material);
        this.scene.add(this.starField);
        this.starMaterial = material;

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
            this.triggerWarpPulse();
        };
    }

    //==============================================================================================
    /**
     * Trigger warp effect
     * @description Initiates a warp pulse that fades out over 0.5 seconds
     */
    triggerWarpPulse() {
        // Set warp intensity to 1 immediately
        this.warpIntensity = 1;

        // smooth fade out over 0.5 seconds
        const startTime = Date.now();
        const duration = 500;

        const fadeOut = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // easeOutQuart for smoother deceleration at the end
            this.warpIntensity = Math.pow(1 - progress, 4);

            if (progress < 1) {
                requestAnimationFrame(fadeOut);
            }
        };

        requestAnimationFrame(fadeOut);
    }

    //==============================================================================================
    /**
     * Create a circular texture for stars
     * @description Creates a canvas with a radial gradient for star appearance
     * @returns {THREE.Texture} The created texture
     */
    createCircleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;

        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, 32, 32);

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    //==============================================================================================
    /**
     * Main animation loop
     * @description Updates star positions, trails, and visual effects
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        const positions = this.starField.geometry.attributes.position;
        const speeds = this.starField.geometry.attributes.speed;
        const originalSpeeds = this.starField.geometry.attributes.originalSpeed;
        const colors = this.starField.geometry.attributes.color;

        for (let i = 0; i < positions.count; i++) {
            // Calculate warp speed (up to 50x faster when warping)
            const warpSpeed = originalSpeeds.array[i] * (1 + this.warpIntensity * 299);
            speeds.array[i] = warpSpeed;

            // Move star
            positions.array[i * 3 + 2] += speeds.array[i];

            // Apply stretch effect when warping - only stretch along Z axis
            if (this.warpIntensity > 0) {
                const stretchFactor = 1 + this.warpIntensity * 1;
                // Apply stretch by moving the star an additional distance
                positions.array[i * 3 + 2] += speeds.array[i] * (stretchFactor - 1);
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

            // Handle fade in only when not warping
            if (this.warpIntensity === 0 && colors.array[i * 4 + 3] < 1) {
                colors.array[i * 4 + 3] = Math.min(1, colors.array[i * 4 + 3] + 0.00667); // 150ms fade in (0.00667 per frame at 60fps)
            }
        }

        positions.needsUpdate = true;
        speeds.needsUpdate = true;
        colors.needsUpdate = true;

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
        this.starField.material.size = 0.15 + this.warpIntensity * 0.05;
        this.trailMaterial.opacity = 0.1 + this.warpIntensity * 0.05;

        this.camera.position.z = 5;
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize starfield when the page loads
window.addEventListener('load', () => {
    new Starfield();
});