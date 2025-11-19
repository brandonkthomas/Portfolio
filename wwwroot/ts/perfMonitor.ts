/**
 * perfMonitor.js
 * @fileoverview Performance monitoring and diagnostics for Three.js scenes
 */

import { isDebug } from './common';

type SegmentId = number;

interface SegmentOpen {
    id: SegmentId;
    loop: string;
    name: string;
    t0: number;
}

interface SegmentTotals {
    totalMs: number;
    count: number;
}

interface LoopState {
    lastFrameTs?: number;
    frameStartTs?: number;
    frames: number;
    lastFpsUpdateTs: number;
    fps: number;
    longFrames: number;
    worstFrameMs: number;
    worstDeltaMs: number;
    currentFrameSegments: Array<{ name: string; duration: number }>;
    totalsBySegment: Map<string, SegmentTotals>;
}

class PerfMonitor {
    private enabled: boolean;
    private loops: Map<string, LoopState>;
    private openSegments: Map<SegmentId, SegmentOpen>;
    private overlayEl: HTMLDivElement | null;
    private overlayLastUpdateTs: number;
    private segIdCounter: number;
    private readonly longFrameThresholdMs: number;
    private readonly longDeltaThresholdMs: number;

    //==============================================================================================
    /**
     * Creates a new performance monitor instance
     * @constructor
     * @description Initializes the performance monitor with default settings
     */
    constructor() {
        this.enabled = isDebug();
        this.loops = new Map();
        this.openSegments = new Map();
        this.overlayEl = null;
        this.overlayLastUpdateTs = 0;
        this.segIdCounter = 0;

        // Thresholds tuned for visible stutter on 60Hz displays; still useful at 120Hz
        this.longFrameThresholdMs = 16.7 * 1.25; // ~21ms
        this.longDeltaThresholdMs = 16.7 * 1.75; // ~29ms

        // Expose to window for devtools access
        (window as any).perf = this.getPublicAPI();

        // Start overlay if debug mode is enabled
        if (this.enabled) {
            this.startOverlay();
        }
    }

    //==============================================================================================
    /**
     * Ensures a loop exists in the performance monitor
     * @param {string} loopName - The name of the loop to ensure
     * @returns {LoopState} The loop state
     */
    private ensureLoop(loopName: string): LoopState {
        let loop = this.loops.get(loopName);
        if (!loop) {
            loop = {
                frames: 0,
                lastFpsUpdateTs: performance.now(),
                fps: 0,
                longFrames: 0,
                worstFrameMs: 0,
                worstDeltaMs: 0,
                currentFrameSegments: [],
                totalsBySegment: new Map()
            };
            this.loops.set(loopName, loop);
        }
        return loop;
    }

    //==============================================================================================
    /**
     * Sets the enabled status of the performance monitor
     * @param {boolean} enabled - Whether the performance monitor should be enabled
     */
    setEnabled(enabled: boolean) {
        this.enabled = !!enabled;
        if (!this.enabled) {
            this.stopOverlay();
            this.reset(); // keep state clean when disabled
        }
    }

    //==============================================================================================
    /**
     * Checks if the performance monitor is enabled
     * @returns {boolean} True if the performance monitor is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    //==============================================================================================
    /**
     * Starts a loop frame in the performance monitor
     * @param {string} loopName - The name of the loop to start
     */
    loopFrameStart(loopName: string) {
        if (!this.enabled) return;
        const now = performance.now();
        const loop = this.ensureLoop(loopName);
        if (loop.lastFrameTs != null) {
            const delta = now - loop.lastFrameTs;
            if (delta > loop.worstDeltaMs) loop.worstDeltaMs = delta;
        }
        loop.lastFrameTs = now;
        loop.frameStartTs = now;
        loop.currentFrameSegments.length = 0;
    }

    //==============================================================================================
    /**
     * Ends a loop frame in the performance monitor
     * @param {string} loopName - The name of the loop to end
     */
    loopFrameEnd(loopName: string) {
        if (!this.enabled) return;
        const now = performance.now();
        const loop = this.ensureLoop(loopName);
        if (loop.frameStartTs == null) return;

        const frameMs = now - loop.frameStartTs;
        loop.frames += 1;
        // Update FPS every ~500ms for stability
        if (now - loop.lastFpsUpdateTs >= 500) {
            const elapsed = (now - loop.lastFpsUpdateTs) / 1000;
            const fps = Math.round((loop.frames / elapsed) * 10) / 10;
            loop.fps = fps;
            loop.frames = 0;
            loop.lastFpsUpdateTs = now;
        }

        const delta = loop.lastFrameTs ? now - loop.lastFrameTs : 0;
        const isLongFrame = frameMs > this.longFrameThresholdMs;
        const isLongDelta = delta > this.longDeltaThresholdMs;
        if (isLongFrame || isLongDelta) {
            loop.longFrames += 1;
            if (frameMs > loop.worstFrameMs) loop.worstFrameMs = frameMs;
            if (delta > loop.worstDeltaMs) loop.worstDeltaMs = delta;

            // Identify top contributing segments this frame
            const segments = loop.currentFrameSegments.slice().sort((a, b) => b.duration - a.duration);
            const top = segments.slice(0, 3);
            // Console diagnostic
            // eslint-disable-next-line no-console
            console.warn(`[perf] ${loopName} stutter: frame=${frameMs.toFixed(2)}ms delta=${delta.toFixed(2)}ms`,
                top.map(s => `${s.name}:${s.duration.toFixed(2)}ms`).join(' | '));
        }

        this.updateOverlay(now);
    }

