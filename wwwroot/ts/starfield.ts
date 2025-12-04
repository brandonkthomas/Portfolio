/**
 * starfield.js
 * @fileoverview Three.js starfield background with warp effect
 * @description Creates an interactive starfield background with a triggerable warp effect using Three.js
 */

import { isMobile, isErrorPage, logEvent, LogData, LogLevel } from './common';
import { createCircleTexture } from './textures';
import { createNebulae, updateNebulae, reduceNebulaOpacity, restoreNebulaOpacity } from './nebulae';
import perf from './perfMonitor';
import { onPhotoLightboxStateChange } from './photoLightbox';

// DEBUG FLAG: if true, show animated gradient instead of starfield (for testing glass material behavior/interactions)
const DEBUG_GRADIENT = false;

class Starfield {
    private scene: any;
    private camera: any;
    private renderer: any;

    private stars: any[];
    private starCount: number;
    private starField: any;
    private starSize: number;
    private starDirection: number;
    private cardContainer: HTMLElement | null;

    // Rear-center core configuration
    private coreBackZThreshold: number;
    private coreCullZ: number;
    private coreFadeRange: number;
    private coreBackRadiusMax: number;

    // Nebulae
    private nebulae: any[];
    private nebulaCount: number;

    // Debug gradient
    private debugGradientPlane: any;
    private gradientTime: number;
    private debugGradientCanvas: any;
    private debugGradientTexture: any;

    // Konami
    private konamiCode: string[];
    private konamiHandler: any;
    private originalBackgroundColor: any;

    // Error page glow
    private isErrorPage: boolean;
    private redGlowEffect: any;
    private redGlowIntensity: number;
    private glowStartTime: number;
    private glowFadeDuration: number;

    // Readiness and timing
    private readyPromise: Promise<void>;
    private _resolveReady: (() => void) | null = null;
    private minFrameInterval: number;
    private defaultFrameInterval: number;
    private maxFrameInterval: number;
    private lastFrameTime: number | undefined;

