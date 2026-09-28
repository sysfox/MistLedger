import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";

import { ApiError, apiGet, setSessionLostHandler } from "./client.js";
import { createApiCache } from "./api-cache.js";

const realFetch = globalThis.fetch;
let redirects: string[] = [];

beforeEach(() => {
  redirects = [];
  (globalThis as { window?: unknown }).window = {
    location: { replace: (url: string) => redirects.push(url) },
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  setSessionLostHandler(null);
  delete (globalThis as { window?: unknown }).window;
});

function respondWith(status: number, body?: unknown) {
  globalThis.fetch = (async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

describe("401 vs 503 分流", () => {
  it("401 notifies the session-lost handler, redirects, and throws", async () => {
    let lost = 0;
    setSessionLostHandler(() => {
      lost += 1;
    });
    respondWith(401);

    await assert.rejects(
      () => apiGet("/api/overview"),
      (e: unknown) => e instanceof ApiError && e.status === 401 && !e.retryable,
    );
    assert.equal(lost, 1, "the handler must run exactly once per 401");
    assert.deepEqual(redirects, ["/login"]);
  });

  it("503 stays put: no redirect, no session-lost, and it is retryable", async () => {
    let lost = 0;
    setSessionLostHandler(() => {
      lost += 1;
    });
    respondWith(503, { error: "service-unavailable" });

    await assert.rejects(
      () => apiGet("/api/overview"),
      (e: unknown) => e instanceof ApiError && e.status === 503 && e.retryable,
    );
    assert.deepEqual(redirects, [], "an upstream outage must not kick the user out");
    assert.equal(lost, 0, "an outage is not a session loss");
  });

  it("503 shows the outage copy and never the server's machine code", async () => {
    respondWith(503, { error: "service-unavailable" });

    await assert.rejects(
      () => apiGet("/api/overview"),
      (e: unknown) =>
        e instanceof ApiError &&
        e.status === 503 &&
        e.message === "账房暂时联系不上，稍后再试一次" &&
        !e.message.includes("service-unavailable"),
    );
  });

  it("a 5xx is retryable and a 4xx is not", async () => {
    respondWith(502, { error: "账目读取失败，请稍后重试" });
    await assert.rejects(
      () => apiGet("/api/ledger"),
      (e: unknown) => e instanceof ApiError && e.retryable === true,
    );
    respondWith(400, { error: "筛选条件不合法" });
    await assert.rejects(
      () => apiGet("/api/ledger"),
      (e: unknown) => e instanceof ApiError && e.retryable === false,
    );
  });
});

describe("服务端文案透传", () => {
  it("passes through a Chinese server message", async () => {
    respondWith(502, { error: "账目读取失败，请稍后重试" });
    await assert.rejects(
      () => apiGet("/api/ledger"),
      (e: unknown) => e instanceof ApiError && e.message === "账目读取失败，请稍后重试",
    );
  });

  it("never surfaces a machine-readable code as user copy", async () => {
    respondWith(500, { error: "unauthenticated" });
    await assert.rejects(
      () => apiGet("/api/overview"),
      (e: unknown) => e instanceof ApiError && !e.message.includes("unauthenticated"),
    );
  });

  it("falls back to generic copy when the body is not JSON", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>502 Bad Gateway</html>", { status: 502 })) as typeof fetch;
    await assert.rejects(
      () => apiGet("/api/overview"),
      (e: unknown) => e instanceof ApiError && e.message.length > 0,
    );
  });

  it("a transport failure is status 0 and retryable", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await assert.rejects(
      () => apiGet("/api/overview"),
      (e: unknown) => e instanceof ApiError && e.status === 0 && e.retryable,
    );
    assert.deepEqual(redirects, [], "a dead network is not a logout");
  });
});

describe("401 storm through the real client", () => {
  it("four mounted panels + a permanent 401 issues a bounded number of requests", async () => {
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return new Response(null, { status: 401 });
    }) as typeof fetch;

    const cache = createApiCache({ fetchJson: apiGet });
    setSessionLostHandler(() => cache.reset({ silent: true }));

    for (const p of ["/api/overview", "/api/ledger", "/api/data", "/api/settings"]) {
      cache.subscribe(p, () => {});
    }
    await new Promise((r) => setTimeout(r, 500));

    assert.equal(requests, 4, `one request per panel, no re-arm (got ${requests})`);
    assert.equal(redirects.length, 4, `one redirect per 401, no more (got ${redirects.length})`);
    assert.equal(cache.stats().size, 0, "the session-lost wipe must leave nothing behind");
  });

  it("use-api-data.ts really does wire the session-lost handler silently", () => {
    const source = readFileSync(new URL("./use-api-data.ts", import.meta.url), "utf8");
    assert.match(
      source,
      /setSessionLostHandler\(\(\) => cache\.reset\(\{ silent: true \}\)\)/,
      "the 401 path must reset silently, or the storm returns",
    );
  });
});
