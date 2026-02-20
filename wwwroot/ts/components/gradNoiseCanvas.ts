/**
 * gradNoiseCanvas.js
 * Simple fullscreen canvas noise shader / gradient blur blob background
 * BT 2025-12-13: adapted from https://codepen.io/daniel-hult/pen/KKMjEBr
 */

import { logEvent, LogData, LogLevel } from '../common.js';
import perf from '../perfMonitor.js';

const DEFAULT_SETTINGS = Object.freeze({
    speed: 0.7,
    noiseFreq: 0.5,
    exposure: 0.5,
    saturation: 0.0,
    reducedOpacity: 0.25
});

const FULLSCREEN_VERTEX_SHADER = `
precision highp float;

varying vec2 vUv;

uniform float u_time;
uniform float u_noiseFreq;
uniform float speed;
uniform float u_direction;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
    vUv = uv;

    vec3 pos = position;
    // Slow movement by 4x relative to the original shader snippet.
    float t = u_time * speed * 0.25 * u_direction;
    vec3 noisePos = vec3(pos.x + t, pos.y, pos.z);
    pos.z += snoise(noisePos) * u_noiseFreq;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FULLSCREEN_FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;

uniform float u_time;
uniform float u_aspect;
uniform float speed;
uniform float u_opacity;
uniform float u_warp;
uniform float u_direction;
uniform float u_exposure;
uniform float u_saturation;

float hue2rgb(float f1, float f2, float hue) {
    if (hue < 0.0) hue += 1.0;
    else if (hue > 1.0) hue -= 1.0;

    float res;
    if ((6.0 * hue) < 1.0) res = f1 + (f2 - f1) * 6.0 * hue;
    else if ((2.0 * hue) < 1.0) res = f2;
    else if ((3.0 * hue) < 2.0) res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
    else res = f1;
    return res;
}

vec3 hsl2rgb(vec3 hsl) {
    vec3 rgb;
    if (hsl.y == 0.0) {
        rgb = vec3(hsl.z);
    } else {
        float f2 = (hsl.z < 0.5) ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.y * hsl.z;
        float f1 = 2.0 * hsl.z - f2;
        rgb.r = hue2rgb(f1, f2, hsl.x + (1.0/3.0));
        rgb.g = hue2rgb(f1, f2, hsl.x);
        rgb.b = hue2rgb(f1, f2, hsl.x - (1.0/3.0));
    }
    return rgb;
}

vec3 hsl2rgb(float h, float s, float l) { return hsl2rgb(vec3(h, s, l)); }

vec3 random3(vec3 c) {
    float j = 4096.0*sin(dot(c,vec3(17.0, 59.4, 15.0)));
    vec3 r;
    r.z = fract(512.0*j);
    j *= .125;
    r.x = fract(512.0*j);
    j *= .125;
    r.y = fract(512.0*j);
    return r-0.5;
}

const float F3 = 0.3333333;
const float G3 = 0.1666667;

float simplex3d(vec3 p) {
    vec3 s = floor(p + dot(p, vec3(F3)));
    vec3 x = p - s + dot(s, vec3(G3));

    vec3 e = step(vec3(0.0), x - x.yzx);
    vec3 i1 = e*(1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy*(1.0 - e);

    vec3 x1 = x - i1 + G3;
    vec3 x2 = x - i2 + 2.0*G3;
    vec3 x3 = x - 1.0 + 3.0*G3;

    vec4 w, d;
    w.x = dot(x, x);
    w.y = dot(x1, x1);
    w.z = dot(x2, x2);
    w.w = dot(x3, x3);
    w = max(0.6 - w, 0.0);

    d.x = dot(random3(s), x);
    d.y = dot(random3(s + i1), x1);
    d.z = dot(random3(s + i2), x2);
    d.w = dot(random3(s + 1.0), x3);

    w *= w;
    w *= w;
    d *= w;

    return dot(d, vec4(52.0));
}

float hash(vec2 p) {
    return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x))));
}

void main() {
    // Aspect-correct UVs so the pattern doesn't stretch on wide/tall viewports.
    vec2 uv = (vUv - 0.5) * vec2(u_aspect, 1.0) + 0.5;

    // Slow movement by 4x relative to the original shader snippet.
    float t = u_time * speed * 0.25 * u_direction;

    float n = simplex3d(vec3(uv.xy, t));
    vec3 color = hsl2rgb(0.6 + n * 0.2, 0.5, 0.5);

    float val = hash(uv + t);

    // Fill the viewport (no circular alpha mask). Fade is handled via u_opacity.
    vec3 finalColor = color + vec3(val / 20.0);
    // Subtle warp pulse brightening for legacy transitions.
    finalColor += vec3(0.15) * max(0.0, u_warp);

    // Saturation (luma mix)
    float luma = dot(finalColor, vec3(0.2126, 0.7152, 0.0722));
    finalColor = mix(vec3(luma), finalColor, clamp(u_saturation, 0.0, 2.0));

    // Exposure + simple tonemap (prevents clipping while allowing brightening)
    finalColor *= max(0.0, u_exposure);
    finalColor = vec3(1.0) - exp(-finalColor);

    gl_FragColor = vec4(finalColor, u_opacity);
}
`;