    // Trails
    private trailGeometry: any;
    private trails: any;
    private warpIntensity: number;
    private starMaterial: any;
    private trailMaterial: any;

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
     * @property {THREE.Mesh} debugGradientPlane - Debug gradient plane for testing blur effects
     * @property {number} gradientTime - Time accumulator for gradient animation
     */
    constructor() {
        // Three.js setup
        this.scene = new THREE.Scene();
        this.scene.background = DEBUG_GRADIENT ? new THREE.Color('#000000') : new THREE.Color('#1C1C1C');
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('starfield') as HTMLCanvasElement | undefined,
            antialias: true
        });

        // Star configuration
        this.stars = [];
        this.starCount = isMobile() ? 1500 : 2000;
        this.starField = null;
        this.warpIntensity = 0;
        this.starDirection = 1; // 1 for forward, -1 for reverse
        this.cardContainer = document.querySelector('.card-container');
        this.starSize = isMobile() ? 0.2 : 0.15;

        // Rear-center core population to fill back-center gap
        // Stars spawned in the far back slice close to the axis
        this.coreBackZThreshold = -45; // stars with z below this are considered rear-center core
        this.coreCullZ = -25;          // before reaching this, core stars will be faded and reset
        this.coreFadeRange = 8;        // range (in Z) over which core stars fade out
        this.coreBackRadiusMax = 9.0;  // maximum radius for rear-center core stars

        // Nebula configuration
        this.nebulae = [];
        this.nebulaCount = isMobile() ? 8 : 12;

        // Debug gradient setup
        this.debugGradientPlane = null;
        this.gradientTime = 0;

        // Konami code setup
        this.konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        this.konamiHandler = this.setupKonamiCode(this.konamiCode, () => this.triggerKonamiWarp());
        this.originalBackgroundColor = (this.scene.background as any).clone();
        
        // Check if this is an error page and setup red glow effect
        this.isErrorPage = isErrorPage();
        this.redGlowEffect = null;
        this.redGlowIntensity = 0;
        this.glowStartTime = 0;
        this.glowFadeDuration = 600; // Extended to 600ms
        
        this.init();

        // Cap FPS to 120 without affecting motion timing
        this.defaultFrameInterval = 1000 / 120;
        this.minFrameInterval = this.defaultFrameInterval; // cap at 120fps by default
        this.maxFrameInterval = 100;    // clamp large resume gaps to 100ms to prevent resets
        
        // Start background glow for error pages after a delay (skip in debug mode)
        if (this.isErrorPage && !DEBUG_GRADIENT) {
            this.setRedBackgroundGlow();
            this.glowStartTime = performance.now(); // Remove delay to sync with CSS animation
            this.log('Error Glow Activated');
        }
        
        this.readyPromise = new Promise((resolve) => {
            this._resolveReady = resolve;
        });

        this.animate();
        this.log('Starfield Created', {
            starCount: this.starCount,
            nebulae: this.nebulaCount
        });
    }

    private log(event: string, data?: LogData, note?: string, level: LogLevel = 'info') {
        logEvent('starfield', event, data, note, level);
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
        this.log('Renderer Configured', {
            width: window.innerWidth,
            height: window.innerHeight
        });

        // Create stars with varying colors and speeds
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const speeds = [];
        const originalSpeeds = []; // Store original speeds for warp effect
        const opacities = []; // Store opacity values for fade effect
        const coreBackFlags = []; // 1 if star belongs to rear-center core group

        // Create a cylindrical distribution of stars, with a special rear-center core fill
        for (let i = 0; i < this.starCount; i++) {
            // Create an even distribution along Z-axis first
            const z = -50 + (i / this.starCount) * 60; // Distribute evenly from -50 to +10 (matches reset point in animation code)

            // Choose distribution based on back-slice membership
            const isCoreBack = z < this.coreBackZThreshold;
            let radius, theta;
            if (isCoreBack) {
                // Dense near-axis distribution using sqrt for uniform area density
                radius = Math.sqrt(Math.random()) * this.coreBackRadiusMax;
                theta = Math.random() * Math.PI * 2;
            } else {
                // Cylindrical coordinates with wider distribution
                radius = 8 + Math.random() * 20; // Increased range for more spread
                theta = Math.random() * Math.PI * 2;
            }

            // Convert to Cartesian coordinates
            const x = radius * Math.cos(theta);
            const y = radius * Math.sin(theta);

            positions.push(x, y, z);
            coreBackFlags.push(isCoreBack ? 1 : 0);

            const color = this.generateStarColor();
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
        geometry.setAttribute('coreBack', new THREE.Float32BufferAttribute(coreBackFlags, 1));

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
        this.log('Stars Created', { starCount: this.starCount });

        // Create debug gradient if enabled (will be behind stars)
        if (DEBUG_GRADIENT) {
            this.createDebugGradient();
            this.log('Debug Gradient Enabled');
        }

        // Create nebulae (MUST come after stars to ensure correct draw order)
        this.nebulae = createNebulae(this.nebulaCount, this.scene);
        this.log('Nebulae Created', { count: this.nebulae.length });
        
        // Hide nebulae in debug mode for clearer gradient visualization
        if (DEBUG_GRADIENT) {
            this.nebulae.forEach((nebula: any) => {
                if (nebula) {
                    nebula.visible = false;
                }
            });
        }
        
        // If error page, reduce nebulae opacity
        if (this.isErrorPage) {
            this.nebulae.forEach((nebula: any) => {
                if (nebula && nebula.material) {
                    const originalOpacity = nebula.material.opacity || 1.0;
                    nebula.material.opacity = originalOpacity * 0.01;
                }
            });
            this.log('Nebulae Dimmed For Error Page');
        }

        // Create trail geometry for warp pulse effect
        this.trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(this.starCount * 2 * 3);
        this.trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPositions, 3));
        const trailMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending,
            // Match line width to star diameter
            linewidth: this.starSize
        });
        this.trails = new THREE.LineSegments(this.trailGeometry, trailMaterial);
        this.scene.add(this.trails);
        this.trailMaterial = trailMaterial;
        this.log('Trails Initialized');

        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio); // mobile-specific pixel ratio for better visibility
            this.log('Renderer Resized', { width: window.innerWidth, height: window.innerHeight });
        });
    }

    //==============================================================================================
    /**
     * Trigger the warp pulse effect
     * @param {boolean} reverse - When true, warp direction is reversed (away from camera)
     */
    triggerWarp(reverse: boolean = false) {
        this.log('Warp Triggered', { reverse: Number(reverse) });
        this.triggerWarpPulse((intensity) => {
            this.warpIntensity = intensity;
        }, reverse);
    }

    //==============================================================================================
    /**
     * Trigger warp effect
     * @param {function} setWarpIntensity - Function to set warp intensity
     * @param {boolean} reverse - If true, warp direction is reversed (default: false)
     * @description Initiates a warp pulse that fades out over 0.5 seconds
     */
    triggerWarpPulse(setWarpIntensity: (value: number) => void, reverse: boolean = false): void {
        this.log('Warp Pulse Start', { reverse: Number(reverse) });
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
     * Set star movement direction
     * @param {number} direction - 1 for forward (toward camera), -1 for reverse (away from camera)
     * @description Changes the direction stars move
     */
    setStarDirection(direction: number) {
        this.starDirection = direction >= 0 ? 1 : -1;
        this.log('Star Direction Set', { direction: this.starDirection });
    }

    //==============================================================================================
    /**
     * Trigger Konami warp effect
     * @description Initiates a Konami warp that fades out over 5 seconds
     */
    triggerKonamiWarp() {
        this.log('Konami Warp Triggered');
    }

    //==============================================================================================
    /**
     * Reduce star count for photo gallery view
     * @description Gradually reduces stars to 30% of original count
     */
    reduceStars() {
        if (!this.starField) return;

        const positions = this.starField.geometry.attributes.position;
        const colors = this.starField.geometry.attributes.color;
        const targetCount = Math.floor(this.starCount * 0.3);

        // Fade out stars beyond target count
        for (let i = targetCount; i < positions.count; i++) {
            // Set alpha to 0 to hide stars
            colors.array[i * 4 + 3] = 0;
        }

        colors.needsUpdate = true;

        // Reduce nebula opacity
        reduceNebulaOpacity(this.nebulae, 0.3);
        this.log('Stars Reduced', { target: Math.floor(this.starCount * 0.3) });
    }

    //==============================================================================================
    /**
     * Restore star count to original
     * @description Gradually restores all stars to full visibility
     */
    restoreStars() {
        if (!this.starField) return;

        const colors = this.starField.geometry.attributes.color;

        // Restore all stars
        for (let i = 0; i < colors.count; i++) {
            colors.array[i * 4 + 3] = 1.0;
        }

        colors.needsUpdate = true;

        // Restore nebula opacity
        restoreNebulaOpacity(this.nebulae);
        this.log('Stars Restored', { count: this.starCount });
    }

    //==============================================================================================
    /**
     * Generate a random star color
     * @returns {THREE.Color} The generated color
     */
    generateStarColor(): any {
        const hue = Math.random() * 360; // Full hue range for rainbow
        const saturation = 0.08 + Math.random() * 0.05; // Low saturation (8-15%)
        const lightness = 0.5 + Math.random() * 0.2; // Medium-high lightness (50-70%)

        const color = new THREE.Color();
        color.setHSL(hue / 360, saturation, lightness);
        return color;
    }

    //==============================================================================================
    /**
     * Create red glow effect for error pages
     * @description Creates a red glow effect in the center of the screen resembling the PS2 error screen
     */
    setRedBackgroundGlow() {
        // Create a circular gradient texture for the glow
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        
        // Create radial gradient
        const gradient = context.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        
        // Set gradient colors - more subtle
        gradient.addColorStop(0, 'rgba(160, 0, 0, 0.3)'); // Less intense core
        gradient.addColorStop(0.4, 'rgba(120, 0, 0, 0.15)'); // Middle of the glow
        gradient.addColorStop(1, 'rgba(60, 0, 0, 0)'); // Outer edge of the glow
        
        // Fill canvas with gradient
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Create texture from canvas
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        
        // Create material and mesh for the glow
        const glowMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        
        // Create sprite and position it in the scene
        this.redGlowEffect = new THREE.Sprite(glowMaterial);
        this.redGlowEffect.scale.set(90, 90, 1); // Larger size to be more ambient
        this.redGlowEffect.position.set(0, 0, -40); // Positioned further behind
        this.scene.add(this.redGlowEffect);
        this.log('Red Glow Sprite Active');
    }

    //==============================================================================================
    /**
     * Create debug gradient for testing blur effects
     * @description Creates an animated multicolored gradient plane to test overlay blur functionality
     */
    createDebugGradient() {
        // Create a plane geometry that fills the screen
        const geometry = new THREE.PlaneGeometry(100, 100);
        
        // Create canvas for dynamic gradient
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        this.debugGradientCanvas = canvas;
        this.debugGradientTexture = texture;
        
        // Create material
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide
        });
        
        // Create mesh and position it (behind all stars)
        this.debugGradientPlane = new THREE.Mesh(geometry, material);
        this.debugGradientPlane.position.set(0, 0, -60);
        this.scene.add(this.debugGradientPlane);
        
        // Initial gradient render
        this.updateDebugGradient();
    }

    //==============================================================================================
    /**
     * Update debug gradient animation
     * @description Updates the gradient colors based on time for animation
     */
    updateDebugGradient() {
        if (!this.debugGradientCanvas) return;
        
        const context = this.debugGradientCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        const width = this.debugGradientCanvas.width;
        const height = this.debugGradientCanvas.height;
        
        // Create animated linear gradient
        const angle = this.gradientTime * 0.5;
        const x1 = width / 2 + Math.cos(angle) * width;
        const y1 = height / 2 + Math.sin(angle) * height;
        const x2 = width / 2 - Math.cos(angle) * width;
        const y2 = height / 2 - Math.sin(angle) * height;
        
        const gradient = context.createLinearGradient(x1, y1, x2, y2);
        
        // Animated color stops
        const hue1 = (this.gradientTime * 20) % 360;
        const hue2 = (this.gradientTime * 20 + 120) % 360;
        const hue3 = (this.gradientTime * 20 + 240) % 360;
        
        gradient.addColorStop(0, `hsl(${hue1}, 70%, 50%)`);
        gradient.addColorStop(0.5, `hsl(${hue2}, 70%, 50%)`);
        gradient.addColorStop(1, `hsl(${hue3}, 70%, 50%)`);
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        
        this.debugGradientTexture.needsUpdate = true;
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

        // Performance monitor: frame start
        perf.loopFrameStart('starfield');

        // Update debug gradient if enabled (background animation)
        if (DEBUG_GRADIENT) {
            this.gradientTime += deltaTime;
            this.updateDebugGradient();
        }

        // Handle red glow effect for error pages
        if (this.isErrorPage && this.redGlowEffect && this.glowStartTime > 0) {
            const fadeElapsed = now - this.glowStartTime;
            // Apply ease-out using quadratic function
            const t = Math.min(fadeElapsed / this.glowFadeDuration, 1);
            const eased = 1 - (1 - t) * (1 - t); // Quadratic ease-out
            
            // Apply final values smoothly without a separate end state
            this.redGlowEffect.material.opacity = 0.7 * eased;
            const startColor = new THREE.Color('#1c1c1c');
            const endColor = new THREE.Color('#220000');
            this.scene.background = startColor.lerp(endColor, 0.5 * eased);
            this.redGlowEffect.scale.set(90, 90, 1);
        }

        const positions = this.starField.geometry.attributes.position;
        const speeds = this.starField.geometry.attributes.speed;
        const originalSpeeds = this.starField.geometry.attributes.originalSpeed;
        const colors = this.starField.geometry.attributes.color;
        const coreBack = this.starField.geometry.attributes.coreBack;

        // Stars update loop segment start
        const segStars = perf.segmentStart('starfield', 'update-stars');
        for (let i = 0; i < positions.count; i++) {
            // Calculate warp speed (up to 50x faster when warping)
            const absWarpIntensity = Math.abs(this.warpIntensity);
            const warpSpeed = originalSpeeds.array[i] * (1 + absWarpIntensity * 299);
            speeds.array[i] = warpSpeed;

            // Move star using delta time with direction
            positions.array[i * 3 + 2] += speeds.array[i] * deltaTime * 60 * this.starDirection; // Scale by 60 to maintain original speed

            // Apply stretch effect when warping - only stretch along Z axis
            if (absWarpIntensity > 0) {
                const stretchFactor = 1 + absWarpIntensity * 1;
                // Apply stretch by moving the star an additional distance
                positions.array[i * 3 + 2] += speeds.array[i] * (stretchFactor - 1) * deltaTime * 60 * this.starDirection;
            }

            // Special handling for rear-center core stars to avoid the card area
            if (coreBack.array[i] > 0) {
                const z = positions.array[i * 3 + 2];
                
                if (this.starDirection > 0) {
                    // Moving forward: fade out and cull before reaching card
                    // Fade out as we approach the cull plane
                    if (z > (this.coreCullZ - this.coreFadeRange) && z < this.coreCullZ) {
                        if (absWarpIntensity < 0.05) {
                            const t = (z - (this.coreCullZ - this.coreFadeRange)) / this.coreFadeRange; // 0=>1
                            const fade = Math.max(0, 1 - t);
                            const baseIndex = i * 4 + 3;
                            colors.array[baseIndex] = Math.min(colors.array[baseIndex], fade);
                        }
                    }
                    // Cull before reaching the card depth
                    if (z >= this.coreCullZ) {
                        // Send back to far rear slice and keep near-axis radius
                        positions.array[i * 3 + 2] = -50;
                        const r = Math.sqrt(Math.random()) * this.coreBackRadiusMax;
                        const th = Math.random() * Math.PI * 2;
                        positions.array[i * 3 + 0] = r * Math.cos(th);
                        positions.array[i * 3 + 1] = r * Math.sin(th);
                        if (absWarpIntensity < 0.05) {
                            colors.array[i * 4 + 3] = 0; // fade back in from the rear
                        } else {
                            colors.array[i * 4 + 3] = 1;
                        }
                        continue; // skip normal reset handling for this star this frame
                    }
                } else {
                    // Moving backward: fade out and cull when getting too far back
                    const fadeBackStart = this.coreBackZThreshold - this.coreFadeRange;
                    if (z < fadeBackStart) {
                        if (absWarpIntensity < 0.05) {
                            const t = (fadeBackStart - z) / this.coreFadeRange; // 0=>1
                            const fade = Math.max(0, 1 - t);
                            const baseIndex = i * 4 + 3;
                            colors.array[baseIndex] = Math.min(colors.array[baseIndex], fade);
                        }
                    }
                    // Cull when too far back and respawn at front with near-axis distribution
                    if (z <= (this.coreBackZThreshold - this.coreFadeRange)) {
                        positions.array[i * 3 + 2] = 10;
                        const r = Math.sqrt(Math.random()) * this.coreBackRadiusMax;
                        const th = Math.random() * Math.PI * 2;
                        positions.array[i * 3 + 0] = r * Math.cos(th);
                        positions.array[i * 3 + 1] = r * Math.sin(th);
                        if (absWarpIntensity < 0.05) {
                            colors.array[i * 4 + 3] = 0; // fade in from front
                        } else {
                            colors.array[i * 4 + 3] = 1;
                        }
                        continue; // skip normal reset handling for this star this frame
                    }
                }
            }

            // Reset star based on direction
            const shouldReset = this.starDirection > 0 ? positions.array[i * 3 + 2] > 10 : positions.array[i * 3 + 2] < -50;
            if (shouldReset) {
                // Reset to opposite end based on direction
                const resetToBack = this.starDirection > 0;
                positions.array[i * 3 + 2] = resetToBack ? -50 : 10;

                // Reset position, using near-axis distribution for coreBack stars when sent to back
                let radius, theta;
                if (resetToBack && coreBack.array[i] > 0) {
                    radius = Math.sqrt(Math.random()) * this.coreBackRadiusMax;
                    theta = Math.random() * Math.PI * 2;
                } else {
                    radius = 8 + Math.random() * 20;
                    theta = Math.random() * Math.PI * 2;
                }
                positions.array[i * 3 + 0] = radius * Math.cos(theta);
                positions.array[i * 3 + 1] = radius * Math.sin(theta);

                // Only start fade in if we're not warping 
                // (0.05 for a little bit of buffer toward the end when the warp is slowing down)
                if (absWarpIntensity < 0.05) {
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
        perf.segmentEnd(segStars);

        positions.needsUpdate = true;
        speeds.needsUpdate = true;
        colors.needsUpdate = true;

        // Update nebulae positions
        const segNebulae = perf.segmentStart('starfield', 'update-nebulae');
        updateNebulae(this.nebulae, deltaTime, this.warpIntensity, this.starDirection);
        perf.segmentEnd(segNebulae);

        // Update subtle trails during warp pulse
        const segTrails = perf.segmentStart('starfield', 'update-trails');
        const trailPositions = this.trailGeometry.attributes.position.array;
        for (let i = 0; i < positions.count; i++) {
            const base3 = i * 3;
            const base6 = i * 6;
            const x = positions.array[base3];
            const y = positions.array[base3 + 1];
            const z = positions.array[base3 + 2];
            // Trail length scales with warpIntensity and star speed
            const absWarpIntensityTrail = Math.abs(this.warpIntensity);
            const trailLen = absWarpIntensityTrail * speeds.array[i] * 5;
            // Start point at current star position
            trailPositions[base6] = x;
            trailPositions[base6 + 1] = y;
            trailPositions[base6 + 2] = z;
            // End point behind the star based on direction of travel (opposite of starDirection)
            trailPositions[base6 + 3] = x;
            trailPositions[base6 + 4] = y;
            trailPositions[base6 + 5] = z - (trailLen * this.starDirection);
        }
        this.trailGeometry.attributes.position.needsUpdate = true;
        perf.segmentEnd(segTrails);

        // Subtle glow effect: scale star size and trail opacity during warp
        const absWarpIntensity = Math.abs(this.warpIntensity);
        this.starField.material.size = this.starSize + absWarpIntensity * 0.05;
        this.trailMaterial.opacity = (isMobile() ? 0.225 : 0.1) + absWarpIntensity * 0.05;
        
        // Keep trail thickness matched to current star diameter
        this.trailMaterial.linewidth = this.starField.material.size;
        this.trailMaterial.needsUpdate = true;

        this.camera.position.z = 5;
        const segRender = perf.segmentStart('starfield', 'render');
        this.renderer.render(this.scene, this.camera);
        perf.segmentEnd(segRender);

        // Signal to subscribers that the starfield is ready
        if (this._resolveReady) {
            this._resolveReady();
            this._resolveReady = null;
            this.log('Starfield Ready');
        }
        // Perf: frame end
        perf.loopFrameEnd('starfield');
    }

    //==============================================================================================
    /**
     * Set the frame cap for the starfield
     * @param {number} fps - The frame rate to cap the starfield at
     */
    setFrameCap(fps: number | null) {
        if (fps && fps > 0) {
            this.minFrameInterval = 1000 / fps;
        } else {
            this.minFrameInterval = this.defaultFrameInterval;
        }
        this.log('Frame Cap Updated', { fps: fps ?? 0 });
    }

    //==============================================================================================
    /**
     * Handle Konami code detection and warp effect
     * @param {Array} konamiCode - Array of keys for the Konami code sequence
     * @param {function} triggerWarpCallback - Function to call when Konami code is detected
     * @returns {object} Konami code handler object with methods
     */
    setupKonamiCode(konamiCode: string[], triggerWarpCallback: () => void): {
        setKonamiWarpActive: (active: boolean) => void;
        getKonamiWarpActive: () => boolean;
        resetKonamiIndex: () => void;
    } {
        let konamiIndex = 0;
        let isKonamiWarpActive = false;

        const keydownHandler = (event: KeyboardEvent) => {
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
            setKonamiWarpActive: (active: boolean) => {
                isKonamiWarpActive = active;
            },
            getKonamiWarpActive: () => isKonamiWarpActive,
            resetKonamiIndex: () => {
                konamiIndex = 0;
            }
        };
    }
}

// Initialize starfield when the page loads and expose to state manager
let starfieldInstance: any = null;
let pendingFrameCap: number | null = null;

//==============================================================================================
/**
 * Initialize starfield when page loads + expose to state manager
 */
window.addEventListener('load', () => {
    starfieldInstance = new Starfield();
    if (pendingFrameCap !== null) {
        starfieldInstance.setFrameCap(pendingFrameCap);
    }

    // Expose to window for stateManager
    (window as any).starfieldInstance = starfieldInstance;
    logEvent('starfield', 'Instance Mounted');
});

//==============================================================================================
/**
 * Exported function to trigger the starfield warp effect
 * @param {boolean} reverse - When true, warp direction is reversed (away from camera)
 */
export function triggerStarfieldWarp(reverse: boolean = false) {
    if (starfieldInstance && typeof (starfieldInstance as any).triggerWarp === 'function') {
        (starfieldInstance as any).triggerWarp(reverse);
    }
}

//==============================================================================================
/**
 * Set the frame cap for the starfield
 * @param {number} fps - The frame rate to cap the starfield at
 */
export function setStarfieldFrameCap(fps: number | null) {
    pendingFrameCap = fps;
    if (starfieldInstance && typeof starfieldInstance.setFrameCap === 'function') {
        starfieldInstance.setFrameCap(fps);
    }
}

//==============================================================================================
/**
 * Handle photo lightbox state change
 * @param {string} state - The state of the photo lightbox
 */
onPhotoLightboxStateChange(state => {
    const fps = state === 'open' ? 30 : null;
    logEvent('starfield', 'Lightbox Frame Cap Sync', { fps: fps ?? 0, lightboxState: state });
    setStarfieldFrameCap(fps);
});
