//
// starfield.js
//
class Starfield {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#1A1A1A');
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('starfield'),
            antialias: true
        });
        
        this.stars = [];
        this.starCount = 2000;
        this.starField = null;
        this.warpIntensity = 0;
        this.cardContainer = document.querySelector('.card-container');
        
        this.init();
        this.animate();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.position.z = 5;

        // Create stars with varying colors and speeds
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const speeds = [];
        const originalSpeeds = []; // Store original speeds for warp effect

        const generateOffWhiteColor = () => {
            // Generate subtle variations of white
            const hue = Math.random() * 360; // Any hue
            const saturation = Math.random() * 0.1; // Very low saturation (0-10%)
            const lightness = 0.95 + Math.random() * 0.05; // Very high lightness (95-100%)
            
            const color = new THREE.Color();
            color.setHSL(hue/360, saturation, lightness);
            return color;
        };

        // Create a cylindrical distribution of stars
        for (let i = 0; i < this.starCount; i++) {
            // Cylindrical coordinates with wider distribution
            const radius = 8 + Math.random() * 20; // Increased range for more spread
            const theta = Math.random() * Math.PI * 2;
            const z = Math.random() * 150 - 75; // Increased depth range for more spacing
            
            // Convert to Cartesian coordinates
            const x = radius * Math.cos(theta);
            const y = radius * Math.sin(theta);
            
            positions.push(x, y, z);
            
            const color = generateOffWhiteColor();
            colors.push(color.r, color.g, color.b);
            
            // Random speed between 0.02 and 0.06 (20% of original 0.1-0.3)
            const speed = 0.005 + Math.random() * 0.01;
            speeds.push(speed);
            originalSpeeds.push(speed);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));
        geometry.setAttribute('originalSpeed', new THREE.Float32BufferAttribute(originalSpeeds, 1));

        const material = new THREE.PointsMaterial({
            size: 0.15, // Slightly larger stars to compensate for fewer of them
            vertexColors: true,
            transparent: true,
            map: this.createCircleTexture(),
            alphaTest: 0.1,
            sizeAttenuation: true
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

    setupClickDetection() {
        // Instead of listening for clicks directly, expose a method for the card to call
        window.triggerStarfieldWarp = () => {
            this.triggerWarpPulse();
        };
    }

    triggerWarpPulse() {
        // Set warp intensity to 1 immediately
        this.warpIntensity = 1;
        
        // Create a smooth fade out over 0.35 seconds
        const startTime = Date.now();
        const duration = 500; // 0.35 seconds in milliseconds
        
        const fadeOut = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Use easeOutQuart for smoother deceleration at the end
            this.warpIntensity = Math.pow(1 - progress, 4);
            
            if (progress < 1) {
                requestAnimationFrame(fadeOut);
            }
        };
        
        requestAnimationFrame(fadeOut);
    }

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

    animate() {
        requestAnimationFrame(() => this.animate());

        const positions = this.starField.geometry.attributes.position;
        const speeds = this.starField.geometry.attributes.speed;
        const originalSpeeds = this.starField.geometry.attributes.originalSpeed;

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
            }
        }

        positions.needsUpdate = true;
        speeds.needsUpdate = true;

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
