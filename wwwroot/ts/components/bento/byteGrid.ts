/**
 * byteGrid.ts
 * @fileoverview Interactive rotated hex byte grid component with neighborhood randomization.
 * Renders a grid of random hexadecimal bytes that update in 3x3 neighborhoods as the user moves
 * their cursor across the grid. Includes resize handling and center position caching for performance.
 */

import { logEvent, LogData, LogLevel } from '../../common';

const logByteGrid = (event: string, data?: LogData, note?: string, level: LogLevel = 'info') => {
    logEvent('byteGrid', event, data, note, level);
};

export const stylesHref = '/css/components/bento/byteGrid.css';

interface ByteGridProps {
    rows?: number;
    cols?: number;
    thresholdPx?: number;
}

interface Cell {
    el: HTMLSpanElement;
    row: number;
    col: number;
    centerX: number;
    centerY: number;
}

// ============================================================================================
/**
 * Mount the byte grid component and initialize its interactive behavior.
 * Creates a grid of random hex byte cells that respond to pointer movement, randomizing
 * the 3x3 neighborhood around the nearest cell when the cursor moves beyond the threshold distance.
 * @param {HTMLElement} container - Container element to mount the grid into
 * @param {ByteGridProps} props - Configuration props: rows, cols, and thresholdPx for movement detection
 * @returns {Object} Component instance with setSize(), update(), and destroy() methods
 */
export async function mount(container: HTMLElement, props: ByteGridProps = {}) {
    const root = document.createElement('div');
    root.className = 'comp-byte-grid';

    const inner = document.createElement('div');
    inner.className = 'bg-inner';
    root.appendChild(inner);
    container.appendChild(root);

    const rows = Math.max(8, Math.min(32, props.rows ?? 18));
    const cols = Math.max(8, Math.min(32, props.cols ?? 18));
    const thresholdPx = props.thresholdPx ?? 25;
    const thresholdSq = thresholdPx * thresholdPx;

    const cellsGrid: Cell[][] = [];
    const cellsFlat: Cell[] = [];

    // ============================================================================================
    /**
     * Generate a random hexadecimal byte (00-FF) as a string.
     * @returns {string} Two-character uppercase hex string (e.g., "A3", "FF")
     */
    function randomHexByte(): string {
        const value = Math.floor(Math.random() * 256);
        return value.toString(16).padStart(2, '0').toUpperCase();
    }

    // ============================================================================================
    /**
     * Build the DOM grid structure with random hex bytes.
     * Creates rows and cells, populating cellsGrid (2D array) and cellsFlat (1D array)
     * for efficient access during pointer interactions.
     */
    function buildGrid() {
        inner.innerHTML = '';
        cellsGrid.length = 0;
        cellsFlat.length = 0;

        for (let r = 0; r < rows; r++) {
            const rowEl = document.createElement('div');
            rowEl.className = 'bg-row';
            inner.appendChild(rowEl);

            const rowCells: Cell[] = [];
            cellsGrid.push(rowCells);

            for (let c = 0; c < cols; c++) {
                const span = document.createElement('span');
                span.className = 'bg-byte';
                span.textContent = randomHexByte();
                rowEl.appendChild(span);

                const cell: Cell = {
                    el: span,
                    row: r,
                    col: c,
                    centerX: 0,
                    centerY: 0
                };
                rowCells.push(cell);
                cellsFlat.push(cell);
            }
        }
    }

    buildGrid();
    logByteGrid('Mounted', { rows, cols, thresholdPx });

    let centersDirty = true;

    // ============================================================================================
    /**
     * Fit grid to container size (reserved for future layout adjustments).
     * Currently a no-op but preserved as a hook for responsive sizing logic.
     * @param {number} width - Container width in pixels
     * @param {number} height - Container height in pixels
     */
    function fitToContainer(width: number, height: number): void {
        void width;
        void height;
    }

    // ============================================================================================
    /**
     * Recompute and cache the center positions of all cells.
     * Iterates through all cells and updates their centerX and centerY based on current DOM positions.
     * Sets centersDirty to false to avoid redundant recalculations during pointer events.
     */
    function recomputeCenters(): void {
        if (!cellsFlat.length) return;
        for (const cell of cellsFlat) {
            const rect = cell.el.getBoundingClientRect();
            cell.centerX = rect.left + rect.width / 2;
            cell.centerY = rect.top + rect.height / 2;
        }
        centersDirty = false;
    }

    // ============================================================================================
    /**
     * Mark the cached cell centers as stale, triggering recomputation on next pointer move.
     * Called after resize events to ensure accurate distance calculations.
     */
    function markCentersDirty(): void {
        centersDirty = true;
    }

    let lastX: number | null = null;
    let lastY: number | null = null;

    // ============================================================================================
    /**
     * Randomize hex bytes in a 3x3 neighborhood around a center cell.
     * All cells in the neighborhood (including out-of-bounds checks) are given new random hex values.
     * @param {number} centerRow - Center cell row index
     * @param {number} centerCol - Center cell column index
     */
    function randomizeNeighborhood(centerRow: number, centerCol: number): void {
        for (let dr = -1; dr <= 1; dr++) {
            const r = centerRow + dr;
            if (r < 0 || r >= rows) continue;
            for (let dc = -1; dc <= 1; dc++) {
                const c = centerCol + dc;
                if (c < 0 || c >= cols) continue;
                const cell = cellsGrid[r][c];
                cell.el.textContent = randomHexByte();
            }
        }
    }

    // ============================================================================================
    function handlePointerMove(ev: PointerEvent): void {
        if (!cellsFlat.length) return;

        const x = ev.clientX;
        const y = ev.clientY;

        if (lastX !== null && lastY !== null) {
            const dx = x - lastX;
            const dy = y - lastY;
            if ((dx * dx + dy * dy) < thresholdSq) {
                return;
            }
        }

        lastX = x;
        lastY = y;

        if (centersDirty) {
            recomputeCenters();
        }

        let nearest: Cell | null = null;
        let bestDist = Number.POSITIVE_INFINITY;

        for (const cell of cellsFlat) {
            const dx = x - cell.centerX;
            const dy = y - cell.centerY;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) {
                bestDist = distSq;
                nearest = cell;
            }
        }

        if (!nearest) return;
        randomizeNeighborhood(nearest.row, nearest.col);
    }

    // ============================================================================================
    /**
     * Handle pointer leaving the grid container.
     * Resets tracking of the last pointer position so subsequent pointer moves are not throttled.
     */
    function handlePointerLeave(): void {
        lastX = null;
        lastY = null;
    }

    inner.addEventListener('pointermove', handlePointerMove);
    inner.addEventListener('pointerleave', handlePointerLeave);

    const onResize = () => {
        const rect = container.getBoundingClientRect();
        fitToContainer(rect.width, rect.height);
        markCentersDirty();
        window.requestAnimationFrame(() => recomputeCenters());
    };
    window.addEventListener('resize', onResize);

    // Initial center computation after first layout
    window.requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        fitToContainer(rect.width, rect.height);
        recomputeCenters();
    });

    return {
        setSize({ width, height }: { width: number; height: number }) {
            fitToContainer(width, height);
            markCentersDirty();
            window.requestAnimationFrame(() => recomputeCenters());
        },
        update(nextProps: ByteGridProps) {
            // Currently no dynamic prop changes; hook reserved for future density tweaks.
            void nextProps;
        },
        destroy() {
            inner.removeEventListener('pointermove', handlePointerMove);
            inner.removeEventListener('pointerleave', handlePointerLeave);
            window.removeEventListener('resize', onResize);
            root.remove();
            logByteGrid('Destroyed');
        }
    };
}
