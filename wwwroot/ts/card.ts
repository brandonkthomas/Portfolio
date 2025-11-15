/**
 * card.js
 * @fileoverview 3D interactive card component
 * @description Handles 3D card rendering, flip animations, and drag interactions
 */

import { isMobile } from './common';
import stateManager, { ViewState } from './stateManager';
import perf from './perfMonitor';
import { triggerStarfieldWarp } from './starfield';

class Card {
    // DOM
    private container: HTMLElement | null;
    private tapIndicator: HTMLElement | null;
    private tapIndicatorMobile: HTMLElement | null;

    // State flags
    private isFlipped: boolean;
    private isDragging: boolean;
    private hasInteracted: boolean;

    // Ready promise
    private readyPromise: Promise<void>;
    private _resolveReady: (() => void) | null = null;

    // Pointer/motion state
    private previousMousePosition: { x: number; y: number };
    private dragStartTime: number;
    private dragDistance: number;

    // Rotation state
    private rotation: { x: number; y: number };
    private targetRotation: { x: number; y: number };
    private dragTiltStrength: number;
    private hoverTiltFollow: number;
    private dragTiltFollow: number;

    // Position/spring state
    private position: { x: number; y: number };
    private baseSpringStrength: number;
    private baseSpringDamping: number;
    private snapSpringStrength: number;
    private snapSpringDamping: number;
    private snapBoostDuration: number;
    private snapBoostEndTime: number;
    private releaseBoost: number;
    private velocity: { x: number; y: number };
    private positionLimits: { x: number; y: number };
    private dragResistance: number;

    // Flip state
    private flipDuration: number;
    private flipProgress: number;
    private flipTarget: number;
    private flipStartTime: number | null;

    // Three.js
    private scene: any;
    private camera: any;
    private renderer: any;
    private raycaster: any;
    private mouse: any;
    private card: any;

    // Animation helpers
    private lastTimestamp: number | undefined;
    private _showTapTimeout: any | null;
    private _hideTapTimeout: any | null;

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

        // State flags
        this.isFlipped = false;
        this.isDragging = false;
        this.hasInteracted = false; // once true, CTA should never reappear this session

        // Signal to subscribers that the card is ready
        this.readyPromise = new Promise((resolve) => {
            this._resolveReady = resolve;
        });

        this.readyPromise = new Promise((resolve) => {
            this._resolveReady = resolve;
        });

        // Mouse/touch tracking
        this.previousMousePosition = {
            x: 0,
            y: 0
        };
        this.dragStartTime = 0;
        this.dragDistance = 0;

        // Rotation state
        this.rotation = {
            x: 0,
            y: 0
        };
        this.targetRotation = {
            x: 0,
            y: 0
        };

        // Stronger tilt applied while dragging (inverse of hover direction)
        this.dragTiltStrength = 0.3;

        // Follow speeds for tilt smoothing (dragging reacts faster)
        this.hoverTiltFollow = 0.10;
        this.dragTiltFollow = 0.35;

        // Position state
        this.position = {
            x: 0,
            y: 0
        };

        // Spring configuration for drag return animation (base values)
        this.baseSpringStrength = 0.05; // base spring strength when returning to center
        this.baseSpringDamping = 0.78;   // slightly higher damping for stability

        // Snap-back boost (temporary snapback on release)
        this.snapSpringStrength = 0.18;  // stronger spring for quick snap
        this.snapSpringDamping = 0.63;   // allow a tiny bit of bounce
        this.snapBoostDuration = 140;    // ms duration of the boosted snap back
        this.snapBoostEndTime = 0;       // timestamp when snap boost ends
        this.releaseBoost = 0.25;        // initial inward velocity on release
        this.velocity = {
            x: 0,
            y: 0
        };

        // Position limits and drag resistance
        // Tighter limits to keep the card near center, with soft saturation
        this.positionLimits = {
            x: 0.85,
            y: 0.85
        }; // Soft maximum distance from center (soft-clamped via tanh)
        // Exponential drag resistance factor (higher => stronger resistance with distance)
        this.dragResistance = 1.85;

        // Flip animation
        this.flipDuration = 0.26; // seconds
        this.flipProgress = 0;
        this.flipTarget = 0;
        this.flipStartTime = null; // only start timing on user click

        this.init();

