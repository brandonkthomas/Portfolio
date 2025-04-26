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
        this.starCount = this.detectMobile() ? 1500 : 2000;
        this.starField = null;
        this.warpIntensity = 0;
        this.cardContainer = document.querySelector('.card-container');
        this.starSize = this.detectMobile() ? 0.2 : 0.15;

        // Konami code setup
        this.konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        this.konamiIndex = 0;
        this.isKonamiWarpActive = false;
        this.originalBackgroundColor = this.scene.background.clone();

        // Create gradient texture for background
        this.gradientRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        this.gradientScene = new THREE.Scene();
        this.gradientCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // Create gradient mesh
        const gradientGeometry = new THREE.PlaneGeometry(2, 2);
        const gradientMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: {
                    value: 0
                },
                resolution: {
                    value: new THREE.Vector2(window.innerWidth, window.innerHeight)
                }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec2 resolution;
                varying vec2 vUv;
                
                // Define more distinct colors
                vec3 color1 = vec3(1.0, 0.0, 0.8);   // Hot Pink
                vec3 color2 = vec3(0.0, 1.0, 1.0);   // Cyan
                vec3 color3 = vec3(0.8, 0.0, 1.0);   // Purple
                vec3 color4 = vec3(1.0, 0.8, 0.0);   // Gold
                vec3 color5 = vec3(0.0, 0.8, 0.4);   // Emerald
                
                vec2 rotate2D(vec2 p, float angle) {
                    float s = sin(angle);
                    float c = cos(angle);
                    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
                }
                
                void main() {
                    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
                    
                    // Create rotating coordinate systems
                    vec2 uv1 = rotate2D(uv, time * 0.2);
                    vec2 uv2 = rotate2D(uv, -time * 0.3);
                    vec2 uv3 = rotate2D(uv, time * 0.4);
                    
                    // Create distinct gradient regions
                    float d1 = length(uv1) * 2.0;
                    float d2 = length(uv2) * 1.5;
                    float d3 = length(uv3) * 1.8;
                    
                    // Create animated waves
                    float wave1 = sin(d1 * 4.0 - time) * 0.5 + 0.5;
                    float wave2 = sin(d2 * 5.0 + time * 1.2) * 0.5 + 0.5;
                    float wave3 = sin(d3 * 3.0 - time * 0.8) * 0.5 + 0.5;
                    
                    // Mix colors with sharp transitions
                    vec3 finalColor = color1;
                    finalColor = mix(finalColor, color2, smoothstep(0.3, 0.7, wave1));
                    finalColor = mix(finalColor, color3, smoothstep(0.3, 0.7, wave2));
                    finalColor = mix(finalColor, color4, smoothstep(0.3, 0.7, wave3));
                    finalColor = mix(finalColor, color5, smoothstep(0.8, 1.0, (wave1 + wave2 + wave3) / 3.0));
                    
                    // Add brightness and contrast
                    finalColor = pow(finalColor, vec3(0.8)); // Increase contrast
                    finalColor *= 1.2; // Increase brightness
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        });

        this.gradientMesh = new THREE.Mesh(gradientGeometry, gradientMaterial);
        this.gradientScene.add(this.gradientMesh);

        this.init();
        this.animate();
    }

    //==============================================================================================
    /**
     * Detect if this is a mobile browser
     * @description Checks for touch capability and screen size
     * @returns {boolean} True if device is mobile
     */
    detectMobile() {
        // Check if device has touch capability
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Check screen width (768px as common breakpoint)
        const isSmallScreen = window.innerWidth <= 768;

        return hasTouch && isSmallScreen;
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
            this.triggerWarpPulse();
        };

        // Add Konami code detection
        document.addEventListener('keydown', (event) => {
            if (this.isKonamiWarpActive) return; // Ignore inputs during Konami warp

            // Check if the pressed key matches the next key in the sequence
            if (event.key === this.konamiCode[this.konamiIndex]) {
                this.konamiIndex++;

                // If the full sequence is entered
                if (this.konamiIndex === this.konamiCode.length) {
                    this.triggerKonamiWarp();
                    this.konamiIndex = 0; // Reset the sequence
                }
            } else {
                this.konamiIndex = 0; // Reset on wrong input
                // If the new key is the start of the sequence
                if (event.key === this.konamiCode[0]) {
                    this.konamiIndex = 1;
                }
            }
        });
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

        // Calculate frame delta time in seconds
        const now = performance.now();
        const deltaTime = (now - (this.lastFrameTime || now)) / 1000;
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
        this.trailMaterial.opacity = (this.detectMobile() ? 0.225 : 0.1) + this.warpIntensity * 0.05;

        // Enhanced trail effects during Konami warp
        if (this.isKonamiWarpActive) {
            for (let i = 0; i < positions.count; i++) {
                const base3 = i * 3;
                const base6 = i * 6;
                const x = positions.array[base3];
                const y = positions.array[base3 + 1];
                const z = positions.array[base3 + 2];

                // Create spiral effect during Konami warp
                const time = Date.now() * 0.001;
                const spiral = Math.sin(time + i * 0.1) * 0.5;
                trailPositions[base6] = x + spiral;
                trailPositions[base6 + 1] = y + spiral;
                trailPositions[base6 + 2] = z;
                trailPositions[base6 + 3] = x - spiral;
                trailPositions[base6 + 4] = y - spiral;
                trailPositions[base6 + 5] = z - (this.warpIntensity * speeds.array[i] * 10);
            }
            this.trailGeometry.attributes.position.needsUpdate = true;
        }

        // Update gradient background during Konami warp
        if (this.isKonamiWarpActive) {
            // Update gradient shader time
            this.gradientMesh.material.uniforms.time.value = Date.now() * 0.0005; // Slowed down for more visible transitions

            // Render gradient to texture
            this.renderer.setRenderTarget(this.gradientRenderTarget);
            this.renderer.render(this.gradientScene, this.gradientCamera);
            this.renderer.setRenderTarget(null);

            // Use gradient as background
            this.scene.background = this.gradientRenderTarget.texture;

            // Update star colors to match gradient regions
            const colors = this.starField.geometry.attributes.color;
            const positions = this.starField.geometry.attributes.position;
            const time = Date.now() * 0.001;

            for (let i = 0; i < colors.count; i++) {
                const x = positions.array[i * 3];
                const y = positions.array[i * 3 + 1];
                const z = positions.array[i * 3 + 2];

                // Create more dramatic color variations
                const angle = Math.atan2(y, x);
                const dist = Math.sqrt(x * x + y * y);

                const hue = (angle / (Math.PI * 2) + time * 0.1) % 1;
                const saturation = Math.min(1, dist * 0.5 + 0.5);
                const lightness = 0.7 + Math.sin(z * 0.1 + time) * 0.3;

                const color = new THREE.Color();
                color.setHSL(hue, saturation, lightness);

                colors.array[i * 4] = color.r;
                colors.array[i * 4 + 1] = color.g;
                colors.array[i * 4 + 2] = color.b;
            }
            colors.needsUpdate = true;
        }

        this.camera.position.z = 5;
        this.renderer.render(this.scene, this.camera);
    }

    //==============================================================================================
    /**
     * Trigger Konami warp effect
     * @description Initiates a Konami warp that fades out over 5 seconds
     */
    triggerKonamiWarp() {
        if (this.isKonamiWarpActive) return;

        console.log('triggerKonamiWarp');

        this.isKonamiWarpActive = true;
        this.warpIntensity = 3; // Reduced from 5 to slow down the streaks

        // Store original star properties
        const originalStarSize = this.starSize;
        const originalTrailOpacity = this.trailMaterial.opacity;

        // Update star material for blur effect
        this.starField.material.map = this.createBlurredStarTexture();
        this.starField.material.size = this.starSize * 4;

        // Update trail material for blur effect
        this.trailMaterial.opacity = 0.3;

        // Return to normal after 5 seconds
        setTimeout(() => {
            this.isKonamiWarpActive = false;
            this.warpIntensity = 0;
            this.scene.background = this.originalBackgroundColor;
            this.starField.material.size = originalStarSize;
            this.trailMaterial.opacity = originalTrailOpacity;
            this.starField.material.map = this.createCircleTexture(); // Reset to original texture

            // Reset star colors to white
            const colors = this.starField.geometry.attributes.color;
            for (let i = 0; i < colors.count; i++) {
                colors.array[i * 4] = 1;
                colors.array[i * 4 + 1] = 1;
                colors.array[i * 4 + 2] = 1;
                colors.array[i * 4 + 3] = 1;
            }
            colors.needsUpdate = true;
        }, 5000);
    }

    //==============================================================================================
    /**
     * Create a blurred star texture for Konami warp effect
     * @description Creates a canvas with a radial gradient for star appearance
     * @returns {THREE.Texture} The created texture
     */
    createBlurredStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; // Larger canvas for better blur effect
        canvas.height = 64;

        const context = canvas.getContext('2d');

        // Create main glow
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.4)');
        gradient.addColorStop(0.7, 'rgba(255,255,255,0.2)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);

        // Apply blur effect
        context.filter = 'blur(4px)';
        context.drawImage(canvas, 0, 0);

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
}

// Initialize starfield when the page loads
window.addEventListener('load', () => {
    new Starfield();
});