class GradNoiseCanvas {
    private scene: any;
    private camera: any;
    private renderer: any;
    private material: any;
    private mesh: any;

    private running: boolean;
    private timeStartMs: number;
    private lastFrameMs: number | undefined;

    // Legacy API requirements (stateManager.ts)
    public readyPromise: Promise<void>;
    private _resolveReady: (() => void) | null;
    private minFrameInterval: number;
    private defaultFrameInterval: number;
    private maxFrameInterval: number;

    // Visual state
    private opacity: number;
    private targetOpacity: number;
    private warp: number;
    private warpDecayPerSecond: number;
    private direction: number;

    constructor(canvas: HTMLCanvasElement) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
        this.camera.position.z = 1;

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setClearColor(0x1c1c1c, 1);
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);

        this.opacity = 1.0;
        this.targetOpacity = 1.0;
        this.warp = 0.0;
        this.warpDecayPerSecond = 3.0; // ~0.33s tail
        this.direction = 1.0;

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0.0 },
                u_aspect: { value: 1.0 },
                u_noiseFreq: { value: DEFAULT_SETTINGS.noiseFreq },
                speed: { value: DEFAULT_SETTINGS.speed },
                u_opacity: { value: this.opacity },
                u_warp: { value: this.warp },
                u_direction: { value: this.direction },
                u_exposure: { value: DEFAULT_SETTINGS.exposure },
                u_saturation: { value: DEFAULT_SETTINGS.saturation }
            },
            vertexShader: FULLSCREEN_VERTEX_SHADER,
            fragmentShader: FULLSCREEN_FRAGMENT_SHADER,
            transparent: true,
            depthWrite: false,
            depthTest: false
        });

        const geometry = new THREE.PlaneGeometry(2, 2, 64, 64);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.mesh);

        this.running = true;
        this.timeStartMs = performance.now();

        this.defaultFrameInterval = 1000 / 120;
        this.minFrameInterval = this.defaultFrameInterval;
        this.maxFrameInterval = 100;

        this._resolveReady = null;
        this.readyPromise = new Promise((resolve) => {
            this._resolveReady = resolve;
        });

        this.onResize();
        window.addEventListener('resize', this.onResizeBound, { passive: true });

        this.setFrameCap(24); // low motion so no need for high fps

        this.animateBound = this.animate.bind(this);
        requestAnimationFrame(this.animateBound);

        this.log('Shader GradNoiseCanvas Created', {
            speed: DEFAULT_SETTINGS.speed,
            noiseFreq: DEFAULT_SETTINGS.noiseFreq,
            exposure: DEFAULT_SETTINGS.exposure,
            saturation: DEFAULT_SETTINGS.saturation
        });
    }

    private log(event: string, data?: LogData, note?: string, level: LogLevel = 'info') {
        logEvent('gradNoiseCanvas', event, data, note, level);
    }

    private animateBound: (ts: number) => void = () => { /* replaced in ctor */ };
    private onResizeBound = () => this.onResize();

    private onResize() {
        const width = window.innerWidth || 1;
        const height = window.innerHeight || 1;
        const aspect = width / height;

        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);

        this.material.uniforms.u_aspect.value = aspect;
        this.log('Renderer Resized', { width, height });
    }

    private stepVisualState(deltaSec: number) {
        // Smooth opacity approach
        const k = 10.0; // response rate
        const lerpFactor = 1.0 - Math.exp(-k * deltaSec);
        this.opacity = this.opacity + (this.targetOpacity - this.opacity) * lerpFactor;

        // Warp decay
        if (this.warp > 0) {
            this.warp = Math.max(0, this.warp - this.warpDecayPerSecond * deltaSec);
        } else if (this.warp < 0) {
            this.warp = Math.min(0, this.warp + this.warpDecayPerSecond * deltaSec);
        }

        this.material.uniforms.u_opacity.value = this.opacity;
        this.material.uniforms.u_warp.value = this.warp;
    }

    private animate(now: number) {
        if (!this.running) return;
        requestAnimationFrame(this.animateBound);

        if (this.lastFrameMs === undefined) {
            this.lastFrameMs = now;
        }
        
        const elapsed = now - this.lastFrameMs;
        if (elapsed < this.minFrameInterval) {
            return;
        }

        const deltaMs = Math.min(elapsed, this.maxFrameInterval);
        const deltaSec = deltaMs / 1000;
        this.lastFrameMs = now;

        perf.loopFrameStart('gradNoiseCanvas');

        const t = (now - this.timeStartMs) / 1000;
        this.material.uniforms.u_time.value = t;
        this.material.uniforms.u_direction.value = this.direction;

        this.stepVisualState(deltaSec);

        const segRender = perf.segmentStart('gradNoiseCanvas', 'render');
        this.renderer.render(this.scene, this.camera);
        perf.segmentEnd(segRender);

        if (this._resolveReady) {
            this._resolveReady();
            this._resolveReady = null;
            this.log('GradNoiseCanvas Ready');
        }

        perf.loopFrameEnd('gradNoiseCanvas');
    }

    //==============================================================================================
    // Legacy API (called by stateManager.ts)

    triggerWarp(reverse: boolean = false) {
        // Keep the event but implement as a short brightening pulse.
        this.warp = reverse ? -1.0 : 1.0;
        this.log('Warp Triggered', { reverse: Number(reverse) });
    }

    setStarDirection(direction: number) {
        this.direction = direction >= 0 ? 1.0 : -1.0;
        this.log('Star Direction Set', { direction: this.direction });
    }

    reduceStars() {
        // There are no "stars" now—this dims the shader background for gallery/projects views.
        this.targetOpacity = DEFAULT_SETTINGS.reducedOpacity;
        this.log('Background Reduced', { opacity: this.targetOpacity });
    }

    restoreStars() {
        this.targetOpacity = 1.0;
        this.log('Background Restored', { opacity: this.targetOpacity });
    }

    setFrameCap(fps: number | null) {
        if (fps && fps > 0) {
            this.minFrameInterval = 1000 / fps;
        } else {
            this.minFrameInterval = this.defaultFrameInterval;
        }
        this.log('Frame Cap Updated', { fps: fps ?? 0 });
    }

    destroy() {
        if (!this.running) return;
        this.running = false;
        window.removeEventListener('resize', this.onResizeBound);

        try {
            this.scene?.remove(this.mesh);
            this.mesh?.geometry?.dispose?.();
            this.material?.dispose?.();
            this.renderer?.dispose?.();
        } catch {
            // best-effort cleanup
        }

        this.log('GradNoiseCanvas Destroyed');
    }
}

export function createGradNoiseCanvas(canvas: HTMLCanvasElement) {
    return new GradNoiseCanvas(canvas);
}

// Initialize gradNoiseCanvas when the page loads and expose to state manager
let gradNoiseCanvasInstance: GradNoiseCanvas | null = null;
let pendingFrameCap: number | null = null;

window.addEventListener('load', () => {
    const canvas = document.getElementById('gnc') as HTMLCanvasElement | null;
    if (!canvas) {
        logEvent('gradNoiseCanvas', 'Skipped', { reason: 'no-canvas' });
        return;
    }

    gradNoiseCanvasInstance = createGradNoiseCanvas(canvas);
    if (pendingFrameCap !== null) {
        gradNoiseCanvasInstance.setFrameCap(pendingFrameCap);
    }

    (window as any).gradNoiseCanvasInstance = gradNoiseCanvasInstance;
    logEvent('gradNoiseCanvas', 'Instance Mounted', { type: 'shader' });
});

export function setGradNoiseCanvasFrameCap(fps: number | null) {
    pendingFrameCap = fps;
    if (gradNoiseCanvasInstance && typeof gradNoiseCanvasInstance.setFrameCap === 'function') {
        gradNoiseCanvasInstance.setFrameCap(fps);
    }
}