        // Ensure CTA timer aligns with actual active view state
        // Start when card view becomes active; clear when leaving
        stateManager.onViewChange((view: string) => {
            if (view === ViewState.CARD) {
                this._startCtaTimer();
            } else {
                this._clearCtaTimers();
            }
        });
    }

    //==============================================================================================
    /**
     * Initialize the card
     * @description Sets up Three.js scene, creates card, and starts animation
     */
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
        (this.container as HTMLElement).appendChild(this.renderer.domElement);

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
        const loadTexture = (url: string) => {
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
        let cardWidth: number, cardHeight: number;

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
            cardWidth = viewHeight * aspect;
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
        (this.container as HTMLElement).addEventListener('click', (e: MouseEvent) => {
            const dragDuration = Date.now() - this.dragStartTime;
            const isDragGesture = this.dragDistance > 5 || dragDuration > 200;

            if (!isDragGesture && this.isMouseOverCard(e as unknown as PointerEvent)) {
                this.flipCard();
                this.hasInteracted = true;
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
                triggerStarfieldWarp();
            }

            // Reset drag tracking
            this.dragDistance = 0;
        });

        // Pointer move for rotation and dragging
        const handlePointerMove = (e: PointerEvent) => {
            // Check if pointer has left the window
            if (e.clientX <= 0 || e.clientX >= window.innerWidth ||
                e.clientY <= 0 || e.clientY >= window.innerHeight) {
                if (this.isDragging) {
                    // Trigger snap-back on release when leaving the window bounds
                    this.onDragRelease();
                    this.isDragging = false;
                (this.container as HTMLElement).releasePointerCapture(e.pointerId);
                }
                (this.container as HTMLElement).style.cursor = 'default';
                return;
            }

            if (this.isDragging) {
                this.handleDrag(e);
            } else if (this.isMouseOverCard(e)) {
                this.handleHover(e);
            } else {
                this.targetRotation.x = 0;
                this.targetRotation.y = 0;
                (this.container as HTMLElement).style.cursor = 'default';
            }
        };

        (this.container as HTMLElement).addEventListener('pointermove', handlePointerMove);

        // Mouse leave to reset rotation and cursor
        (this.container as HTMLElement).addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                this.targetRotation.x = 0;
                this.targetRotation.y = 0;
            }
        });

        // Pointer down for dragging
        (this.container as HTMLElement).addEventListener('pointerdown', (e: PointerEvent) => {
            if (this.isMouseOverCard(e)) {
                this.isDragging = true;
                this.dragStartTime = Date.now();
                this.dragDistance = 0;
                this.previousMousePosition = {
                    x: e.clientX,
                    y: e.clientY
                };
                // Clear any residual spring velocity so dragging starts from rest
                this.velocity.x = 0;
                this.velocity.y = 0;
                // Store the initial drag offset
                // this.dragOffset = this.calculateDragOffset(e);

                // Capture the pointer to track it even outside the window
                (this.container as HTMLElement).setPointerCapture(e.pointerId);
            }
        });

        // Pointer up to stop dragging
        (this.container as HTMLElement).addEventListener('pointerup', (e: PointerEvent) => {
            if (this.isDragging) {
                this.isDragging = false;
                (this.container as HTMLElement).releasePointerCapture(e.pointerId);
                this.onDragRelease();
            }
        });

        // Handle when pointer is lost (e.g., leaves window)
        (this.container as HTMLElement).addEventListener('lostpointercapture', () => {
            const wasDragging = this.isDragging;
            this.isDragging = false;
            if (wasDragging) this.onDragRelease();
        });

        // Backup: also handle when window loses focus
        window.addEventListener('blur', () => {
            const wasDragging = this.isDragging;
            if (wasDragging) {
                this.isDragging = false;
                this.onDragRelease();
            }
        });
    }

    //==============================================================================================
    /**
     * Handle drag interaction
     * @description Updates card position based on drag movement
     * @param {PointerEvent} e - pointer event
     */
    handleDrag(e: PointerEvent) {
        // Calculate drag movement in screen coordinates
        const movementX = e.clientX - this.previousMousePosition.x;
        const movementY = e.clientY - this.previousMousePosition.y;

        // Track total drag distance for click detection
        this.dragDistance += Math.sqrt(movementX * movementX + movementY * movementY);

        // Convert screen movement to world space movement
        const worldMovementX = (movementX / window.innerWidth) * 1.5;
        const worldMovementY = -(movementY / window.innerHeight) * 1.5;

        // Calculate distance from center for resistance
        const currentDistance = Math.hypot(this.position.x, this.position.y);

        // Exponential distance-based resistance: slight at first, stronger farther out
        // resistance in (0,1], equals 1 at center and decays exponentially with distance
        const resistance = Math.exp(-this.dragResistance * currentDistance);

        // Update position using resistance
        const newX = this.position.x + (worldMovementX * resistance);
        const newY = this.position.y + (worldMovementY * resistance);

        // Soft-clamp using tanh to prevent straying too far from center (rubber-band feel)
        const softX = this.positionLimits.x * Math.tanh(newX / this.positionLimits.x);
        const softY = this.positionLimits.y * Math.tanh(newY / this.positionLimits.y);

        // Final safety clamp (hard cap) just in case
        this.position.x = Math.max(-this.positionLimits.x, Math.min(this.positionLimits.x, softX));
        this.position.y = Math.max(-this.positionLimits.y, Math.min(this.positionLimits.y, softY));

        // Update previous position for next frame
        this.previousMousePosition = {
            x: e.clientX,
            y: e.clientY
        };

        // While dragging, tilt aggressively in the opposite direction of the pointer
        const rect = (this.container as HTMLElement).getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.targetRotation.x = y * this.dragTiltStrength;   // invert hover's -y
        this.targetRotation.y = -x * this.dragTiltStrength;  // invert hover's +x
        (this.container as HTMLElement).style.cursor = 'grabbing';
    }

    //==============================================================================================
    /**
     * Handle drag release snap-back setup
     * @description Seeds inward velocity and enables temporary spring boost for a snappy return
     */
    onDragRelease() {
        const dist = Math.hypot(this.position.x, this.position.y);
        // Only snap if we're away from center by a noticeable amount
        if (dist > 0.005) {
            this.snapBoostEndTime = performance.now() + this.snapBoostDuration;
            // Add an inward velocity impulse proportional to displacement
            this.velocity.x += (-this.position.x) * this.releaseBoost;
            this.velocity.y += (-this.position.y) * this.releaseBoost;
        }

        // BT 2025-11-15: mobile gets stuck without "hover" event; manually relax back to neutral
        this.targetRotation.x = 0;
        this.targetRotation.y = 0;
    }

    //==============================================================================================
    /**
     * Handle hover interaction
     * @description Updates card rotation based on mouse position
     * @param {PointerEvent} e - The pointer event
     */
    handleHover(e: PointerEvent) {
        const rect = (this.container as HTMLElement).getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        // Calculate target rotation with tilt limits
        this.targetRotation.x = -y * 0.3;
        this.targetRotation.y = x * 0.3;

        // Set cursor to pointer when hovering over card
        (this.container as HTMLElement).style.cursor = 'pointer';
    }

    //==============================================================================================
    /**
     * Check if mouse is over the card
     * @description Uses raycasting to detect if mouse is over card
     * @param {PointerEvent} event - pointer event
     * @returns {boolean} True if mouse is over card
     */
    isMouseOverCard(event: PointerEvent): boolean {
        const rect = (this.container as HTMLElement).getBoundingClientRect();
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
            const now = performance.now();
            const useSnap = now < this.snapBoostEndTime;
            const springStrength = useSnap ? this.snapSpringStrength : this.baseSpringStrength;
            const springDamping = useSnap ? this.snapSpringDamping : this.baseSpringDamping;

            // Calculate spring force
            const springForceX = -this.position.x * springStrength;
            const springForceY = -this.position.y * springStrength;

            // Apply spring physics
            this.velocity.x += springForceX;
            this.velocity.y += springForceY;

            // Apply damping
            this.velocity.x *= springDamping;
            this.velocity.y *= springDamping;

            // Update position
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;

            // Snap to exact center when very close to avoid micro jitter
            if (Math.abs(this.position.x) < 0.0005) this.position.x = 0;
            if (Math.abs(this.position.y) < 0.0005) this.position.y = 0;
        }
    }

    //==============================================================================================
    /**
     * Main animation loop
     * @description Updates card position, rotation, and flip state
     * @param {number} timestamp - Current animation timestamp
     */
    animate(timestamp: number) {
        // first frame: seed lastTimestamp so it's never undefined
        if (this.lastTimestamp === undefined) {
            this.lastTimestamp = timestamp;
        }
        // Performance monitor: frame start
        perf.loopFrameStart('card');

        // Perf: update segment
        const segUpdate = perf.segmentStart('card', 'update');
        // spring return animation
        this.updateSpringAnimation();

        // smooth tilt - faster while dragging
        const tiltFollow = this.isDragging ? this.dragTiltFollow : this.hoverTiltFollow;
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * tiltFollow;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * tiltFollow;

        // only run ease-out flip when flipStartTime is set (i.e. after click)
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
        perf.segmentEnd(segUpdate);

        // render & queue next frame
        const segRender = perf.segmentStart('card', 'render');
        this.renderer.render(this.scene, this.camera);
        perf.segmentEnd(segRender);

        // Signal to subscribers that the card is ready
        if (this._resolveReady) {
            this._resolveReady();
            this._resolveReady = null;
        }

        // Perf: frame end
        perf.loopFrameEnd('card');

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
        const cardSize = (this.card.geometry as any).parameters;
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
        if (this.tapIndicator) {
            this.tapIndicator.style.left = `${x}px`;
            this.tapIndicator.style.top = `${y}px`;
            this.tapIndicator.style.right = 'auto';
            this.tapIndicator.style.bottom = 'auto';
        }

        if (this.tapIndicatorMobile) {
            this.tapIndicatorMobile.style.left = `${x}px`;
            this.tapIndicatorMobile.style.top = `${y}px`;
            this.tapIndicatorMobile.style.right = 'auto';
            this.tapIndicatorMobile.style.bottom = 'auto';
        }
    }

    //==============================================================================================
    /**
     * Start CTA (tap indicator) timer if card is visible
     * @description Schedules show/hide of the tap indicator only when card view is active
     */
    _startCtaTimer() {
        // Always clear any existing timers before starting a new one
        this._clearCtaTimers();

        // Do not schedule if the card is hidden
        if (!this.container || this.container.classList.contains('hidden')) {
            return;
        }

        // If user has already interacted, never show CTA again this session
        if (this.hasInteracted) {
            return;
        }

        this._showTapTimeout = setTimeout(() => {
            // If hidden by the time we fire, abort
            if ((this.container as HTMLElement).classList.contains('hidden')) {
                return;
            }

            if (isMobile()) {
                this.tapIndicatorMobile?.classList.add('visible');
            } else {
                this.tapIndicator?.classList.add('visible');
            }

            this._hideTapTimeout = setTimeout(() => {
                if (isMobile()) {
                    this.tapIndicatorMobile?.classList.remove('visible');
                } else {
                    this.tapIndicator?.classList.remove('visible');
                }
            }, 14200);
        }, 2250);
    }

    //==============================================================================================
    /**
     * Clear CTA timers and hide indicators
     */
    _clearCtaTimers() {
        if (this._showTapTimeout) {
            clearTimeout(this._showTapTimeout);
            this._showTapTimeout = null;
        }
        if (this._hideTapTimeout) {
            clearTimeout(this._hideTapTimeout);
            this._hideTapTimeout = null;
        }
        if (this.tapIndicator) {
            this.tapIndicator.classList.remove('visible');
        }
        if (this.tapIndicatorMobile) {
            this.tapIndicatorMobile.classList.remove('visible');
        }
    }

    //==============================================================================================
    /**
     * Hide the card with scale-back animation
     * @description Scales down, fades out, and blurs the card container
     */
    hide() {
        if (!this.container) {
            console.warn('Card container not found for hide()');
            return;
        }
        
        this.container.classList.add('hidden');

        // Cancel CTA and hide indicators when leaving card view
        this._clearCtaTimers();
    }

    //==============================================================================================
    /**
     * Show the card with 3D scale-forward animation
     * @description Scales up, fades in, and removes blur from card container
     */
    show() {
        if (!this.container) {
            console.warn('Card container not found for show()');
            return;
        }

        this.container.classList.remove('hidden');

        // Start CTA timer now that card view is active
        this._startCtaTimer();
    }
}

// Initialize when DOM is loaded and expose to state manager
let card3DInstance: any = null;

document.addEventListener('DOMContentLoaded', () => {
    card3DInstance = new Card();
    card3DInstance.ready = card3DInstance.readyPromise;
    window.addEventListener('resize', () => card3DInstance.onWindowResize());
    
    // Expose to window for state manager
    (window as any).card3DInstance = card3DInstance;
});
