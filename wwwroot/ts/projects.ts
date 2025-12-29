/**
 * projects.js
 * @fileoverview Bento grid of personal projects with hover/tap animations
 */

import { isMobile, getOperatingSystem, logEvent, LogData, LogLevel } from './common';
import { createGlassSurface } from './glassSurface';
import type { GlassSurfaceInstance } from './glassSurface';
import { mountComponent } from './components/registry';

class ProjectsGrid {
    private container: HTMLElement | null;
    private projects: any[];
    private isVisible: boolean;
    private gridEl: HTMLElement | null;
    private footerEl: HTMLElement | null;
    private footerGlass: GlassSurfaceInstance | null;
    private projectsGenerated: boolean;
    private currentColumnCount: number;
    private readyPromise: Promise<void>;
    private _resolveReady: (() => void) | null = null;
    private tileInstances: WeakMap<Element, any>;
    constructor() {
        this.container = null;
        this.projects = [];
        this.isVisible = false;
        this.gridEl = null;
        this.footerEl = null;
        this.footerGlass = null;
        this.projectsGenerated = false;
        this.currentColumnCount = 0;
        this.readyPromise = new Promise((resolve) => { this._resolveReady = resolve; });
        this.tileInstances = new WeakMap();
        this.init();
    }

    private log(event: string, data?: LogData, note?: string, level: LogLevel = 'info') {
        logEvent('projects', event, data, note, level);
    }

    //==============================================================================================
    /**
     * Initialize the projects grid
     */
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    //==============================================================================================
    /**
     * Setup the projects grid
     */
    setup() {
        this.container = document.querySelector('.projects-container');
        if (!this.container) {
            this.log('Container Missing', { selector: '.projects-container' }, undefined, 'warn');
            return;
        }
        this.log('Container Ready');

        this.createProjectsHTML();
        this.setupEventListeners();

        if (this._resolveReady) {
            this._resolveReady();
            this._resolveReady = null;
            this.log('Ready Promise Resolved');
        }
    }

    //==============================================================================================
    /**
     * Create the projects HTML
     */
    createProjectsHTML() {
        this.container!.innerHTML = `
            <div class="projects-gallery">
                <div class="projects-grid"></div>
                <div class="projects-footer" aria-hidden="false"></div>
            </div>
        `;
        this.gridEl = this.container!.querySelector('.projects-grid') as HTMLElement | null;
        this.footerEl = this.container!.querySelector('.projects-footer') as HTMLElement | null;

        // Build footer content
        this.createFooter();
    }

    //==============================================================================================
    /**
     * Create bottom GitHub footer with glass surface
     */
    createFooter() {
        if (!this.footerEl) {
            this.log('Footer Skipped', {}, 'Footer element missing', 'warn');
            return;
        }

        // Create glass surface for footer
        this.footerGlass = createGlassSurface({
            width: 'auto',
            height: 44,
            borderRadius: 16,
            borderWidth: 0.07,
            brightness: 50,
            opacity: 0.93,
            blur: 28,
            displace: 0,
            backgroundOpacity: 0.12,
            saturation: 0.8, // 0.9
            distortionScale: -15, // -12
            redOffset: 8, // 6
            greenOffset: 8, // 6
            blueOffset: 8, // 6
            xChannel: 'R',
            yChannel: 'G',
            mixBlendMode: 'difference',
            className: 'projects-footer-glass',
            style: {
                padding: '6px 10px',
                gap: '8px',
                justifyContent: 'center',
                alignItems: 'center',
                minWidth: '240px'
            }
        });

        // Build anchor link that wraps the entire glass surface (whole element clickable)
        const link = document.createElement('a');
        link.className = 'projects-footer-link';
        link.href = 'https://github.com/brandonkthomas';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', 'GitHub profile');

        // Icon + text inside the glass surface content
        const icon = document.createElement('img');
        icon.src = '/assets/svg/github-logo-roundrect-filled.svg';
        icon.width = 20;
        icon.height = 20;
        icon.alt = '';

        const text = document.createElement('span');
        text.textContent = 'github.com/brandonkthomas';

        // Space content nicely inside the glass content container
        this.footerGlass!.contentElement.style.gap = '8px';
        this.footerGlass!.contentElement.appendChild(icon);
        this.footerGlass!.contentElement.appendChild(text);

        // Wrap glass surface inside the anchor, so entire element is clickable
        link.appendChild(this.footerGlass!.element);
        this.footerEl!.appendChild(link);
    }

