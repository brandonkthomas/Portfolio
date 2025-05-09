/**
 * card.js
 * @fileoverview 3D interactive card component
 * @description Handles 3D card rendering, flip animations, and drag interactions
 */

import {
    isMobile
} from './common.js';

// import Stats from 'https://cdnjs.cloudflare.com/ajax/libs/stats.js/r17/Stats.min.js';

class Card {

    //==============================================================================================
    /**
     * Creates new card instance -- call init() to start the card animation
     * @constructor
     * @description Initializes a 3D card with flip and drag interactions
     * @property {HTMLElement} container - The card container element
     * @property {boolean} isFlipped - Whether the card is currently flipped
     * @property {boolean} isDragging - Whether the card is being dragged
     * @property {Object} previousMousePosition - Last known mouse position
     * @property {Object} rotation - Current card rotation
     * @property {Object} targetRotation - Target rotation for smooth animation
     * @property {Object} position - Current card position
     * @property {Object} targetPosition - Target position for smooth animation
     * @property {number} springStrength - Spring force for position return (after drag)
     * @property {number} springDamping - Damping factor for spring animation (after drag)
     * @property {Object} velocity - Current velocity for spring animation (after drag)
     * @property {Object} positionLimits - Maximum allowed position values
     * @property {number} dragResistance - Resistance factor for dragging
     * @property {number} flipDuration - Duration of flip animation in seconds
     * @property {number} flipProgress - Current progress of flip animation
     * @property {number} flipTarget - Target flip state
     * @property {number} flipStartTime - When the current flip started
     */
    constructor() {
        // DOM elements
        this.container = document.querySelector('.card-container');
        this.tapIndicator = document.querySelector('.tap-indicator.desktop');
        this.tapIndicatorMobile = document.querySelector('.tap-indicator.mobile');

        // // Performance monitoring
        // this.stats = new Stats();
        // this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        // document.body.appendChild(this.stats.dom);
        // this.stats.dom.style.position = 'fixed';
        // this.stats.dom.style.right = '0px';
        // this.stats.dom.style.left = 'auto';
        // this.stats.dom.style.top = '0px';

        // State flags
        this.isFlipped = false;
        this.isDragging = false;

        // Mouse/touch tracking
        this.previousMousePosition = {
            x: 0,
            y: 0
        };
        this.dragStartTime = 0;
        this.dragDistance = 0;
        // this.dragOffset = {
        //     x: 0,
        //     y: 0
        // };

        // Rotation state
        this.rotation = {
            x: 0,
            y: 0
        };
        this.targetRotation = {
            x: 0,
            y: 0
        };

        // Position state
        this.position = {
            x: 0,
            y: 0
        };
        this.targetPosition = {
            x: 0,
            y: 0
        };

        // Spring configuration for drag return animation
        this.springStrength = 0.05; // Adjust for faster/slower return
        this.springDamping = 0.75; // Adjust for more/less bounce
        this.velocity = {
            x: 0,
            y: 0
        };

        // Position limits and drag resistance
        this.positionLimits = {
            x: 1.5,
            y: 1.5
        }; // Maximum distance from center
        this.dragResistance = 0; // resistance with distance from center

        // Flip animation
        this.flipDuration = 0.26; // seconds
        this.flipProgress = 0;
        this.flipTarget = 0;
        this.flipStartTime = null; // only start timing on user click

        this.init();
    }

    //==============================================================================================
    /**
     * Initialize the card
     * @description Sets up Three.js scene, creates card, and starts animation
     */
    init() {
        // Scene setup
        this.scene = new THREE.Scene();

        // Show card tap CTA indicator after 2.25s; hide after 14.2s
        this._showTapTimeout = setTimeout(() => {
            if (isMobile()) {
                this.tapIndicatorMobile.classList.add('visible');
            } else {
                this.tapIndicator.classList.add('visible');
            }
            this._hideTapTimeout = setTimeout(() => {
                if (isMobile()) {
                    this.tapIndicatorMobile.classList.remove('visible');
                } else {
                    this.tapIndicator.classList.remove('visible');
                }
            }, 14200);
        }, 2250);

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

        // Create card
        this.createCard();

        // Setup interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.setupEventListeners();

        // Start animation
        requestAnimationFrame(this.animate.bind(this));
    }

