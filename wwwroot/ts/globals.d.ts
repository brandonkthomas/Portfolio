// Global ambient declarations for browser and external libs

declare global {
    // three.js loaded via script tag
    const THREE: any;

    interface Window {
        card3DInstance?: any;
        starfieldInstance?: any;
        photoGalleryInstance?: any;
        projectsInstance?: any;
        navbarManagerInstance?: any;
        triggerStarfieldWarp?: (active?: boolean) => void;
    }

    // requestIdleCallback typings (not in all DOM lib versions)
    interface IdleDeadline {
        didTimeout: boolean;
        timeRemaining(): number;
    }

    interface Window {
        requestIdleCallback?(callback: (deadline: IdleDeadline) => void, options?: { timeout: number }): number;
        cancelIdleCallback?(handle: number): void;
    }
}

export {};