    //==============================================================================================
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (!this.container) {
            this.log('Event Binding Skipped', {}, 'Container missing', 'warn');
            return;
        }
        // Recompute visual sizing on resize (throttled via rAF)
        let raf: number | null = null;
        const onResize = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                this.sizeAllTileVisuals();
                this.sizeAllComponents();
            });
        };
        window.addEventListener('resize', onResize);
        this.log('Event Listeners Bound');
    }

    //==============================================================================================
    /**
     * Retrieve the projects from the manifest
     */
    async retrieveProjects() {
        if (!this.gridEl) {
            this.log('Retrieve Skipped', {}, 'Grid missing', 'warn');
            return;
        }
        try {
            const response = await fetch('/assets/projects/manifest.json', { cache: 'no-cache' });
            if (response.ok) {
                const manifest = await response.json();
                this.projects = Array.isArray(manifest.projects) ? manifest.projects : [];
                this.log('Projects Loaded', { count: this.projects.length });
            } else {
                this.projects = [];
                this.log('Projects Load Failed', { status: response.status }, response.statusText, 'warn');
            }
        } catch (error) {
            this.projects = [];
            this.log(
                'Projects Load Failed',
                {},
                error instanceof Error ? error.message : String(error),
                'error'
            );
        }

        this.renderGrid();
    }

    //==============================================================================================
    /**
     * Render the projects grid
     */
    renderGrid() {
        if (!this.gridEl) {
            this.log('Render Skipped', {}, 'Grid element missing', 'warn');
            return;
        }
        this.gridEl.innerHTML = '';

        const ensureUrl = (p: any) => p.url || `/projects/${encodeURIComponent(p.slug || p.title?.toLowerCase().replace(/\s+/g, '-') || 'project')}`;
        const isExternalUrl = (u: string) => {
            try {
                const url = new URL(u, window.location.origin);
                return url.origin !== window.location.origin;
            } catch (_) {
                return false;
            }
        };
        const ensureSpanClass = (p: any) => {
            const span = (p.span || '1x1').toLowerCase();
            const allowed = new Set(['1x1','2x1','1x2','2x2']);
            return allowed.has(span) ? `span-${span}` : 'span-1x1';
        };

        const parseHex = (hex: string) => {
            if (!hex) return { r: 28, g: 28, b: 28 };
            let h = hex.trim();
            if (h[0] === '#') h = h.slice(1);
            if (h.length === 3) {
                const r = parseInt(h[0] + h[0], 16);
                const g = parseInt(h[1] + h[1], 16);
                const b = parseInt(h[2] + h[2], 16);
                return { r, g, b };
            }
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            return { r, g, b };
        };

        const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
        const mix = (c1: any, c2: any, t: number) => ({
            r: Math.round(c1.r + (c2.r - c1.r) * t),
            g: Math.round(c1.g + (c2.g - c1.g) * t),
            b: Math.round(c1.b + (c2.b - c1.b) * t)
        });
        const toRgba = (c: any, a: number) => `rgba(${clamp(c.r,0,255)}, ${clamp(c.g,0,255)}, ${clamp(c.b,0,255)}, ${clamp(a, 0, 1)})`;
        const computeGradient = (proj: any) => {
            const c1 = parseHex(proj.gradientColor1 || '#1b1b1b');
            const c2 = parseHex(proj.gradientColor2 || '#202020');
            const t = Math.random() * 0.4 + 0.3; // 0.3..0.7
            const mid = mix(c1, c2, t);
            const pos = Math.round(t * 100); // percent position for mid stop
            const angle = Number.isFinite(proj.gradientAngle) ? proj.gradientAngle : Math.floor(Math.random() * 360);
            const a = 0.82; // subtle alpha
            return `linear-gradient(${angle}deg, ${toRgba(c1, a)} 0%, ${toRgba(mid, a + 0.03)} ${pos}%, ${toRgba(c2, a)} 100%)`;
        };

        const parseCsv = (value: any) => {
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') {
                return value.split(',').map(s => s.trim()).filter(Boolean);
            }
            return [];
        };
        const shouldShowDownload = (proj: any) => {
            const osList = parseCsv(proj.downloadOperatingSystem || proj.downloadOperatingSystems || '');
            if (!proj.downloadUrl || osList.length === 0) return false;
            
            const os = getOperatingSystem();
            return !isMobile() && osList.some(v => v.toLowerCase() === String(os).toLowerCase());
        };

        // On mobile, force single column; spans are normalized via CSS
        this.projects.forEach((proj: any, index: number) => {
            const link = document.createElement('a');
            link.className = `bento-item ${ensureSpanClass(proj)}`;
            link.href = ensureUrl(proj);
            link.setAttribute('aria-label', proj.title || `Project ${index + 1}`);
            link.classList.add('bento-link');

            // Optional external navigation support via manifest flag or URL scheme
            const externalFlag = Boolean(proj.external);
            const candidateUrl = proj.url || link.getAttribute('href') || '';
            if (externalFlag || isExternalUrl(candidateUrl)) {
                // link.target = '_blank';
                // link.rel = 'noopener noreferrer';
                link.dataset.external = 'true';
                // Robust open to avoid accidental relative navigation
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const href = proj.url || link.getAttribute('href');
                    if (href) {
                        window.location.href = href;
                    }
                });
            }

            // Background: subtle multi-point gradient
            link.style.background = computeGradient(proj);

            const wrapper = document.createElement('div');
            wrapper.className = 'bento-content';

            // Header
            const header = document.createElement('div');
            header.className = 'bento-header';
            header.innerHTML = `
                <div class="bento-title">
                    <span>${proj.title || 'Project'}</span>
                </div>
                ${proj.tag ? `<div class="bento-chip">${proj.tag}</div>` : ''}
            `;
            wrapper.appendChild(header);

            // Component: mount inner visual based on manifest (default: none)
            const comp = proj.component || null;
            this.attachComponentToTile(link, wrapper, comp).catch(() => { /* no-op fallback */ });

            // Footer chip
            if (proj.footer) {
                const footer = document.createElement('div');
                footer.className = 'bento-footer';
                footer.textContent = proj.footer;
                wrapper.appendChild(footer);
            }

            // Optional per-project Download button (currently only Spectrometer on Windows desktop)
            const hasDownload = shouldShowDownload(proj);
            if (hasDownload) {
                const dlBtn = document.createElement('button');
                dlBtn.type = 'button';
                dlBtn.className = 'bento-download';
                dlBtn.setAttribute('aria-label', `Download ${proj.title || 'app'}`);
                dlBtn.title = `Download ${proj.title || ''}`.trim();
                dlBtn.textContent = 'Download';

                const icon = document.createElement('img');
                icon.src = '/assets/svg/download-filled.svg';
                icon.alt = '';
                icon.width = 20;
                icon.height = 20;

                dlBtn.appendChild(icon);
                dlBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const href = proj.downloadUrl;
                    if (href) {
                        window.location.href = href;
                    }
                });
                wrapper.appendChild(dlBtn);
            }

            // optional GitHub button (bottom right) -- used for projects w/ both live demos and source code
            if (proj.githubUrl) {
                const githubBtn = document.createElement('a');
                githubBtn.href = proj.githubUrl;
                githubBtn.className = 'bento-github';
                githubBtn.setAttribute('aria-label', `View ${proj.title || 'project'} on GitHub`);
                githubBtn.title = `View on GitHub`;
                githubBtn.rel = 'noopener noreferrer';
                githubBtn.target = '_blank';
                if (hasDownload) {
                    githubBtn.classList.add('bento-github--with-download');
                }

                const icon = document.createElement('img');
                icon.src = '/assets/svg/github-logo-roundrect-filled.svg';
                icon.alt = '';
                icon.width = 18;
                icon.height = 18;

                githubBtn.appendChild(icon);
                githubBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                wrapper.appendChild(githubBtn);
            }

            link.appendChild(wrapper);
            (this.gridEl as HTMLElement).appendChild(link);

            // Size visuals to tile height using CSS var --stack-h
            this.sizeTileVisuals(link);

            // Guard double-tap zoom on mobile
            this.addDoubleTapGuard(link);
        });
        // Ensure all tiles sized (for any late layout changes)
        this.sizeAllTileVisuals();
        this.sizeAllComponents();
        this.log('Grid Rendered', { projects: this.projects.length });
    }

    //==============================================================================================
    /**
     * Guard double-tap zoom on mobile
     * @param {Element} element
     * @param {Function} onDoubleTap - Optional action to invoke on double tap
     */
    addDoubleTapGuard(element: HTMLElement, onDoubleTap?: () => void) {
        if (!element) return;
        let lastTap = 0;
        const DOUBLE_TAP_MS = 300;
        element.addEventListener('touchend', (e: TouchEvent) => {
            const now = Date.now();
            const delta = now - lastTap;
            if (delta > 0 && delta <= DOUBLE_TAP_MS) {
                e.preventDefault();
                if (typeof onDoubleTap === 'function') {
                    onDoubleTap();
                } else {
                    (element as HTMLElement).click();
                }
            }
            lastTap = now;
        }, { passive: false });
    }

    //==============================================================================================
    /**
     * Compute and apply visual sizing CSS vars based on tile height
     */
    sizeTileVisuals(tile: HTMLElement) {
        if (!tile) return;
        const rect = tile.getBoundingClientRect();
        const height = rect.height || tile.clientHeight || 0;
        // Infer row span from class (span-<cols>x<rows>)
        let rowSpan = 1;
        const m = tile.className.match(/span-\d+x(\d+)/);
        if (m && m[1]) {
            rowSpan = parseInt(m[1], 10) || 1;
        }
        const factor = rowSpan === 1 ? 0.56 : 0.48; // tune factors for visual balance
        const stackH = Math.max(60, Math.round(height * factor));
        tile.style.setProperty('--stack-h', stackH + 'px');
    }

    sizeAllTileVisuals() {
        if (!this.gridEl) return;
        const tiles = this.gridEl!.querySelectorAll('.bento-item');
        tiles.forEach((t: Element) => this.sizeTileVisuals(t as HTMLElement));
    }

    //==============================================================================================
    /**
     * Attach a component to a tile
     * @param {Element} tileEl
     * @param {Element} contentEl
     * @param {Object} comp
     * @returns {Promise<void>}
     */
    async attachComponentToTile(tileEl: HTMLElement, contentEl: HTMLElement, comp: any) {
        if (!comp || !comp.type) {
            return; // No component to mount
        }
        try {
            const instance = await mountComponent(comp.type, contentEl, comp.props || {});
            this.tileInstances.set(tileEl, instance);
            const rect = tileEl.getBoundingClientRect();
            instance.setSize?.({ width: rect.width, height: rect.height });
        } catch (err) {
            this.log(
                'Component Mount Failed',
                { component: comp?.type || 'unknown' },
                err instanceof Error ? err.message : String(err),
                'warn'
            );
        }
    }

    //==============================================================================================
    /**
     * Size all components in the grid
     */
    sizeAllComponents() {
        if (!this.gridEl) return;
        const tiles = this.gridEl!.querySelectorAll('.bento-item');
        tiles.forEach((t: Element) => {
            const inst = this.tileInstances.get(t);
            if (inst && typeof inst.setSize === 'function') {
                const rect = t.getBoundingClientRect();
                inst.setSize({ width: rect.width, height: rect.height });
            }
        });
    }

    //==============================================================================================
    /**
     * Show the projects grid
     */
    show() {
        if (!this.container) {
            this.log('Show Skipped', {}, 'Container missing', 'warn');
            return;
        }
        if (!this.projectsGenerated) {
            this.projectsGenerated = true;
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => this.retrieveProjects(), { timeout: 100 });
                this.log('Projects Load Scheduled', { strategy: 'idle' });
            } else {
                setTimeout(() => this.retrieveProjects(), 0);
                this.log('Projects Load Scheduled', { strategy: 'timeout' });
            }
        }
        this.container.classList.add('visible');
        this.isVisible = true;
        document.body.style.overflow = 'auto';
        this.log('Projects Shown');
    }

    //==============================================================================================
    /**
     * Hide the projects grid
     */
    hide() {
        if (!this.container) {
            this.log('Hide Skipped', {}, 'Container missing', 'warn');
            return;
        }
        this.container.classList.remove('visible');
        this.isVisible = false;
        document.body.style.overflow = 'hidden';
        this.log('Projects Hidden');
    }

    //==============================================================================================
    /**
     * Check if the projects grid is currently visible
     * @returns {boolean}
     */
    isGridVisible() {
        return this.isVisible;
    }
}

// Initialize and export
const projectsGrid = new ProjectsGrid();
window.projectsInstance = projectsGrid;
export default projectsGrid;