    //==============================================================================================
    /**
     * Create the 3D card
     * @description Creates card geometry, materials, and textures
     */
    createCard() {
        const {
            cardWidth,
            cardHeight
        } = this.calculateCardDimensions();
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

        const frontTexture = loadTexture('/assets/images/card/card-front.png');
        const backTexture = loadTexture(isMobile() ? '/assets/images/card/card-back-mobile.png' : '/assets/images/card/card-back-desktop.png');

        // Create materials with proper settings
        const materials = [
            new THREE.MeshBasicMaterial({
                color: 0x111111
            }), // Right side
            new THREE.MeshBasicMaterial({
                color: 0x111111
            }), // Left side
            new THREE.MeshBasicMaterial({
                color: 0x111111
            }), // Top side
            new THREE.MeshBasicMaterial({
                color: 0x111111
            }), // Bottom side
            new THREE.MeshBasicMaterial({ // Front side
                map: frontTexture,
                transparent: true
            }),
            new THREE.MeshBasicMaterial({ // Back side
                map: backTexture,
                transparent: true
            })
        ];

        this.card = new THREE.Mesh(geometry, materials);
        this.scene.add(this.card);
        this.camera.position.z = 2;
    }

    //==============================================================================================
    /**
     * Calculate card dimensions based on viewport
     * @description Determines card size based on device type and viewport
     * @returns {Object} Object containing cardWidth and cardHeight
     */
    calculateCardDimensions() {
        const aspect = window.innerWidth / window.innerHeight;
        let cardWidth, cardHeight;

        if (isMobile()) {
            // On mobile, directly use 90% of viewport width
            const fov = 45; // matches camera FOV
            const distance = 2; // matches camera.position.z
            const vFOV = (fov * Math.PI) / 180;
            const viewportHeightAtDistance = 2 * distance * Math.tan(vFOV / 2);
            const viewportWidthAtDistance = viewportHeightAtDistance * aspect;

            // Calculate card width as 90% of viewport width
            cardWidth = viewportWidthAtDistance * 0.9;
            // Maintain aspect ratio
            cardHeight = cardWidth * (700 / 1200);
        } else {
            // Desktop calculation
            const viewHeight = Math.tan(Math.PI * 45 / 360) * 2;
            cardWidth = viewHeight * aspect * 1;
            cardHeight = cardWidth * (700 / 1200);
        }

        return {
            cardWidth,
            cardHeight
        };
    }

    //==============================================================================================
    /**
     * Set up event listeners for card interaction
     * @description Handles click, drag, and hover events
     */
    setupEventListeners() {
        // Click to flip - now with drag detection
        this.container.addEventListener('click', (e) => {
            const dragDuration = Date.now() - this.dragStartTime;
            const isDragGesture = this.dragDistance > 5 || dragDuration > 200;

            if (!isDragGesture && this.isMouseOverCard(e)) {
                this.flipCard();
                // Remove the tap indicator immediately
                if (this.tapIndicator) {
                    this.tapIndicator.classList.remove('visible');
                    // Clear any pending show/hide timeouts
                    clearTimeout(this._showTapTimeout);
                    clearTimeout(this._hideTapTimeout);
                }
                if (this.tapIndicatorMobile) {
                    this.tapIndicatorMobile.classList.remove('visible');
                    // Clear any pending show/hide timeouts
                    clearTimeout(this._showTapTimeout);
                    clearTimeout(this._hideTapTimeout);
                }
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
                this.container.style.cursor = 'default';
                return;
            }

            if (this.isDragging) {
                this.handleDrag(e);
            } else if (this.isMouseOverCard(e)) {
                this.handleHover(e);
            } else {
                this.targetRotation.x = 0;
                this.targetRotation.y = 0;
                this.container.style.cursor = 'default';
            }
        };

        this.container.addEventListener('pointermove', handlePointerMove);

        // Mouse leave to reset rotation and cursor
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
                // this.dragOffset = this.calculateDragOffset(e);

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

    //==============================================================================================
    /**
     * Handle drag interaction
     * @description Updates card position based on drag movement
     * @param {PointerEvent} e - pointer event
     */
    handleDrag(e) {
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
    }

    //==============================================================================================
    /**
     * Handle hover interaction
     * @description Updates card rotation based on mouse position
     * @param {PointerEvent} e - The pointer event
     */
    handleHover(e) {
        const rect = this.container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        // Calculate target rotation with tilt limits
        this.targetRotation.x = -y * 0.3;
        this.targetRotation.y = x * 0.3;

        // Set cursor to pointer when hovering over card
        this.container.style.cursor = 'pointer';
    }

    //==============================================================================================
    // /**
    //  * Calculate drag offset from mouse position
    //  * @description Converts screen coordinates to normalized device coordinates
    //  * @param {PointerEvent} e - The pointer event
    //  * @returns {Object} Object containing x and y offsets
    //  */
    // calculateDragOffset(e) {
    //     const rect = this.container.getBoundingClientRect();
    //     return {
    //         x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
    //         y: -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    //     };
    // }

    //==============================================================================================
    /**
     * Check if mouse is over the card
     * @description Uses raycasting to detect if mouse is over card
     * @param {PointerEvent} event - pointer event
     * @returns {boolean} True if mouse is over card
     */
    isMouseOverCard(event) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.card);

        return intersects.length > 0;
    }

