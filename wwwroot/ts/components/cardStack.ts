/**
 * cardStack.js
 * @fileoverview Card stack component with subtle parallax (for Projects view)
 */

export const stylesHref = '/css/components/cardStack.css';

//==============================================================================================
/**
 * Mount the card stack component
 * @param {Element} container
 * @param {Object} props
 * @returns {Promise<{setSize: () => void, update: (nextProps: Object) => void, destroy: () => void}>}
 */
export async function mount(container: HTMLElement, props: Record<string, unknown> = {}) {
    const root = document.createElement('div');
    root.className = 'card-stack';

    // Card layers -- currently 3 stacked
    const l1 = document.createElement('div'); l1.className = 'card-layer layer-1';
    const l2 = document.createElement('div'); l2.className = 'card-layer layer-2';
    const l3 = document.createElement('div'); l3.className = 'card-layer layer-3';
    root.append(l1, l2, l3);
    container.appendChild(root);

    // avoid CSS transition restarts (BT: was causing stutter during mouse movement)
    [l1, l2, l3].forEach(layer => {
        layer.style.willChange = 'transform';
        layer.style.transition = 'transform 0s';
    });

    // Animation state with RAF smoothing (avoids resetting CSS transitions on every move)
    interface LayerState {
        el: HTMLElement;
        // base pose
        baseX: number;
        baseY: number;
        baseRot: number;
        baseScale: number;
        // pointer influence multipliers (BT: max skew per layer)
        dxMult: number;
        dyMult: number;
        rotMult: number;
        // animated values
        currentX: number;
        currentY: number;
        currentRot: number;
        currentScale: number;
        targetX: number;
        targetY: number;
        targetRot: number;
        targetScale: number;
    }

    // settings for each layer
    const layers: LayerState[] = [
        {
            el: l1,
            baseX: -18, 
            baseY: 16, 
            baseRot: -10, 
            baseScale: 0.98,
            dxMult: -10, 
            dyMult: 14, 
            rotMult: -6,
            currentX: -18, 
            currentY: 16, 
            currentRot: -10,
            currentScale: 0.98,
            targetX: -18, 
            targetY: 16, 
            targetRot: -10, 
            targetScale: 0.98
        },
        {
            el: l2,
            baseX: 8, 
            baseY: -4, 
            baseRot: 4, 
            baseScale: 1.02,
            dxMult: 1, 
            dyMult: 0, 
            rotMult: 4,
            currentX: 8, 
            currentY: -4, 
            currentRot: 4, 
            currentScale: 1.02,
            targetX: 8, 
            targetY: -4, 
            targetRot: 4, 
            targetScale: 1.02
        },
        {
            el: l3,
            baseX: 24, 
            baseY: -20, 
            baseRot: 12, 
            baseScale: 1.0,
            dxMult: 16, 
            dyMult: -14, 
            rotMult: 6,
            currentX: 24, 
            currentY: -20, 
            currentRot: 12, 
            currentScale: 1.0,
            targetX: 24, 
            targetY: -20, 
            targetRot: 12, 
            targetScale: 1.0
        }
    ];

    const applyTransform = (layer: LayerState) => {
        layer.el.style.transform =
            `translate3d(${layer.currentX}px, ${layer.currentY}px, 0) rotate(${layer.currentRot}deg) scale(${layer.currentScale})`;
    };

    // Seed initial transforms
    layers.forEach(applyTransform);

    // Smooth follow factor (slightly underdamped)
    const follow = 0.14;
    let rafId: number | null = null;
    let destroyed = false;

    const tick = () => {
        // Animate current values toward targets
        for (const layer of layers) {
            layer.currentX += (layer.targetX - layer.currentX) * follow;
            layer.currentY += (layer.targetY - layer.currentY) * follow;
            layer.currentRot += (layer.targetRot - layer.currentRot) * follow;
            layer.currentScale += (layer.targetScale - layer.currentScale) * follow;
            applyTransform(layer);
        }
        if (!destroyed) {
            rafId = requestAnimationFrame(tick);
        }
    };
    rafId = requestAnimationFrame(tick);

    const setTargetsFromPointer = (dx: number, dy: number) => {
        // Compute target pose for each layer from normalized pointer dx/dy
        for (const layer of layers) {
            layer.targetX = layer.baseX + dx * layer.dxMult;
            layer.targetY = layer.baseY + dy * layer.dyMult;
            layer.targetRot = layer.baseRot + dx * layer.rotMult;
            layer.targetScale = layer.baseScale;
        }
    };

    // Pointer driven parallax (updates targets only-- RAF handles easing)
    const handlePointer = (e: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        setTargetsFromPointer(dx, dy);
    };

    const resetPointer = () => {
        // Ease back to base pose
        for (const layer of layers) {
            layer.targetX = layer.baseX;
            layer.targetY = layer.baseY;
            layer.targetRot = layer.baseRot;
            layer.targetScale = layer.baseScale;
        }
    };

    // Add event listeners for pointer movement, leave, and cancel
    container.addEventListener('pointermove', handlePointer);
    container.addEventListener('pointerleave', resetPointer);
    container.addEventListener('pointercancel', resetPointer);
    root.addEventListener('touchstart', () => {
        // Gentle nudge on middle layer for mobile tap
        const mid = layers[1];
        mid.targetX = 10;
        mid.targetY = -6;
        mid.targetRot = 6;
        mid.targetScale = 1.04;
    }, { passive: true });
    root.addEventListener('touchend', resetPointer, { passive: true });

    return {
        setSize({ width, height }: { width: number; height: number }) {
            // Parent already sets --stack-h; nothing extra required, but hook remains for future
        },
        update(nextProps: Record<string, unknown>) {
            // No-op for now; would update based on props
        },
        destroy() {
            container.removeEventListener('pointermove', handlePointer);
            container.removeEventListener('pointerleave', resetPointer);
            container.removeEventListener('pointercancel', resetPointer);
            destroyed = true;
            if (rafId != null) cancelAnimationFrame(rafId);
            root.remove();
        }
    };
}
