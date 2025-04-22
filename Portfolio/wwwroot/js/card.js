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
        
        // Add position tracking for dragging
        this.position = { x: 0, y: 0 };
        this.targetPosition = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        
        // Spring configuration for return animation
        this.springStrength = 0.05; // Adjust for faster/slower return
        this.springDamping = 0.75;  // Adjust for more/less bounce
        this.velocity = { x: 0, y: 0 };
        
        // Position limits and drag resistance
        this.positionLimits = { x: 1.5, y: 1.5 }; // Maximum distance from center
        this.dragResistance = 0; // resistance with distance from center
        
        // Click handling
        this.dragStartTime = 0;
        this.dragDistance = 0;
        
        this.init();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        
        // Use window dimensions for proper viewport
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance"
        });
        
        // Set renderer size to window dimensions
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Create card geometry and materials
        // Make card fill most of the view while maintaining aspect ratio
        const viewHeight = Math.tan(Math.PI * 45 / 360) * 2;
        const cardWidth = viewHeight * aspect * 1; // dont scale (1)
        const cardHeight = cardWidth * (700 / 1200); // Maintain 12:7 aspect ratio
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
        // Click to flip - now with drag detection
        this.container.addEventListener('click', (e) => {
            const dragDuration = Date.now() - this.dragStartTime;
            const isDragGesture = this.dragDistance > 5 || dragDuration > 200;
            
            if (!isDragGesture && this.isMouseOverCard(e)) {
                this.flipCard();
                // Only trigger warp effect if we actually clicked the card
                if (window.triggerStarfieldWarp) {
                    window.triggerStarfieldWarp();
                }
            }
            
            // Reset drag tracking
            this.dragDistance = 0;
        });

        // Pointer move for rotation and dragging
        const handlePointerMove = (e) => {
            // Check if pointer has left the window
            if (e.clientX <= 0 || e.clientX >= window.innerWidth ||
                e.clientY <= 0 || e.clientY >= window.innerHeight) {
                if (this.isDragging) {
                    this.isDragging = false;
                    this.container.releasePointerCapture(e.pointerId);
                }
                return;
            }

            if (this.isDragging) {
                // Calculate drag movement in screen coordinates
                const movementX = e.clientX - this.previousMousePosition.x;
                const movementY = e.clientY - this.previousMousePosition.y;
                
                // Track total drag distance for click detection
                this.dragDistance += Math.sqrt(movementX * movementX + movementY * movementY);
                
                // Convert screen movement to world space movement
                const worldMovementX = (movementX / window.innerWidth) * 1.5;
                const worldMovementY = -(movementY / window.innerHeight) * 1.5;
                
                // Calculate distance from center for resistance
                const currentDistance = Math.sqrt(
                    this.position.x * this.position.x + 
                    this.position.y * this.position.y
                );
                
                // Apply distance-based resistance
                const resistance = 1 / (1 + (currentDistance * this.dragResistance));
                
                // Update position with limits and resistance
                const newX = this.position.x + (worldMovementX * resistance);
                const newY = this.position.y + (worldMovementY * resistance);
                
                // Apply position limits
                this.position.x = Math.max(-this.positionLimits.x, Math.min(this.positionLimits.x, newX));
                this.position.y = Math.max(-this.positionLimits.y, Math.min(this.positionLimits.y, newY));
                
                // Update previous position for next frame
                this.previousMousePosition = {
                    x: e.clientX,
                    y: e.clientY
                };
                return;
            }

            if (!this.isMouseOverCard(e)) {
                this.targetRotation.x = 0;
                this.targetRotation.y = 0;
                return;
            }

            const rect = this.container.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            // Calculate target rotation with tilt limits
            this.targetRotation.x = -y * 0.3;
            this.targetRotation.y = x * 0.3;
        };

        this.container.addEventListener('pointermove', handlePointerMove);

        // Mouse leave to reset rotation
        this.container.addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                this.targetRotation.x = 0;
                this.targetRotation.y = 0;
            }
        });

        // Pointer down for dragging
        this.container.addEventListener('pointerdown', (e) => {
            if (this.isMouseOverCard(e)) {
                this.isDragging = true;
                this.dragStartTime = Date.now();
                this.dragDistance = 0;
                this.previousMousePosition = {
                    x: e.clientX,
                    y: e.clientY
                };
                // Store the initial drag offset
                const rect = this.container.getBoundingClientRect();
                this.dragOffset = {
                    x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
                    y: -(((e.clientY - rect.top) / rect.height) * 2 - 1)
                };
                
                // Capture the pointer to track it even outside the window
                this.container.setPointerCapture(e.pointerId);
            }
        });

        // Pointer up to stop dragging
        this.container.addEventListener('pointerup', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.container.releasePointerCapture(e.pointerId);
            }
        });

        // Handle when pointer is lost (e.g., leaves window)
        this.container.addEventListener('lostpointercapture', () => {
            this.isDragging = false;
        });

        // Backup: also handle when window loses focus
        window.addEventListener('blur', () => {
            if (this.isDragging) {
                this.isDragging = false;
            }
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

    updateSpringAnimation() {
        if (!this.isDragging) {
            // Calculate spring force
            const springForceX = -this.position.x * this.springStrength;
            const springForceY = -this.position.y * this.springStrength;
            
            // Apply spring physics
            this.velocity.x += springForceX;
            this.velocity.y += springForceY;
            
            // Apply damping
            this.velocity.x *= this.springDamping;
            this.velocity.y *= this.springDamping;
            
            // Update position
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        // Update spring animation
        this.updateSpringAnimation();

        // Smooth rotation interpolation
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;

        // Smooth flip animation
        const flipDelta = (this.flipTarget - this.flipProgress) * (1 / (60 * this.flipDuration));
        this.flipProgress += flipDelta;

        // Calculate final rotation including both hover effect and flip state
        const flipRotation = Math.PI * this.flipProgress;
        
        // Apply all transformations
        this.card.rotation.x = this.rotation.x;
        this.card.rotation.y = this.rotation.y + flipRotation;
        this.card.position.x = this.position.x;
        this.card.position.y = this.position.y;

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const card3D = new Card();
    window.addEventListener('resize', () => card3D.onWindowResize());
});