    //==============================================================================================
    /**
     * Flip the card
     * @description Toggles card flip state and starts flip animation
     */
    flipCard() {
        this.isFlipped = !this.isFlipped;
        this.flipTarget = this.isFlipped ? 1 : 0;
        this.flipStartTime = performance.now(); // start timing flip now
    }

    //==============================================================================================
    /**
     * Update spring animation
     * @description Applies spring physics to return card to center when the drag ends
     */
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

    //==============================================================================================
    /**
     * Main animation loop
     * @description Updates card position, rotation, and flip state
     * @param {number} timestamp - Current animation timestamp
     */
    animate(timestamp) {
        // Begin stats monitoring for this frame
        // this.stats.begin();

        // first frame: seed lastTimestamp so it's never undefined
        if (this.lastTimestamp === undefined) {
            this.lastTimestamp = timestamp;
        }

        // spring return animation
        this.updateSpringAnimation();

        // smooth hover tilt
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;

        // only run your ease-out flip when flipStartTime is set (i.e. after click)
        if (this.flipStartTime != null) {
            const elapsed = (timestamp - this.flipStartTime) / 1000; // seconds since flip began
            const t = Math.min(elapsed / this.flipDuration, 1); // clamp 0→1
            let eased = Math.sqrt(1 - Math.pow(t - 1, 2)); // easeOutCirc

            // if we're flipping *back* (flipTarget===0), reverse the eased value
            if (this.flipTarget === 0) eased = 1 - eased;

            this.flipProgress = eased;

            // once we're at t===1, snap to final state and clear flipStartTime
            if (t >= 1) {
                this.flipStartTime = null;
                this.flipProgress = this.flipTarget;
            }
        }

        // apply rotation + flip
        const flipRotation = Math.PI * this.flipProgress;
        this.card.rotation.x = this.rotation.x;
        this.card.rotation.y = this.rotation.y + flipRotation;

        // apply drag/spring position
        this.card.position.x = this.position.x;
        this.card.position.y = this.position.y;

        // Update tap indicator position
        this.updateTapIndicatorPosition();

        // render & queue next frame
        this.renderer.render(this.scene, this.camera);

        // End stats monitoring for this frame
        // this.stats.end();

        requestAnimationFrame(this.animate.bind(this));
    }

    //==============================================================================================
    /**
     * Handle window resize
     * @description Updates mobile status, card dimensions, renderer size, and camera settings on window resize
     */
    onWindowResize() {
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        // Update renderer size
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Update card dimensions
        this.updateCardDimensions();
    }

    //==============================================================================================
    /**
     * Update card dimensions
     * @description Recreates card geometry with new dimensions
     */
    updateCardDimensions() {
        const {
            cardWidth,
            cardHeight
        } = this.calculateCardDimensions();
        const cardDepth = 0.01;

        // Create new geometry with updated dimensions
        const newGeometry = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);

        // Update the card's geometry
        this.card.geometry.dispose(); // Clean up old geometry
        this.card.geometry = newGeometry;
    }

    //==============================================================================================
    /**
     * Update tap indicator position
     * @description Updates the position of the tap indicator based on the three.js card's position and rotation
     */
    updateTapIndicatorPosition() {
        if (!this.card) return;

        // Get the card's bottom right corner in world space
        const cardSize = this.card.geometry.parameters;
        const bottomRight = new THREE.Vector3(
            cardSize.width / 2,
            -cardSize.height / 2,
            0
        );

        // Apply the card's current position and rotation
        bottomRight.applyMatrix4(this.card.matrixWorld);

        // Convert to screen coordinates
        const screenPosition = bottomRight.project(this.camera);

        // Convert to CSS coordinates
        const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-screenPosition.y * 0.5 + 0.5) * window.innerHeight;

        // Position the indicator
        this.tapIndicator.style.left = `${x}px`;
        this.tapIndicator.style.top = `${y}px`;
        this.tapIndicator.style.right = 'auto';
        this.tapIndicator.style.bottom = 'auto';

        this.tapIndicatorMobile.style.left = `${x}px`;
        this.tapIndicatorMobile.style.top = `${y}px`;
        this.tapIndicatorMobile.style.right = 'auto';
        this.tapIndicatorMobile.style.bottom = 'auto';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const card3D = new Card();
    window.addEventListener('resize', () => card3D.onWindowResize());
});