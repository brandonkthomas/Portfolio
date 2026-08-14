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
    indiumSkeleton: () => import('./indiumSkeleton.js'),
};

const modulePromises = new Map<string, Promise<any>>();
const stylePromises = new Map<string, Promise<void>>();

//==============================================================================================
/**
 * Ensure stylesheet is loaded
 * @param {string} href - Stylesheet URL
 */
function ensureStyles(href: string): Promise<void> {
    if (!href) return Promise.resolve();

    const existingPromise = stylePromises.get(href);
    if (existingPromise) return existingPromise;

    const existingLink = document.querySelector(`link[rel="stylesheet"][href="${href}"]`) as HTMLLinkElement | null;
    if (existingLink) {
        loadedStyles.add(href);
        const ready = Promise.resolve();
        stylePromises.set(href, ready);
        return ready;
    }

    const ready = new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            resolve();
        };
        const timeoutId = window.setTimeout(finish, 3000);
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.addEventListener('load', finish, { once: true });
        // A missing optional component stylesheet should not prevent the grid from rendering.
        link.addEventListener('error', finish, { once: true });
        document.head.appendChild(link);
        loadedStyles.add(href);
    });
    stylePromises.set(href, ready);
    return ready;
}

async function loadComponent(type: string): Promise<any> {
    const load = registry[type];
    if (!load) {
        logRegistry('Unknown Component', { type }, undefined, 'error');
        throw new Error(`Unknown component type: ${type}`);
    }

    let modulePromise = modulePromises.get(type);
    if (!modulePromise) {
        modulePromise = load();
        modulePromises.set(type, modulePromise);
    }

    const mod = await modulePromise;
    if (mod.stylesHref) await ensureStyles(mod.stylesHref as string);
    return mod;
}

//==============================================================================================
/**
 * Warm all component modules/styles in parallel before the projects grid is revealed.
 */
export async function preloadComponents(types: string[]): Promise<void> {
    const uniqueTypes = [...new Set(types.filter(Boolean))];
    await Promise.all(uniqueTypes.map(type => loadComponent(type)));
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
    logRegistry('Component Loading', { type });
    const mod = await loadComponent(type);
    const instance = await mod.mount(container, props || {});
    logRegistry('Component Mounted', { type });
    return instance;
}
