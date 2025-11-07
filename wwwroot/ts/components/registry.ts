/**
 * registry.js
 * @fileoverview Component registry with dynamic imports and per-component stylesheet loader
 */

const loadedStyles = new Set<string>();

//==============================================================================================
/**
 * Component registry with dynamic imports and per-component stylesheet loader
 * @type {Object<string, () => Promise<{stylesHref: string, mount: (container: Element, props: Object) => Promise<{setSize: () => void, update: (nextProps: Object) => void, destroy: () => void}>}>>}
 */
const registry: Record<string, () => Promise<any>> = {
    cardStack: () => import('./cardStack'),
    lineGraph: () => import('./lineGraph'),
    terminalBlink: () => import('./terminalBlink'),
};

//==============================================================================================
/**
 * Ensure styles are loaded
 * @param {string} href
 * @returns {void}
 */
function ensureStyles(href: string): void {
    if (!href || loadedStyles.has(href)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    loadedStyles.add(href);
}

//==============================================================================================
/**
 * Load + mount a component
 * @param {string} type
 * @param {Element} container
 * @param {Object} props
 * @returns {Promise<{setSize: () => void, update: (nextProps: Object) => void, destroy: () => void}>}
 */
export async function mountComponent(type: string, container: HTMLElement, props?: Record<string, unknown>): Promise<any> {
    const load = registry[type];
    if (!load) throw new Error(`Unknown component type: ${type}`);
    const mod = await load();
    if (mod.stylesHref) ensureStyles(mod.stylesHref as string);
    return mod.mount(container, props || {});
}
