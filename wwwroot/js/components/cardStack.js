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
export async function mount(container, props = {}) {
    const root = document.createElement('div');
    root.className = 'card-stack';

    // Card layers -- currently 3 stacked
    const l1 = document.createElement('div'); l1.className = 'card-layer layer-1';
    const l2 = document.createElement('div'); l2.className = 'card-layer layer-2';
    const l3 = document.createElement('div'); l3.className = 'card-layer layer-3';
    root.append(l1, l2, l3);
    container.appendChild(root);

    // Pointer-driven subtle parallax
    const handlePointer = (e) => {
        const rect = container.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        l1.style.transform = `translate3d(${-18 + dx * -10}px, ${16 + dy * 8}px, 0) rotate(${-10 + dx * -6}deg) scale(0.98)`;
        l2.style.transform = `translate3d(${8 + dx * 12}px, ${-4 + dy * 6}px, 0) rotate(${4 + dx * 4}deg) scale(1.02)`;
        l3.style.transform = `translate3d(${24 + dx * 16}px, ${-20 + dy * -8}px, 0) rotate(${12 + dx * 6}deg) scale(1.0)`;
    };
    const resetPointer = () => {
        l1.style.transform = '';
        l2.style.transform = '';
        l3.style.transform = '';
    };

    // Add event listeners for pointer movement, leave, and cancel
    root.addEventListener('pointermove', handlePointer);
    root.addEventListener('pointerleave', resetPointer);
    root.addEventListener('pointercancel', resetPointer);
    root.addEventListener('touchstart', () => {
        l2.style.transform = 'translate3d(10px, -6px, 0) rotate(6deg) scale(1.04)';
    }, { passive: true });
    root.addEventListener('touchend', resetPointer, { passive: true });

    return {
        setSize({ width, height }) {
            // Parent already sets --stack-h; nothing extra required, but hook remains for future
        },
        update(nextProps) {
            // No-op for now; would update based on props
        },
        destroy() {
            root.removeEventListener('pointermove', handlePointer);
            root.removeEventListener('pointerleave', resetPointer);
            root.removeEventListener('pointercancel', resetPointer);
            root.remove();
        }
    };
}
