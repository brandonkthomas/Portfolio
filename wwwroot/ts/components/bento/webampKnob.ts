/**
 * webampKnob.ts
 * @fileoverview WebAmp logo knob component that uses two PNG layers.
 * The bottom layer stays fixed while the top layer rotates smoothly based on mouse
 * position across the bento card, creating the illusion of the dial rotating.
 */

import { logEvent, LogData, LogLevel } from '../../common';

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
    base.src = '/assets/images/webamp/icon-WebAmp-full512-layer1.png';
    base.alt = '';

    const overlay = document.createElement('img');
    overlay.className = 'wak-layer wak-layer-overlay';
    overlay.src = '/assets/images/webamp/icon-WebAmp-full512-layer2.png';
    overlay.alt = '';

    shell.append(base, overlay);
    root.appendChild(shell);
    container.appendChild(root);

    const state: { maxAngle: number } = {
        maxAngle: Number.isFinite(props.maxAngle as number) ? Math.abs(props.maxAngle as number) : 45
    };

    const setAngle = (angle: number) => {
        const clamped = Math.max(-state.maxAngle, Math.min(state.maxAngle, angle));
        root.style.setProperty('--wak-angle', `${clamped}deg`);
    };

    setAngle(0);
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
        setAngle(angle);
    };

    const handlePointerEnter = (ev: PointerEvent) => {
        hovering = true;
        const angle = computeAngleFromPointer(ev);
        setAngle(angle);
    };

    const resetAngle = () => {
        hovering = false;
        setAngle(0);
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
                setAngle(0);
                logWebAmpKnob('Props Updated', { maxAngle: state.maxAngle });
            }
        },
        destroy() {
            container.removeEventListener('pointerenter', handlePointerEnter);
            container.removeEventListener('pointermove', handlePointerMove);
            container.removeEventListener('pointerleave', resetAngle);
            container.removeEventListener('pointercancel', resetAngle);
            root.remove();
            logWebAmpKnob('Destroyed');
        }
    };
}

