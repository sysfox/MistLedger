const CACHE = "mistledger-v1";

const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/_next/image"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

function isRscRequest(request, url) {
  return (
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    url.searchParams.has("_rsc")
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return offlineFallback();
  }
}

function offlineFallback() {
  return new Response(
    `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0a0e14" />
<title>雾夜账 · 离线</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; min-height: 100vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px;
    background: #0a0e14; color: #e9e4d8;
    font-family: system-ui, sans-serif;
    -webkit-user-select: none; user-select: none;
  }
  .lamp-dot {
    width: 10px; height: 10px; border-radius: 9999px;
    background: #e3b341;
    box-shadow: 0 0 8px rgba(227,179,65,.55), 0 0 24px rgba(227,179,65,.25);
    animation: lamp-breathe 2s ease-in-out infinite;
  }
  @keyframes lamp-breathe {
    0%, 100% { opacity: 1; }
    50% { opacity: .65; }
  }
  p { margin: 0; font-size: 14px; }
  .hint { font-size: 12px; color: #8b93a7; }
  @media (prefers-reduced-motion: reduce) {
    .lamp-dot { animation: none; }
  }
</style>
</head>
<body>
  <div class="lamp-dot" aria-hidden="true"></div>
  <p>雾太浓了，暂时连不上账房</p>
  <p class="hint">等雾散了再试一次</p>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isRscRequest(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
