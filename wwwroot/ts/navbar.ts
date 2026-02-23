/**
 * navbar.ts
 * Host-owned navbar orchestration that consumes the generic Indium navbar API.
 */

import { logEvent, type LogData, type LogLevel } from './common.js';
import stateManager, { ViewState } from './stateManager.js';

interface NavbarItem {
    id: string;
    label: string;
    href: string;
    iconSrc?: string;
    iconAlt?: string;
    mobileLabel?: string;
    mobileIconSrc?: string;
    external?: boolean;
    target?: string;
    rel?: string;
    ariaLabel?: string;
    className?: string;
}

interface NavbarNavigateContext {
    item: NavbarItem;
    itemId: string;
    event: MouseEvent;
    source: 'desktop' | 'mobile';
}

interface NavbarController {
    readonly readyPromise: Promise<void>;
    open(): void;
    close(): void;
    toggle(): void;
    setItems(items: NavbarItem[]): void;
    setActive(itemId: string | null): void;
    destroy(): void;
}

type CreateNavbarController = (options: {
    root?: HTMLElement | null;
    enableGlass?: boolean;
    onNavigate?: (context: NavbarNavigateContext) => 'prevent' | void;
}) => NavbarController;

const ICONS = {
    home: '/assets/svg/bt-logo-boxed.svg',
    photos: '/assets/svg/polaroid-filled.svg',
    projects: '/assets/svg/project-filled.svg',
    linkedin: '/assets/svg/linkedin-logo-filled.svg',
    email: '/assets/svg/email-filled.svg'
} as const;

class Navbar {
    private container: HTMLElement | null = null;
    private controller: NavbarController | null = null;
    private readyResolver: (() => void) | null = null;
    private readonly unbind: Array<() => void> = [];
    readonly readyPromise: Promise<void>;

    constructor() {
        this.readyPromise = new Promise((resolve) => {
            this.readyResolver = resolve;
        });
        this.init();
    }

    private log(event: string, data?: LogData, note?: string, level: LogLevel = 'info') {
        logEvent('navbar', event, data, note, level);
    }

    private resolveReady() {
        if (!this.readyResolver) return;
        this.readyResolver();
        this.readyResolver = null;
    }

