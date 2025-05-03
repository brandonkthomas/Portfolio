/**
 * starfield.js
 * @fileoverview Three.js starfield background with warp effect
 * @description Creates an interactive starfield background with a triggerable warp effect using Three.js
 */

import {
    isMobile
} from './common.js';

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
        this.konamiIndex = 0;
        this.isKonamiWarpActive = false;
        this.originalBackgroundColor = this.scene.background.clone();

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
        this.renderer.setPixelRatio(window.devicePixelRatio); // mobile-specific pixel ratio for better visibility
        this.camera.position.z = 5;

        // Create stars with varying colors and speeds
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const speeds = [];
        const originalSpeeds = []; // Store original speeds for warp effect
        const opacities = []; // Store opacity values for fade effect

        const generateStarColor = () => {
            const hue = Math.random() * 360; // Full hue range for rainbow
            const saturation = 0.08 + Math.random() * 0.05; // Low saturation (8-15%)
            const lightness = 0.5 + Math.random() * 0.2; // Medium-high lightness (50-70%)

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
            map: this.createCircleTexture(),
            alphaTest: 0.1,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending, // used for fade-in when resetting stars to back of scene
            depthWrite: true  // Stars should write to depth buffer (required for correct draw order when also rendering nebulae)
        });

        this.starField = new THREE.Points(geometry, material);
        this.scene.add(this.starField);
        this.starMaterial = material;

        // Create nebulae (MUST come after stars to ensure correct draw order)
        this.createNebulae();

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
     * Creates nebula/dust cloud meshes and adds them to the scene
     * @description Generates cloud-like nebula meshes with random colors and positions
     */
    createNebulae() {
        // Track distribution
        const existingPositions = [];
        
        for (let i = 0; i < this.nebulaCount; i++) {
            // Create cloud-like sprite texture with irregular shape
            const texture = this.createNebulaTexture(false, i % 5); // Pass type parameter for shape variation
            
            // Create sprite with properly configured material for visibility without blocking stars
            const material = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                blending: THREE.AdditiveBlending,
                opacity: 0.02 + Math.random() * 0.02,
                depthTest: false,
                depthWrite: false
            });
            
            // Create color with higher brightness to make nebulae visible at low opacity (counteract the additive blending)
            const hue = Math.random();
            const color = new THREE.Color();
            
            color.setHSL(hue, 0.2 + Math.random() * 0.2, 0.7 + Math.random() * 0.2);
            material.color = color;
            
            const sprite = new THREE.Sprite(material);
            
            // Position nebulae throughout scene
            let x, y, z, isValidPosition = false;
            let attempts = 0;
            
            // Try to find position not too close to existing nebulae
            do {
                z = -75 + Math.random() * 60;
                const radius = 3 + Math.random() * 30; // Wider radius range for better spread
                const theta = Math.random() * Math.PI * 2;
                x = radius * Math.cos(theta);
                y = radius * Math.sin(theta);
                
                // Check if this position is far enough from existing nebulae
                isValidPosition = true;
                const minDistanceSquared = 100; // Minimum squared distance between centers
                
                for (const pos of existingPositions) {
                    const dx = x - pos.x;
                    const dy = y - pos.y;
                    const dz = z - pos.z;
                    const distSquared = dx*dx + dy*dy + dz*dz;
                    
                    if (distSquared < minDistanceSquared) {
                        isValidPosition = false;
                        break;
                    }
                }
                
                attempts++;
            } while (!isValidPosition && attempts < 10); // Limit attempts to avoid infinite loops
            
            // Store (then set) position
            existingPositions.push({x, y, z});
            sprite.position.set(x, y, z);
            
            // Non-uniform scaling for more organic shapes
            const baseScale = 5 + Math.random() * 10;
            const xScale = baseScale * (0.7 + Math.random() * 0.6);
            const yScale = baseScale * (0.7 + Math.random() * 0.6);
            sprite.scale.set(xScale, yScale, 1);
            
            // Random rotation for more varied appearance
            sprite.rotation.z = Math.random() * Math.PI * 2;
            
            // Random speed (even slower for background elements)
            const speed = 0.004 + Math.random() * 0.016;
            
            this.nebulae.push({
                mesh: sprite,
                speed: speed,
                originalSpeed: speed,
                // Store random values for organic movement
                rotationSpeed: (Math.random() - 0.5) * 0.01,
                pulseSpeed: 0.2 + Math.random() * 0.3,
                pulseAmount: 0.05 + Math.random() * 0.1,
                initialScale: {x: xScale, y: yScale},
                // Add wobble for more organic movement
                wobbleX: 0.1 + Math.random() * 0.2,
                wobbleY: 0.1 + Math.random() * 0.2,
                wobbleSpeed: 0.2 + Math.random() * 0.5
            });
            
            this.scene.add(sprite);
        }
        
        // Clear existing positions list before adding background nebulae
        existingPositions.length = 0;
        
        // Add a few larger, more distant nebula clouds for depth
        for (let i = 0; i < this.nebulaCount/2; i++) {
            const texture = this.createNebulaTexture(true, i % 5); // Pass shape type
            
            const material = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                blending: THREE.AdditiveBlending,
                opacity: 0.015 + Math.random() * 0.01,
                depthTest: false,
                depthWrite: false
            });
            
            // More teal/blue/purple tones for distant nebulae with higher brightness
            const hue = 0.5 + (Math.random() * 0.3);
            const color = new THREE.Color();
            color.setHSL(hue, 0.2 + Math.random() * 0.1, 0.6 + Math.random() * 0.2);
            material.color = color;
            
            const sprite = new THREE.Sprite(material);
            
            // Position with better spacing
            let x, y, z, isValidPosition = false;
            let attempts = 0;
            
            do {
                z = -100 + Math.random() * 40;
                const radius = 10 + Math.random() * 35; // Wider radius for better spread
                const theta = Math.random() * Math.PI * 2;
                x = radius * Math.cos(theta);
                y = radius * Math.sin(theta);
                
                isValidPosition = true;
                const minDistanceSquared = 250; // Larger minimum distance for background nebulae
                
                for (const pos of existingPositions) {
                    const dx = x - pos.x;
                    const dy = y - pos.y;
                    const dz = z - pos.z;
                    const distSquared = dx*dx + dy*dy + dz*dz;
                    
                    if (distSquared < minDistanceSquared) {
                        isValidPosition = false;
                        break;
                    }
                }
                
                attempts++;
            } while (!isValidPosition && attempts < 10);
            
            existingPositions.push({x, y, z});
            
            sprite.position.set(x, y, z);
            
            // Non-uniform scaling for background elements too
            const baseScale = 15 + Math.random() * 20;
            const xScale = baseScale * (0.7 + Math.random() * 0.6);
            const yScale = baseScale * (0.7 + Math.random() * 0.6);
            sprite.scale.set(xScale, yScale, 1);
            
            // Random rotation
            sprite.rotation.z = Math.random() * Math.PI * 2;
            
            // Very slow speed for background elements
            const speed = 0.001 + Math.random() * 0.005;
            
            this.nebulae.push({
                mesh: sprite,
                speed: speed,
                originalSpeed: speed,
                rotationSpeed: (Math.random() - 0.5) * 0.005,
                pulseSpeed: 0.1 + Math.random() * 0.2,
                pulseAmount: 0.03 + Math.random() * 0.05,
                initialScale: {x: xScale, y: yScale},
                // Add subtle wobble
                wobbleX: 0.05 + Math.random() * 0.1,
                wobbleY: 0.05 + Math.random() * 0.1,
                wobbleSpeed: 0.1 + Math.random() * 0.3
            });
            
            this.scene.add(sprite);
        }
    }

    //==============================================================================================
    /**
     * Creates a nebula texture
     * @description Generates a cloudy, nebula-like texture with watercolor effect
     * @param {boolean} isBackground - Whether this is a background nebula (more blurred)
     * @param {number} shapeType - Integer 0-4 determining the shape variation
     * @returns {THREE.Texture} The created texture
     */
    createNebulaTexture(isBackground = false, shapeType = 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Fill with transparent background
        ctx.clearRect(0, 0, 256, 256);
        
        // Create base shape with random irregularities
        this.drawIrregularBase(ctx, shapeType);
        
        // Add noise for more texture
        const imageData = ctx.getImageData(0, 0, 256, 256);
        const data = imageData.data;
        
        // Apply perlin-like noise patterns for texture
        this.applyTextureNoise(data, 256);
        
        ctx.putImageData(imageData, 0, 0);
        
        // Apply multiple blur passes for smoother / watercolor-like effect
        const blurPasses = isBackground ? 5 : 3;
        const blurAmount = isBackground ? '12px' : '8px';
        
        for (let i = 0; i < blurPasses; i++) {
            ctx.filter = `blur(${blurAmount})`;
            ctx.drawImage(canvas, 0, 0);
        }
        
        // Ensure edges fade to transparent with irregular mask
        ctx.filter = 'none';
        const finalImageData = ctx.getImageData(0, 0, 256, 256);
        const finalData = finalImageData.data;
        
        // Apply final edge treatment with irregular boundaries
        this.applyIrregularEdges(finalData, 256);
        
        ctx.putImageData(finalImageData, 0, 0);
        
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    
    /**
     * Draws an irregular base shape for nebulae
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} shapeType - Type of shape to draw (0-4)
     */
    drawIrregularBase(ctx, shapeType) {
        const width = 256;
        const height = 256;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Different shape bases depending on type
        switch(shapeType) {
            case 0: // Multiple overlapping blobs
                for (let i = 0; i < 3 + Math.random() * 3; i++) {
                    const offsetX = (Math.random() - 0.5) * 100;
                    const offsetY = (Math.random() - 0.5) * 100;
                    const x = centerX + offsetX;
                    const y = centerY + offsetY;
                    const radius = 20 + Math.random() * 60;
                    
                    const gradient = ctx.createRadialGradient(
                        x, y, 0, 
                        x, y, radius
                    );
                    
                    const blobAlpha = 0.05 + Math.random() * 0.09;
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${blobAlpha})`);
                    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${blobAlpha * 0.5})`);
                    gradient.addColorStop(0.9, 'rgba(255, 255, 255, 0.01)');
                    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, width, height);
                }
                break;
                
            case 1: // Stretched nebula cloud
                // Draw elongated shape
                ctx.beginPath();
                
                // Create random bezier curve path
                const curvePoints = [];
                const numPoints = 5 + Math.floor(Math.random() * 3);
                
                for (let i = 0; i < numPoints; i++) {
                    const angle = (i / numPoints) * Math.PI * 2;
                    const radius = 40 + Math.random() * 30; 
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    curvePoints.push({x, y});
                }
                
                // Close the loop
                curvePoints.push(curvePoints[0]);
                
                // Draw the bezier curve
                ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
                for (let i = 1; i < curvePoints.length; i++) {
                    const xc = (curvePoints[i-1].x + curvePoints[i].x) / 2;
                    const yc = (curvePoints[i-1].y + curvePoints[i].y) / 2;
                    ctx.quadraticCurveTo(curvePoints[i-1].x, curvePoints[i-1].y, xc, yc);
                }
                
                // Create gradient for filling
                const stretchedGradient = ctx.createRadialGradient(
                    centerX, centerY, 0,
                    centerX, centerY, 80
                );
                
                const stretchAlpha = 0.05 + Math.random() * 0.09;
                stretchedGradient.addColorStop(0, `rgba(255, 255, 255, ${stretchAlpha})`);
                stretchedGradient.addColorStop(0.7, `rgba(255, 255, 255, ${stretchAlpha * 0.3})`);
                stretchedGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = stretchedGradient;
                ctx.fill();
                break;
                
            case 2: // Spiral/swirl pattern
                const spiralPoints = [];
                const spiralArms = 1 + Math.floor(Math.random() * 3);
                
                for (let arm = 0; arm < spiralArms; arm++) {
                    const armOffset = (arm / spiralArms) * Math.PI * 2;
                    
                    for (let i = 0; i < 200; i++) {
                        const angle = armOffset + (i / 30) * Math.PI;
                        const spiralRadius = i / 5;
                        const x = centerX + Math.cos(angle) * spiralRadius;
                        const y = centerY + Math.sin(angle) * spiralRadius;
                        
                        if (x >= 0 && x < width && y >= 0 && y < height) {
                            const pointAlpha = 0.07 * (1 - i/200);
                            spiralPoints.push({x, y, alpha: pointAlpha});
                        }
                    }
                }
                
                // Draw spiral points with gradients
                for (const point of spiralPoints) {
                    const dotRadius = 10 + Math.random() * 5;
                    const gradient = ctx.createRadialGradient(
                        point.x, point.y, 0,
                        point.x, point.y, dotRadius
                    );
                    
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${point.alpha})`);
                    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    
                    ctx.fillStyle = gradient;
                    ctx.fillRect(point.x - dotRadius, point.y - dotRadius, 
                                dotRadius * 2, dotRadius * 2);
                }
                break;
                
            case 3: // Filament-like structure
                const filaments = 2 + Math.floor(Math.random() * 3);
                
                for (let f = 0; f < filaments; f++) {
                    // Create curved filament
                    ctx.beginPath();
                    
                    // Start point
                    const startX = centerX + (Math.random() - 0.5) * 100;
                    const startY = centerY + (Math.random() - 0.5) * 100;
                    
                    ctx.moveTo(startX, startY);
                    
                    // Create 2-3 control points for curve
                    const cp1x = centerX + (Math.random() - 0.5) * 150;
                    const cp1y = centerY + (Math.random() - 0.5) * 150;
                    const cp2x = centerX + (Math.random() - 0.5) * 150;
                    const cp2y = centerY + (Math.random() - 0.5) * 150;
                    const endX = centerX + (Math.random() - 0.5) * 100;
                    const endY = centerY + (Math.random() - 0.5) * 100;
                    
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
                    
                    // Create gradient along the path
                    const filamentAlpha = 0.05 + Math.random() * 0.09;
                    ctx.lineWidth = 5 + Math.random() * 20;
                    ctx.strokeStyle = `rgba(255, 255, 255, ${filamentAlpha})`;
                    ctx.stroke();
                    
                    // Add glow around the filament
                    ctx.shadowColor = 'white';
                    ctx.shadowBlur = 10;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
                break;
                
            case 4: // Chaotic noise clouds
                // Create several overlapping perlin-like noise patterns
                for (let layer = 0; layer < 3; layer++) {
                    // Create temporary canvas for this layer
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    // Draw noise pattern
                    const imageData = tempCtx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    
                    // Frequency and amplitude for this layer
                    const frequency = 0.01 + layer * 0.01;
                    const amplitude = 0.05 + Math.random() * 0.05;
                    
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const i = (y * width + x) * 4;
                            
                            // Simple noise function
                            const nx = x * frequency;
                            const ny = y * frequency;
                            const noise = this.simplexLikeNoise(nx, ny, layer);
                            
                            // Only create pattern where noise is positive
                            if (noise > 0) {
                                const noiseAlpha = noise * amplitude;
                                data[i] = 255;
                                data[i+1] = 255;
                                data[i+2] = 255;
                                data[i+3] = noiseAlpha * 255;
                            }
                        }
                    }
                    
                    tempCtx.putImageData(imageData, 0, 0);
                    
                    // Blur this layer
                    tempCtx.filter = 'blur(15px)';
                    tempCtx.drawImage(tempCanvas, 0, 0);
                    
                    // Draw layer onto main canvas
                    ctx.globalAlpha = 0.2 + Math.random() * 0.2;
                    ctx.drawImage(tempCanvas, 0, 0);
                    ctx.globalAlpha = 1.0;
                }
                break;
                
            default:
                // Fallback to basic cloud
                const defaultGradient = ctx.createRadialGradient(
                    centerX, centerY, 0,
                    centerX, centerY, 80
                );
                
                const defaultAlpha = 0.05 + Math.random() * 0.09;
                defaultGradient.addColorStop(0, `rgba(255, 255, 255, ${defaultAlpha})`);
                defaultGradient.addColorStop(0.7, `rgba(255, 255, 255, ${defaultAlpha * 0.3})`);
                defaultGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = defaultGradient;
                ctx.fillRect(0, 0, width, height);
        }
    }
    
    /**
     * Applies texture noise to nebula
     * @param {Uint8ClampedArray} data - Image data array
     * @param {number} size - Canvas size
     */
    applyTextureNoise(data, size) {
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) {
                // Add noise to all channels
                const noiseAmount = 0.4;
                const noise = (Math.random() - 0.5) * noiseAmount;
                
                // Alpha noise - keep low but visible values
                data[i + 3] = Math.max(0, Math.min(140, data[i + 3] + noise * 15));
                
                // Boost RGB channels for better visibility while keeping alpha low
                if (Math.random() > 0.5) {
                    data[i] = Math.min(255, data[i] * 1.7 + noise * 20);
                    data[i + 1] = Math.min(255, data[i + 1] * 1.7 + noise * 20);
                    data[i + 2] = Math.min(255, data[i + 2] * 1.7 + noise * 20);
                }
                
                // Apply distortion near edges
                const pixelX = (i / 4) % size;
                const pixelY = Math.floor((i / 4) / size);
                
                // Distance from center (normalized 0-1)
                const dx = (pixelX - size/2) / (size/2);
                const dy = (pixelY - size/2) / (size/2);
                const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                
                // Create smooth falloff near edges with noise
                if (distFromCenter > 0.7) {
                    // Add some noise to the edge
                    const edgeNoise = Math.cos(pixelX * 0.1) * Math.sin(pixelY * 0.1) * 0.1;
                    
                    // Apply falloff with noise
                    const edgeFalloff = Math.max(0, 1 - ((distFromCenter - 0.7) / (0.3 + edgeNoise)));
                    data[i + 3] = Math.floor(data[i + 3] * edgeFalloff * edgeFalloff);
                }
            }
        }
    }
    
    /**
     * Applies irregular edges to the nebula texture
     * @param {Uint8ClampedArray} data - Image data array
     * @param {number} size - Canvas size
     */
    applyIrregularEdges(finalData, size) {
        // Generate noise values for the edge irregularity
        const edgeNoise = [];
        for (let i = 0; i < 360; i++) {
            // Create varying edge distances (0.8-1.0 radius)
            edgeNoise.push(0.8 + (Math.cos(i * 0.1) * Math.sin(i * 0.2) + 1) * 0.1);
        }
        
        for (let i = 0; i < finalData.length; i += 4) {
            if (finalData[i + 3] > 0) {
                // Boost color channels
                finalData[i] = Math.min(255, finalData[i] * 1.5);
                finalData[i + 1] = Math.min(255, finalData[i + 1] * 1.5);
                finalData[i + 2] = Math.min(255, finalData[i + 2] * 1.5);
                
                // Apply irregular edge mask
                const pixelX = (i / 4) % size;
                const pixelY = Math.floor((i / 4) / size);
                
                // Calculate angle and distance from center
                const dx = (pixelX - size/2) / (size/2);
                const dy = (pixelY - size/2) / (size/2);
                const angle = (Math.atan2(dy, dx) + Math.PI) * 180 / Math.PI; // 0-360
                const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                
                // Get the edge distance for this angle
                const angleIndex = Math.floor(angle) % 360;
                const edgeDistance = edgeNoise[angleIndex];
                
                // Apply irregular edge
                if (distFromCenter > edgeDistance) {
                    finalData[i + 3] = 0; // Outside the irregular edge
                }
                // Gradual falloff near the edge
                else if (distFromCenter > edgeDistance - 0.15) {
                    const edgeFalloff = (edgeDistance - distFromCenter) / 0.15;
                    finalData[i + 3] = Math.floor(finalData[i + 3] * edgeFalloff);
                }
            }
        }
    }
    
    /**
     * Simple noise function (not true simplex but similar effect)
     * @param {number} x - X coordinate 
     * @param {number} y - Y coordinate
     * @param {number} seed - Random seed
     * @returns {number} Noise value from -1 to 1
     */
    simplexLikeNoise(x, y, seed = 0) {
        // Simple deterministic noise function
        const n = Math.sin(x + y * 113 + seed * 157) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
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

        // Update nebulae positions
        this.updateNebulae(deltaTime);

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

    //==============================================================================================
    /**
     * Update nebula positions
     * @param {number} deltaTime - Time since last frame in seconds
     * @description Moves nebulae forward and resets them when they pass the camera
     */
    updateNebulae(deltaTime) {
        const time = performance.now() * 0.001; // Current time in seconds for animation
        
        for (let i = 0; i < this.nebulae.length; i++) {
            const nebula = this.nebulae[i];
            
            // Calculate warp speed for nebulae (increases during warp)
            const warpSpeed = nebula.originalSpeed * (1 + this.warpIntensity * 120);
            
            // Move nebula forward
            nebula.mesh.position.z += warpSpeed * deltaTime * 60;
            
            // Apply subtle organic movement
            nebula.mesh.rotation.z += nebula.rotationSpeed * deltaTime;
            
            // Subtle pulsing/breathing effect
            const pulse = Math.sin(time * nebula.pulseSpeed) * nebula.pulseAmount;
            
            // Apply non-uniform wobble for more organic feel
            const wobbleX = Math.sin(time * nebula.wobbleSpeed) * nebula.wobbleX;
            const wobbleY = Math.cos(time * nebula.wobbleSpeed * 0.7) * nebula.wobbleY;
            
            // Scale effect during warp
            const stretchFactor = 1 + this.warpIntensity * 1.5;
            
            // Apply non-uniform scaling for more organic feel
            nebula.mesh.scale.x = nebula.initialScale.x * (1 + pulse + wobbleX);
            nebula.mesh.scale.y = nebula.initialScale.y * (1 + pulse + wobbleY);
            nebula.mesh.scale.z = Math.min(nebula.initialScale.x, nebula.initialScale.y) * stretchFactor;
            
            // Reset nebula if it's too close to camera
            if (nebula.mesh.position.z > 10) {
                nebula.mesh.position.z = -85 - Math.random() * 30; // More varied and further back
                
                // New random position
                const radius = 3 + Math.random() * 25;
                const theta = Math.random() * Math.PI * 2;
                nebula.mesh.position.x = radius * Math.cos(theta);
                nebula.mesh.position.y = radius * Math.sin(theta);
                
                // Randomize scale again for variety
                const baseScale = i < this.nebulaCount ? 
                    (5 + Math.random() * 10) : 
                    (15 + Math.random() * 20);
                    
                const xScale = baseScale * (0.7 + Math.random() * 0.6);
                const yScale = baseScale * (0.7 + Math.random() * 0.6);
                nebula.initialScale = {x: xScale, y: yScale};
                nebula.mesh.scale.set(xScale, yScale, 1);
                
                // New random opacity (visible but won't block stars due to material settings)
                const baseOpacity = i < this.nebulaCount ? 0.02 : 0.015;
                nebula.mesh.material.opacity = baseOpacity + Math.random() * 0.02;
                
                // Create new texture with different shape
                nebula.mesh.material.map = this.createNebulaTexture(
                    i >= this.nebulaCount, // background flag
                    Math.floor(Math.random() * 5) // random shape type
                );
                nebula.mesh.material.map.needsUpdate = true;
                
                // Fade in effect
                if (this.warpIntensity < 0.05) {
                    nebula.mesh.material.opacity = 0;  // Will fade in during animation
                }
            }
            
            // Handle fade in effect when not warping (slower for nebulae)
            if (this.warpIntensity < 0.05 && nebula.mesh.material.opacity < 0.04) {
                nebula.mesh.material.opacity = Math.min(0.04, nebula.mesh.material.opacity + 0.01 * deltaTime);
            }
            
            // Increase color saturation / lightness during warp
            const material = nebula.mesh.material;
            const hsl = {};
            material.color.getHSL(hsl);
            
            // Keep base saturation low but increase lightness to compensate for very low opacity
            const targetSaturation = 0.2 + Math.min(0.4, this.warpIntensity * 0.5);
            const targetLightness = 0.7 + Math.min(0.3, this.warpIntensity * 0.3);
            
            const newSaturation = hsl.s + (targetSaturation - hsl.s) * 0.1;
            const newLightness = hsl.l + (targetLightness - hsl.l) * 0.1;
            
            material.color.setHSL(hsl.h, newSaturation, newLightness);
        }
    }

    //==============================================================================================
    /**
     * Trigger Konami warp effect
     * @description Initiates a Konami warp that fades out over 5 seconds
     */
    triggerKonamiWarp() {
        console.log('todo');
    }
}

// Initialize starfield when the page loads
window.addEventListener('load', () => {
    new Starfield();
});