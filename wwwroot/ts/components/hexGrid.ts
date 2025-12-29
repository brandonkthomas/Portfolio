/**
 * hexGrid.js
 * @fileoverview Rotated hex byte grid with interactive neighborhood randomization
 */

import { logEvent, LogData, LogLevel } from '../common';

const logHexGrid = (event: string, data?: LogData, note?: string, level: LogLevel = 'info') => {
    logEvent('hexGrid', event, data, note, level);
};

export const stylesHref = '/css/components/hexGrid.css';

interface HexGridProps {
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

/**
 * Mount the hex grid component.
 * @param {Element} container
 * @param {Object} props
 * @returns {Promise<{setSize: () => void, update: (nextProps: Object) => void, destroy: () => void}>}
 */
export async function mount(container: HTMLElement, props: HexGridProps = {}) {
    const root = document.createElement('div');
    root.className = 'comp-hex-grid';

    const inner = document.createElement('div');
    inner.className = 'hg-inner';
    root.appendChild(inner);
    container.appendChild(root);

    const rows = Math.max(8, Math.min(32, props.rows ?? 18));
    const cols = Math.max(8, Math.min(32, props.cols ?? 18));
    const thresholdPx = props.thresholdPx ?? 25;
    const thresholdSq = thresholdPx * thresholdPx;

    const cellsGrid: Cell[][] = [];
    const cellsFlat: Cell[] = [];

    function randomHexByte(): string {
        const value = Math.floor(Math.random() * 256);
        return value.toString(16).padStart(2, '0').toUpperCase();
    }

    function buildGrid() {
        inner.innerHTML = '';
        cellsGrid.length = 0;
        cellsFlat.length = 0;

        for (let r = 0; r < rows; r++) {
            const rowEl = document.createElement('div');
            rowEl.className = 'hg-row';
            inner.appendChild(rowEl);

            const rowCells: Cell[] = [];
            cellsGrid.push(rowCells);

            for (let c = 0; c < cols; c++) {
                const span = document.createElement('span');
                span.className = 'hg-byte';
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
    logHexGrid('Mounted', { rows, cols, thresholdPx });

    let centersDirty = true;

    /**
     * Placeholder for future size-based adjustments; currently zoom is controlled purely via CSS.
     */
    function fitToContainer(width: number, height: number): void {
        void width;
        void height;
    }

    function recomputeCenters(): void {
        if (!cellsFlat.length) return;
        for (const cell of cellsFlat) {
            const rect = cell.el.getBoundingClientRect();
            cell.centerX = rect.left + rect.width / 2;
            cell.centerY = rect.top + rect.height / 2;
        }
        centersDirty = false;
    }

    function markCentersDirty(): void {
        centersDirty = true;
    }

    let lastX: number | null = null;
    let lastY: number | null = null;

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
        update(nextProps: HexGridProps) {
            // Currently no dynamic prop changes; hook reserved for future density tweaks.
            void nextProps;
        },
        destroy() {
            inner.removeEventListener('pointermove', handlePointerMove);
            inner.removeEventListener('pointerleave', handlePointerLeave);
            window.removeEventListener('resize', onResize);
            root.remove();
            logHexGrid('Destroyed');
        }
    };
}



