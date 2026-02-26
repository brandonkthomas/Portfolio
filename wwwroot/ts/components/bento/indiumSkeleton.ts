/**
 * indiumSkeleton.ts
 * @fileoverview Indium-themed loading skeleton tile for the projects bento grid.
 */

import { logEvent, LogData, LogLevel } from '../../common.js';

const logIndiumSkeleton = (event: string, data?: LogData, note?: string, level: LogLevel = 'info') => {
    logEvent('indiumSkeleton', event, data, note, level);
};

export const stylesHref = '/css/components/bento/indiumSkeleton.css';

interface IndiumSkeletonProps {
    logoSrc?: string;
}

function createBlock(className: string, delayMs: number): HTMLDivElement {
    const block = document.createElement('div');
    block.className = `indium-skel__block ${className}`;
    block.style.setProperty('--sheen-delay', `${delayMs}ms`);
    return block;
}

export async function mount(container: HTMLElement, props: IndiumSkeletonProps = {}) {
    const root = document.createElement('div');
    root.className = 'comp-indium-skeleton';

    const logoSrc = props.logoSrc || '/apps/indium/assets/branding/indium-branding-512.png';

    const row = document.createElement('div');
    row.className = 'indium-skel__row';

    const logo = document.createElement('img');
    logo.className = 'indium-skel__logo';
    logo.src = logoSrc;
    logo.alt = '';
    logo.width = 24;
    logo.height = 24;

    const longBlock = createBlock('indium-skel__block--long', 90);
    const shortBlock = createBlock('indium-skel__block--short', 160);

    row.append(longBlock, logo, shortBlock);

    root.append(row);
    container.appendChild(root);

    logIndiumSkeleton('Mounted');

    return {
        setSize() {
            // Visual scales with tile bounds through CSS.
        },
        update(nextProps: IndiumSkeletonProps) {
            if (nextProps.logoSrc && nextProps.logoSrc !== logo.src) {
                logo.src = nextProps.logoSrc;
            }
        },
        destroy() {
            root.remove();
            logIndiumSkeleton('Destroyed');
        }
    };
}
