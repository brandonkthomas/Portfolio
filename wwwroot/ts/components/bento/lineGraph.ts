/**
 * lineGraph.js
 * @fileoverview Line graph component with animated waves (for Projects view)
 */

import { logEvent, LogData, LogLevel } from '../../common.js';

const logLineGraph = (event: string, data?: LogData, note?: string, level: LogLevel = 'info') => {
	logEvent('lineGraph', event, data, note, level);
};
export const stylesHref = '/css/components/bento/lineGraph.css';

//==============================================================================================
/**
 * Mount the line graph component
 * @param {HTMLElement} container - Container element
 * @param {Object} props - Component props with optional width/height
 * @returns {Promise<Object>} Component instance with setSize, update, destroy methods
 */
export async function mount(container: HTMLElement, props: { width?: number; height?: number } = {}) {
    const root = document.createElement('div');
    root.className = 'comp-line-graph';

    // Grid background
    const grid = document.createElement('div');
    grid.className = 'lg-grid';
    root.appendChild(grid);

    // Canvas for drawing the waves
    const { width = container.clientWidth || 300, height = container.clientHeight || 200 } = props;
    let { canvas, ctx } = createCanvas(width, height);
    canvas.className = 'lg-canvas';
    root.appendChild(canvas);
    container.appendChild(root);
    logLineGraph('Mounted', { width, height });

    // Animation state
    let running = false;
    let lastW = width, lastH = height;
    let t = 0;
    const wave = genWaveFn();

    // Draw once (idle state)
    drawFrame();

    // Animate only on hover of the tile
    const tile = (container.closest('.bento-item') as HTMLElement) || root;
    const onEnter = () => { if (!running) { running = true; requestAnimationFrame(loop); } };
    const onLeave = () => { running = false; drawFrame(); };
    const onEnterLogged = () => {
        onEnter();
    };
    tile.addEventListener('pointerenter', onEnterLogged);
    tile.addEventListener('pointerleave', onLeave);

    /**
     * Resize the canvas
     * @param {Object} size - Size object with width and height
     */
    function resize({ width, height }: { width: number; height: number }) {
        lastW = Math.max(1, Math.floor(width));
        lastH = Math.max(1, Math.floor(height));
        
        const r = createCanvas(lastW, lastH);
        // replace canvas node to update backing size cleanly
        root.replaceChild(r.canvas, canvas);
        canvas = r.canvas; ctx = r.ctx; canvas.className = 'lg-canvas';
    }

    /**
     * Draw a frame of the animation
     */
    function drawFrame() {
        ctx.clearRect(0, 0, lastW, lastH);

        // Edge-to-edge drawing
        const padX = 0;
        const padY = 0;
        const baseY = Math.min(lastH - 1, Math.max(0, lastH * 0.7));
        const amp = Math.max(8, lastH * 0.28);

        // Draw the waves
        ctx.beginPath();
        const steps = Math.max(24, Math.floor(lastW / 4));
        for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            const x = padX + u * (lastW - padX * 2);
            let y = baseY - wave(u * 4, t) * amp;
            if (y < 1) y = 1; if (y > lastH - 1) y = lastH - 1;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }

        ctx.lineWidth = Math.max(1.5, lastH * 0.008);
        ctx.strokeStyle = 'rgba(54, 227, 156, 0.9)';
        ctx.stroke();

        // Gradient for the waves
        const g = ctx.createLinearGradient(0, baseY - amp, 0, lastH);
        g.addColorStop(0.0, 'rgba(54, 227, 201, 0.4)');
        g.addColorStop(0.6, 'rgba(54, 227, 156, 0.2)');
        g.addColorStop(1.0, 'rgba(54, 227, 156, 0.0)');
        ctx.lineTo(lastW - padX, lastH - padY);
        ctx.lineTo(padX, lastH - padY);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
    }

    /**
     * Main animation loop
     */
    function loop() {
        if (!running) return;
        t += 0.015;
        drawFrame();
        requestAnimationFrame(loop);
    }

    return {
        setSize({ width, height }: { width: number; height: number }) { resize({ width, height }); drawFrame(); },
        update(nextProps: Record<string, unknown>) { /* future */ },
        destroy() { running = false; tile.removeEventListener('pointerenter', onEnterLogged); tile.removeEventListener('pointerleave', onLeave); root.remove(); logLineGraph('Destroyed'); }
    };
}

//==============================================================================================
/**
 * Create a canvas with device pixel ratio scaling
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} Canvas, context, and device pixel ratio
 */
function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; dpr: number } {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { canvas, ctx, dpr };
}

//==============================================================================================
/**
 * Generate wave function with smooth multi-sine blend
 * @param {number} seed - Random seed for wave generation
 * @returns {Function} Wave function taking x and t parameters
 */
function genWaveFn(seed: number = Math.random() * 1000): (x: number, t: number) => number {
    // Smooth multi-sine blend
    const p1 = seed + Math.random() * 1000;
    const p2 = seed + Math.random() * 1000;
    const p3 = seed + Math.random() * 1000;

    return (x: number, t: number) => {
        const a = Math.sin(x * 1.5 + t * 0.9 + p1) * 0.5 + 0.5;
        const b = Math.sin(x * 0.7 + t * 0.6 + p2) * 0.5 + 0.5;
        const c = Math.sin(x * 2.2 + t * 0.3 + p3) * 0.5 + 0.5;
        // Weighted blend for smoother curve
        return (a * 0.5 + b * 0.35 + c * 0.15);
    };
}
