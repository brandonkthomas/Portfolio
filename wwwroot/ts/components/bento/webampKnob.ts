/**
 * webampKnob.ts
 * @fileoverview WebAmp logo knob component that uses two PNG layers.
 * The bottom layer stays fixed while the top layer rotates smoothly based on mouse
 * position across the bento card, creating the illusion of the dial rotating.
 */

import { logEvent, LogData, LogLevel } from '../../common.js';

const logWebAmpKnob = (event: string, data?: LogData, note?: string, level: LogLevel = 'info') => {
    logEvent('webampKnob', event, data, note, level);
};

export const stylesHref = '/css/components/bento/webampKnob.css';

interface WebAmpKnobProps {
    /**
     * Optional maximum rotation in degrees from the top position.
     * Defaults to 45.
     */
    maxAngle?: number;
}

//==============================================================================================
/**
 * Mount the WebAmp knob component
 * @param {HTMLElement} container - Container element (bento tile content)
 * @param {WebAmpKnobProps} props - Optional configuration props
 * @returns {Promise<Object>} Component instance with setSize, update, destroy methods
 */
export async function mount(container: HTMLElement, props: WebAmpKnobProps = {}) {
    const root = document.createElement('div');
    root.className = 'comp-webamp-knob';

    const shell = document.createElement('div');
    shell.className = 'wak-shell';

    const base = document.createElement('img');
    base.className = 'wak-layer wak-layer-base';
    base.alt = '';
    base.decoding = 'async';
    base.loading = 'eager';
    base.fetchPriority = 'high';

    const overlay = document.createElement('img');
    overlay.className = 'wak-layer wak-layer-overlay';
    overlay.alt = '';
    overlay.decoding = 'async';
    overlay.loading = 'eager';
    overlay.fetchPriority = 'high';

    const waitForImage = (image: HTMLImageElement, src: string): Promise<void> => new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            resolve();
        };
        const timeoutId = window.setTimeout(finish, 3000);
        image.addEventListener('load', finish, { once: true });
        // Preserve the component fallback even if an optional visual asset is unavailable.
        image.addEventListener('error', finish, { once: true });
        image.src = src;
        if (image.complete) resolve();
    });

    await Promise.all([
        waitForImage(base, '/assets/images/webamp/icon-WebAmp-full512-layer1.png'),
        waitForImage(overlay, '/assets/images/webamp/icon-WebAmp-full512-layer2.png')
    ]);

    // Avoid CSS transition restarts that cause micro-stutter; we animate via RAF instead
    overlay.style.willChange = 'transform';
    overlay.style.transition = 'transform 0s';

    shell.append(base, overlay);
    root.appendChild(shell);
    container.appendChild(root);

    const state: { maxAngle: number; currentAngle: number; targetAngle: number } = {
        maxAngle: Number.isFinite(props.maxAngle as number) ? Math.abs(props.maxAngle as number) : 45,
        currentAngle: 0,
        targetAngle: 0
    };

    const applyAngle = () => {
        root.style.setProperty('--wak-angle', `${state.currentAngle}deg`);
    };

    const setTargetAngle = (angle: number) => {
        const clamped = Math.max(-state.maxAngle, Math.min(state.maxAngle, angle));
        state.targetAngle = clamped;
    };

    // RAF-based smoothing so transitions continue smoothly while pointer moves
    const follow = 0.18;
    let rafId: number | null = null;
    let destroyed = false;
    let active = true;

    const tick = () => {
        rafId = null;
        if (destroyed || !active) return;
        const delta = state.targetAngle - state.currentAngle;
        if (Math.abs(delta) > 0.01) {
            state.currentAngle += delta * follow;
            applyAngle();
            rafId = requestAnimationFrame(tick);
        } else {
            state.currentAngle = state.targetAngle;
            applyAngle();
        }
    };

    const startAnimation = () => {
        if (!destroyed && active && rafId == null) {
            rafId = requestAnimationFrame(tick);
        }
    };

    // Seed initial angle and start animation loop
    state.currentAngle = 0;
    state.targetAngle = 0;
    applyAngle();
    logWebAmpKnob('Mounted', { maxAngle: state.maxAngle });

    let hovering = false;

    const computeAngleFromPointer = (ev: PointerEvent): number => {
        const rect = container.getBoundingClientRect();
        if (!rect.width) return 0;
        const centerX = rect.left + rect.width / 2;
        const dx = ev.clientX - centerX;
        const halfWidth = rect.width / 2 || 1;
        const normalized = dx / halfWidth; // -1 at far left, +1 at far right
        return normalized * state.maxAngle;
    };

    const handlePointerMove = (ev: PointerEvent) => {
        if (!hovering) return;
        const angle = computeAngleFromPointer(ev);
        setTargetAngle(angle);
        startAnimation();
    };

    const handlePointerEnter = (ev: PointerEvent) => {
        hovering = true;
        const angle = computeAngleFromPointer(ev);
        setTargetAngle(angle);
        startAnimation();
    };

    const resetAngle = () => {
        hovering = false;
        setTargetAngle(0);
        startAnimation();
    };

    container.addEventListener('pointerenter', handlePointerEnter);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', resetAngle);
    container.addEventListener('pointercancel', resetAngle);

    return {
        setSize({ width, height }: { width: number; height: number }) {
            // Use the smaller of width/height to size the logo and keep it nicely centered
            const baseSize = Math.min(width, height);
            const size = Math.min(192, Math.max(96, Math.round(baseSize * 0.6)));
            root.style.setProperty('--wak-logo-size', `${size}px`);
        },
        update(nextProps: WebAmpKnobProps) {
            if (nextProps && typeof nextProps.maxAngle === 'number' && Number.isFinite(nextProps.maxAngle)) {
                state.maxAngle = Math.max(0, Math.min(90, Math.abs(nextProps.maxAngle)));
                setTargetAngle(0);
                startAnimation();
                logWebAmpKnob('Props Updated', { maxAngle: state.maxAngle });
            }
        },
        setActive(nextActive: boolean) {
            active = nextActive;
            if (!active) {
                hovering = false;
                if (rafId != null) cancelAnimationFrame(rafId);
                rafId = null;
                state.targetAngle = 0;
                state.currentAngle = 0;
                applyAngle();
            }
        },
        destroy() {
            container.removeEventListener('pointerenter', handlePointerEnter);
            container.removeEventListener('pointermove', handlePointerMove);
            container.removeEventListener('pointerleave', resetAngle);
            container.removeEventListener('pointercancel', resetAngle);
            destroyed = true;
            if (rafId != null) {
                cancelAnimationFrame(rafId);
            }
            root.remove();
            logWebAmpKnob('Destroyed');
        }
    };
}
