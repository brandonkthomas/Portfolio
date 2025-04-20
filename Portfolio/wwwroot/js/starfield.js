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
        
        // Add warp effect properties
        this.warpFactor = 0;
        this.targetWarpFactor = 0;
        this.warpSpeed = 0.1; // Speed of warp transition
        this.maxWarpFactor = 0.5; // Maximum warp effect intensity
        
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
            speeds.push(0.005 + Math.random() * 0.01);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));

        const material = new THREE.PointsMaterial({
            size: 0.15, // Slightly larger stars to compensate for fewer of them
            vertexColors: true,
            transparent: true,
            map: this.createCircleTexture(),
            alphaTest: 0.1
        });

        this.starField = new THREE.Points(geometry, material);
        this.scene.add(this.starField);

        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
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

    setWarp(enabled) {
        this.targetWarpFactor = enabled ? this.maxWarpFactor : 0;
    }

    updateWarpEffect() {
        // Smoothly interpolate current warp factor to target
        this.warpFactor += (this.targetWarpFactor - this.warpFactor) * this.warpSpeed;
        
        if (this.starField) {
            const positions = this.starField.geometry.attributes.position;
            const speeds = this.starField.geometry.attributes.speed;
            const baseSize = 0.15;
            
            // Update star material size based on warp factor
            this.starField.material.size = baseSize * (1 + this.warpFactor * 2);
            
            // Update star movement speeds
            for (let i = 0; i < positions.count; i++) {
                const zPos = positions.array[i * 3 + 2];
                const baseSpeed = speeds.array[i];
                
                // Increase speed based on warp factor and z position
                const speedMultiplier = 1 + (this.warpFactor * 3 * (1 - zPos / -50));
                positions.array[i * 3 + 2] += baseSpeed * speedMultiplier;

                // Reset star position if too close
                if (positions.array[i * 3 + 2] > 10) {
                    positions.array[i * 3 + 2] = -50;
                }
            }
            
            // Add blur effect based on warp factor
            this.starField.material.blending = THREE.AdditiveBlending;
            
            positions.needsUpdate = true;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updateWarpEffect();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize starfield when the page loads
window.addEventListener('load', () => {
    window.starfield = new Starfield(); // Make it globally accessible
}); 