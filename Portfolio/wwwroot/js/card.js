class Card {
    constructor() {
        this.container = document.querySelector('.card-container');
        this.isFlipped = false;
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.rotation = { x: 0, y: 0 };
        this.targetRotation = { x: 0, y: 0 };
        this.flipProgress = 0;
        this.flipTarget = 0;
        this.flipDuration = 0.26; // seconds
        
        this.init();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        
        // Calculate aspect ratio based on container
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance"
        });
        
        // Set renderer size and append to container
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Create card geometry and materials
        // Make card fill most of the view while maintaining aspect ratio
        const viewHeight = Math.tan(Math.PI * 45 / 360) * 2;
        const cardWidth = viewHeight * aspect * 1.25; // Increased from 0.8 to 1.0 (25% larger)
        const cardHeight = cardWidth * (700 / 1200); // Maintain image aspect ratio
        const cardDepth = 0.01;
        
        const geometry = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);
        
        // Create materials for front and back with proper texture settings
        const textureLoader = new THREE.TextureLoader();
        const loadTexture = (url) => {
            const texture = textureLoader.load(url);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            return texture;
        };

        const frontTexture = loadTexture('/images/card-front.png');
        const backTexture = loadTexture('/images/card-back.png');
        
        // Create materials with proper settings
        const materials = [
            new THREE.MeshBasicMaterial({ color: 0x111111 }), // Right side
            new THREE.MeshBasicMaterial({ color: 0x111111 }), // Left side
            new THREE.MeshBasicMaterial({ color: 0x111111 }), // Top side
            new THREE.MeshBasicMaterial({ color: 0x111111 }), // Bottom side
            new THREE.MeshBasicMaterial({ 
                map: frontTexture,
                transparent: true
            }), // Front side
            new THREE.MeshBasicMaterial({ 
                map: backTexture,
                transparent: true
            })  // Back side
        ];

        // Create card mesh
        this.card = new THREE.Mesh(geometry, materials);
        this.scene.add(this.card);

        // Position camera
        this.camera.position.z = 2;

        // Create raycaster for mouse interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Add event listeners
        this.setupEventListeners();

        // Start animation loop
        this.animate();
    }

    setupEventListeners() {
        // Click to flip
        this.container.addEventListener('click', (e) => {
            if (!this.isDragging && this.isMouseOverCard(e)) {
                this.flipCard();
            }
        });

        // Mouse move for rotation
        this.container.addEventListener('mousemove', (e) => {
            if (!this.isMouseOverCard(e)) {
                this.targetRotation.x = 0;
                this.targetRotation.y = 0;
                return;
            }

            const rect = this.container.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            // Calculate target rotation with tilt limits
            this.targetRotation.x = y * 0.3;
            this.targetRotation.y = x * 0.3;
        });

        // Mouse leave to reset rotation
        this.container.addEventListener('mouseleave', () => {
            this.targetRotation.x = 0;
            this.targetRotation.y = 0;
        });

        // Mouse down for dragging
        this.container.addEventListener('mousedown', (e) => {
            if (this.isMouseOverCard(e)) {
                this.isDragging = true;
                this.previousMousePosition = {
                    x: e.clientX,
                    y: e.clientY
                };
            }
        });

        // Mouse up to stop dragging
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
    }

    isMouseOverCard(event) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.card);
        
        return intersects.length > 0;
    }

    flipCard() {
        this.isFlipped = !this.isFlipped;
        this.flipTarget = this.isFlipped ? 1 : 0;
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        // Smooth rotation interpolation
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;

        // Smooth flip animation
        const flipDelta = (this.flipTarget - this.flipProgress) * (1 / (60 * this.flipDuration));
        this.flipProgress += flipDelta;

        // Calculate final rotation including both hover effect and flip state
        const flipRotation = Math.PI * this.flipProgress;
        
        // Apply all rotations
        this.card.rotation.x = this.rotation.x;
        this.card.rotation.y = this.rotation.y + flipRotation;

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const card3D = new Card();
    window.addEventListener('resize', () => card3D.onWindowResize());
}); 