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
        stateManagerInstance?: any;
        // Debug/diagnostics
        __dotnetDebuggerAttached?: boolean;
        __debugOverrideFlag?: boolean;
        setDebugOverride?: (value: boolean) => void;
        // Global performance monitor singleton
        perf?: {
            setEnabled: (enabled: boolean) => void;
            isEnabled: () => boolean;
            loopFrameStart: (loopName: string) => void;
            loopFrameEnd: (loopName: string) => void;
            segmentStart: (loopName: string, segmentName: string) => number;
            segmentEnd: (segmentId: number) => void;
            startOverlay: () => void;
            stopOverlay: () => void;
            reset: () => void;
            report: () => void;
        };
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