    //==============================================================================================
    /**
     * Starts a segment in the performance monitor
     * @param {string} loopName - The name of the loop to start the segment in
     * @param {string} segmentName - The name of the segment to start
     * @returns {SegmentId} The ID of the segment
     */
    segmentStart(loopName: string, segmentName: string): SegmentId {
        if (!this.enabled) return -1 as unknown as SegmentId;
        const segId = ++this.segIdCounter;
        this.openSegments.set(segId, { id: segId, loop: loopName, name: segmentName, t0: performance.now() });
        return segId;
    }

    //==============================================================================================
    /**
     * Ends a segment in the performance monitor
     * @param {SegmentId} segmentId - The ID of the segment to end
     */
    segmentEnd(segmentId: SegmentId) {
        if (!this.enabled) return;
        const open = this.openSegments.get(segmentId);
        if (!open) return;
        this.openSegments.delete(segmentId);
        const duration = performance.now() - open.t0;
        const loop = this.ensureLoop(open.loop);
        loop.currentFrameSegments.push({ name: open.name, duration });

        const totals = loop.totalsBySegment.get(open.name) || { totalMs: 0, count: 0 };
        totals.totalMs += duration;
        totals.count += 1;
        loop.totalsBySegment.set(open.name, totals);
    }

    //==============================================================================================
    /**
     * Starts the performance overlay
     * BT 2025-11-11: automatically started when debugging
     */
    startOverlay() {
        if (!this.enabled) return;
        if (this.overlayEl) return;
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.top = '8px';
        el.style.right = '8px';
        el.style.zIndex = '99999';
        el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        el.style.fontSize = '11px';
        el.style.lineHeight = '1.4';
        el.style.padding = '6px 8px';
        el.style.borderRadius = '6px';
        el.style.background = 'rgba(0,0,0,0.55)';
        el.style.color = '#e5e5e5';
        el.style.pointerEvents = 'none';
        el.style.whiteSpace = 'pre';
        el.style.backdropFilter = 'blur(4px)';
        this.overlayEl = el;
        document.body.appendChild(el);
        this.overlayLastUpdateTs = 0;
        this.updateOverlay(performance.now());
    }

    //==============================================================================================
    /**
     * Stops the performance overlay
     */
    stopOverlay() {
        if (this.overlayEl) {
            this.overlayEl.remove();
            this.overlayEl = null;
        }
    }

    //==============================================================================================
    /**
     * Resets the performance monitor
     */
    reset() {
        this.loops.clear();
        this.openSegments.clear();
        this.overlayLastUpdateTs = 0;
        this.segIdCounter = 0;
        if (this.overlayEl) {
            this.overlayEl.textContent = '';
        }
    }

    //==============================================================================================
    /**
     * Reports the performance monitor summary
     */
    report() {
        // eslint-disable-next-line no-console
        console.group('[perf] summary');
        for (const [loopName, loop] of this.loops) {
            // eslint-disable-next-line no-console
            console.group(`loop: ${loopName}`);
            // eslint-disable-next-line no-console
            console.log(`fps=${loop.fps} longFrames=${loop.longFrames} worstFrame=${loop.worstFrameMs.toFixed(2)}ms worstDelta=${loop.worstDeltaMs.toFixed(2)}ms`);
            const rows: Array<[string, number, number]> = [];
            for (const [seg, t] of loop.totalsBySegment.entries()) {
                rows.push([seg, t.totalMs, t.count]);
            }
            rows.sort((a, b) => b[1] - a[1]);
            // eslint-disable-next-line no-console
            console.table(rows.map(r => ({ segment: r[0], totalMs: r[1].toFixed(2), count: r[2] })));
            // eslint-disable-next-line no-console
            console.groupEnd();
        }
        // eslint-disable-next-line no-console
        console.groupEnd();
    }

    //==============================================================================================
    /**
     * Updates the performance overlay
     * @param {number} now - The current time
     */
    private updateOverlay(now: number) {
        if (!this.overlayEl) return;
        if (now - this.overlayLastUpdateTs < 250) return;
        this.overlayLastUpdateTs = now;
        const parts: string[] = [];
        for (const [loopName, loop] of this.loops) {
            parts.push(
                `${loopName.toUpperCase()}: ${loop.fps.toFixed(0)} fps  long:${loop.longFrames}  worst: ${loop.worstFrameMs.toFixed(1)}ms Δ${loop.worstDeltaMs.toFixed(1)}ms`
            );
        }
        if (parts.length === 0) {
            this.overlayEl.textContent = 'perf: waiting for loops...';
        } else {
            this.overlayEl.textContent = parts.join('\n');
        }
    }

    //==============================================================================================
    /**
     * Gets the public API for the performance monitor
     * @returns {Object} The public API
     */
    private getPublicAPI() {
        return {
            setEnabled: (e: boolean) => this.setEnabled(e),
            isEnabled: () => this.isEnabled(),
            loopFrameStart: (name: string) => this.loopFrameStart(name),
            loopFrameEnd: (name: string) => this.loopFrameEnd(name),
            segmentStart: (loop: string, seg: string) => this.segmentStart(loop, seg),
            segmentEnd: (id: SegmentId) => this.segmentEnd(id),
            startOverlay: () => this.startOverlay(),
            stopOverlay: () => this.stopOverlay(),
            reset: () => this.reset(),
            report: () => this.report()
        };
    }
}

const perf = new PerfMonitor();
export default perf;