    private init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                void this.setup();
            }, { once: true });
            return;
        }
        void this.setup();
    }

    private async loadCreateNavbarController(): Promise<CreateNavbarController | null> {
        try {
            const modulePath = '/apps/indium/dist/components/navbar.js';
            const navbarModule = await import(modulePath);
            const createFn = (navbarModule as { createNavbarController?: unknown }).createNavbarController;
            if (typeof createFn !== 'function') {
                this.log('Setup Failed', { reason: 'missing-createNavbarController' }, undefined, 'error');
                return null;
            }
            return createFn as CreateNavbarController;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('Setup Failed', { reason: 'import-error' }, message, 'error');
            return null;
        }
    }

    private async setup() {
        this.container = document.querySelector('.url-display');
        if (!this.container) {
            this.log('Setup Skipped', { reason: 'container-missing' }, undefined, 'warn');
            this.resolveReady();
            return;
        }

        const createNavbarController = await this.loadCreateNavbarController();
        if (!createNavbarController) {
            this.resolveReady();
            return;
        }

        this.controller = createNavbarController({
            root: this.container,
            enableGlass: true,
            onNavigate: (context) => this.onNavigate(context)
        });

        await this.controller.readyPromise;
        this.bindBrandClick();
        this.bindViewUpdates();

        this.refreshItems(this.getCurrentView());
        this.log('Navbar Ready');
        this.resolveReady();
    }

    private getCurrentView(): string {
        try {
            const view = stateManager.getCurrentView();
            if (view === ViewState.PHOTOS || view === ViewState.PROJECTS || view === ViewState.CARD) {
                return view;
            }
        } catch {
            // no-op; fallback below
        }

        const path = window.location.pathname.toLowerCase();
        if (path.startsWith('/photos')) return ViewState.PHOTOS;
        if (path.startsWith('/projects')) return ViewState.PROJECTS;
        return ViewState.CARD;
    }

    private bindViewUpdates() {
        stateManager.onViewChange((view: string) => {
            this.refreshItems(view);
            this.log('View Changed', { view });
        });
    }

    private bindBrandClick() {
        if (!this.container) return;
        const brand = this.container.querySelector('.url-text');
        if (!(brand instanceof HTMLElement)) return;

        const onBrandClick = (event: MouseEvent) => {
            if (window.innerWidth <= 768) return;
            event.preventDefault();
            event.stopPropagation();
            this.navigateHome();
        };

        brand.addEventListener('click', onBrandClick);
        this.unbind.push(() => brand.removeEventListener('click', onBrandClick));
    }

    private refreshItems(view: string) {
        if (!this.controller) return;
        this.controller.setItems(this.buildItems(view));

        if (view === ViewState.PHOTOS) {
            this.controller.setActive('photos');
            return;
        }
        if (view === ViewState.PROJECTS) {
            this.controller.setActive('projects');
            return;
        }
        this.controller.setActive(null);
    }

    private buildItems(view: string): NavbarItem[] {
        const photosMobileIsCard = view === ViewState.PHOTOS;
        const projectsMobileIsCard = view === ViewState.PROJECTS;

        return [
            {
                id: 'photos',
                label: 'Photos',
                href: '/photos',
                iconSrc: ICONS.photos,
                iconAlt: '',
                mobileLabel: photosMobileIsCard ? 'Card' : 'Photos',
                mobileIconSrc: photosMobileIsCard ? ICONS.home : ICONS.photos,
                ariaLabel: 'Photos'
            },
            {
                id: 'projects',
                label: 'Projects',
                href: '/projects',
                iconSrc: ICONS.projects,
                iconAlt: '',
                mobileLabel: projectsMobileIsCard ? 'Card' : 'Projects',
                mobileIconSrc: projectsMobileIsCard ? ICONS.home : ICONS.projects,
                ariaLabel: 'Projects'
            },
            {
                id: 'linkedin',
                label: 'LinkedIn',
                href: 'https://linkedin.com/in/brandonkthomas',
                iconSrc: ICONS.linkedin,
                iconAlt: '',
                mobileIconSrc: ICONS.linkedin,
                external: true,
                target: '_blank',
                rel: 'noopener noreferrer',
                ariaLabel: 'LinkedIn'
            },
            {
                id: 'contact',
                label: 'Contact',
                href: 'mailto:me@brandonthomas.net',
                iconSrc: ICONS.email,
                iconAlt: '',
                mobileIconSrc: ICONS.email,
                className: 'url-link url-link-external',
                ariaLabel: 'Contact'
            }
        ];
    }

    private onNavigate(context: NavbarNavigateContext): 'prevent' | void {
        if (context.itemId === 'photos') {
            this.navigatePhotos();
            return 'prevent';
        }

        if (context.itemId === 'projects') {
            this.navigateProjects();
            return 'prevent';
        }
    }

    private navigatePhotos() {
        if (this.tryToggleSpaPhotos()) {
            this.log('Photos Link SPA', { to: this.getCurrentView() });
            return;
        }

        const path = window.location.pathname.toLowerCase();
        if (path.startsWith('/photos')) {
            window.location.reload();
        } else {
            window.location.href = '/photos';
        }
        this.log('Photos Link Hard Nav', { path });
    }

    private navigateProjects() {
        if (this.tryToggleSpaProjects()) {
            this.log('Projects Link SPA', { to: this.getCurrentView() });
            return;
        }

        const path = window.location.pathname.toLowerCase();
        if (path === '/projects') {
            window.location.reload();
        } else {
            window.location.href = '/projects';
        }
        this.log('Projects Link Hard Nav', { path });
    }

    private navigateHome() {
        const hasCardContainer = !!document.querySelector('.card-container');
        const canSpa = hasCardContainer && !!window.card3DInstance;

        if (canSpa) {
            stateManager.navigateToView(ViewState.CARD, true);
            this.log('Home Link SPA');
            return;
        }

        window.location.href = '/';
        this.log('Home Link Hard Nav');
    }

    private tryToggleSpaPhotos(): boolean {
        const hasContainers = !!document.querySelector('.photo-gallery-container')
            && !!document.querySelector('.card-container');
        const canSpa = hasContainers && !!window.photoGalleryInstance && !!window.card3DInstance;
        if (!canSpa) return false;

        const current = this.getCurrentView();
        const target = current === ViewState.PHOTOS ? ViewState.CARD : ViewState.PHOTOS;
        stateManager.navigateToView(target, true);
        return true;
    }

    private tryToggleSpaProjects(): boolean {
        const hasContainers = !!document.querySelector('.projects-container')
            && !!document.querySelector('.card-container');
        const canSpa = hasContainers && !!window.projectsInstance && !!window.card3DInstance;
        if (!canSpa) return false;

        const current = this.getCurrentView();
        const target = current === ViewState.PROJECTS ? ViewState.CARD : ViewState.PROJECTS;
        stateManager.navigateToView(target, true);
        return true;
    }

    destroy() {
        while (this.unbind.length > 0) {
            const fn = this.unbind.pop();
            try {
                fn?.();
            } catch {
                // no-op
            }
        }

        this.controller?.destroy();
        this.controller = null;
        this.log('Navbar Destroyed');
    }
}

const navbarManager = new Navbar();
(window as any).navbarManagerInstance = navbarManager;
logEvent('navbar', 'Instance Mounted');

export default navbarManager;
