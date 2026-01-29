/**
 * registry.js
 * @fileoverview Component registry with dynamic imports and per-component stylesheet loader
 */

import { logEvent, LogData, LogLevel } from '../../common.js';

const logRegistry = (event: string, data?: LogData, note?: string, level: LogLevel = 'info') => {
    logEvent('componentRegistry', event, data, note, level);
};
const loadedStyles = new Set<string>();

//==============================================================================================
/**
 * Component registry with dynamic imports and per-component stylesheet loader
 */
const registry: Record<string, () => Promise<any>> = {
    cardStack: () => import('./cardStack.js'),
    lineGraph: () => import('./lineGraph.js'),
    terminalBlink: () => import('./terminalBlink.js'),
    byteGrid: () => import('./byteGrid.js'),
    webampKnob: () => import('./webampKnob.js'),
};

//==============================================================================================
/**
 * Ensure stylesheet is loaded
 * @param {string} href - Stylesheet URL
 */
function ensureStyles(href: string): void {
    if (!href) return;
    if (loadedStyles.has(href)) {
        // logRegistry('Styles Skipped', { href }, 'Already loaded');
        return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    loadedStyles.add(href);
    // logRegistry('Styles Loaded', { href });
}

//==============================================================================================
/**
 * Load and mount a component
 * @param {string} type - Component type name
 * @param {HTMLElement} container - Container element
 * @param {Object} props - Optional component props
 * @returns {Promise<Object>} Component instance with setSize, update, destroy methods
 */
export async function mountComponent(type: string, container: HTMLElement, props?: Record<string, unknown>): Promise<any> {
    const load = registry[type];
    if (!load) {
        logRegistry('Unknown Component', { type }, undefined, 'error');
        throw new Error(`Unknown component type: ${type}`);
    }
    logRegistry('Component Loading', { type });
    const mod = await load();
    if (mod.stylesHref) ensureStyles(mod.stylesHref as string);
    const instance = await mod.mount(container, props || {});
    logRegistry('Component Mounted', { type });
    return instance;
}
