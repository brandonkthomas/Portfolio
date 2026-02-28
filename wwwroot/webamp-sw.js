const CACHE_VERSION = "v1";
const SHELL_CACHE = `webamp-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `webamp-runtime-${CACHE_VERSION}`;

const SHELL_ASSETS = [
    "/webamp/",
    "/apps/webamp/dist/js/webamp.js",
    "/apps/webamp/css/webamp.extension.css",
    "/apps/indium/dist/indium.css"
];

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        await cache.addAll(SHELL_ASSETS);
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const expected = new Set([SHELL_CACHE, RUNTIME_CACHE]);
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => (
            expected.has(key) ? Promise.resolve() : caches.delete(key)
        )));
        await self.clients.claim();
    })());
});

function isHandledRequest(request) {
    if (!request || request.method !== "GET") return false;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return false;
    if (url.pathname.startsWith("/api/")) return false;
    return (
        url.pathname.startsWith("/webamp") ||
        url.pathname.startsWith("/apps/webamp") ||
        url.pathname.startsWith("/apps/indium") ||
        url.pathname.startsWith("/assets/")
    );
}

async function networkFirst(request) {
    const runtime = await caches.open(RUNTIME_CACHE);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            await runtime.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await runtime.match(request);
        if (cached) return cached;
        const shell = await caches.match("/webamp/");
        if (shell) return shell;
        throw new Error("Network unavailable and no cached fallback.");
    }
}

async function staleWhileRevalidate(request) {
    const runtime = await caches.open(RUNTIME_CACHE);
    const cached = await runtime.match(request);
    const networkPromise = fetch(request)
        .then(async (response) => {
            if (response && response.ok) {
                await runtime.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    if (cached) {
        return cached;
    }

    const network = await networkPromise;
    if (network) return network;

    return Response.error();
}

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (!isHandledRequest(request)) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
        return;
    }

    event.respondWith(staleWhileRevalidate(request));
});
