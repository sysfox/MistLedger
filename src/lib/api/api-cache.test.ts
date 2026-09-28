/**
 * Unit tests for the client data cache.
 *
 * Runs on Node's built-in runner (`npm test`). The module under test has no
 * React or DOM dependency by design, so no jsdom and no test framework install
 * is required.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  API_CACHE_MAX_ENTRIES,
  API_CACHE_TTL_MS,
  createApiCache,
  type ApiCache,
} from "./api-cache.js";

/** Let queued microtasks/promise continuations run. */
const tick = () => new Promise((r) => setTimeout(r, 0));

type Harness = { cache: ApiCache; calls: string[] };

function harness(opts: { owner?: string | null; clock?: () => number } = {}): Harness {
  const calls: string[] = [];
  const cache = createApiCache({
    fetchJson: async (path) => {
      calls.push(path);
      return { path, calls: calls.length };
    },
    now: opts.clock,
  });
  cache.setOwner(opts.owner ?? null);
  return { cache, calls };
}

describe("登出 / 401 清空", () => {
  it("reset() empties the cache", async () => {
    const { cache } = harness({ owner: "user-A" });
    // No live subscriber: this is the real sign-out shape — the page is being
    // torn down, so nothing re-pumps and the map must be truly empty.
    for (let i = 0; i < 5; i++) {
      const off = cache.subscribe(`/api/data?days=${i}`, () => {});
      await tick();
      off();
    }
    assert.equal(cache.stats().size, 5);
    cache.reset();
    assert.equal(cache.stats().size, 0, "entries.size must be 0 after reset");
  });

  it("reset() drops the payload and a live subscriber refetches", async () => {
    const { cache, calls } = harness({ owner: "user-A" });
    const path = "/api/overview";
    cache.subscribe(path, () => {});
    await tick();
    assert.notEqual(cache.peek(path).data, null);
    const afterFirst = calls.length;

    cache.reset();
    // Synchronously after reset there is no payload: A's ledger is gone before
    // anything new can arrive.
    assert.equal(cache.peek(path).data, null, "previous account's payload must be gone");
    // The still-mounted panel is re-driven rather than stuck on a skeleton.
    await tick();
    assert.ok(calls.length > afterFirst, "a live subscriber must trigger a refetch");
    assert.notEqual(cache.peek(path).data, null, "refetched payload must land");
  });

  it("a 401 storm cannot re-arm the panels that just failed", async () => {
    let calls = 0;
    const cache = createApiCache({
      fetchJson: async () => {
        calls += 1;
        // Mirror client.ts: the session-lost handler runs BEFORE the throw.
        cache.reset({ silent: true });
        throw new Error("登录已过期，请重新登录");
      },
    });
    for (const p of ["/api/overview", "/api/ledger", "/api/data", "/api/settings"]) {
      cache.subscribe(p, () => {});
    }
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(calls, 4, "exactly one request per panel; no re-arm after 401");
  });

  it("the non-silent reset is the one that loops (the regression's cause)", async () => {
    // Same shape as above but WITHOUT `silent`. It exists to pin down *why*
    // the option is needed: if this ever stops looping, the silent flag is no
    // longer load-bearing and someone should re-examine the fix.
    let calls = 0;
    const cache = createApiCache({
      fetchJson: async () => {
        calls += 1;
        if (calls > 50) return { stop: true }; // probe's own safety cap
        cache.reset(); // <-- the bug: this re-pumps, and the 401 re-arms it
        throw new Error("登录已过期，请重新登录");
      },
    });
    cache.subscribe("/api/overview", () => {});
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(
      calls > 20,
      `a non-silent reset must still loop (proves the silent flag is load-bearing); calls=${calls}`,
    );
  });

  it("reset({silent:true}) still wipes and still notifies", async () => {
    // The silent path must not become "silent about the leak" — D-01 is about
    // wiping the payloads, and only the *pump* is suppressed.
    const { cache } = harness({ owner: "user-A" });
    const path = "/api/overview";
    let notifications = 0;
    cache.subscribe(path, () => {
      notifications += 1;
    });
    await tick();
    assert.notEqual(cache.peek(path).data, null, "precondition: a payload exists");

    const before = notifications;
    cache.reset({ silent: true });

    assert.equal(cache.peek(path).data, null, "user-A's payload must be gone");
    assert.equal(cache.getOwner(), null, "the owner tag must be cleared too");
    assert.ok(notifications > before, "a mounted panel must still be told to re-read");
  });

  it("after a silent reset nothing refetches on its own", async () => {
    const { cache, calls } = harness({ owner: "user-A" });
    const path = "/api/overview";
    cache.subscribe(path, () => {});
    await tick();
    const afterFirst = calls.length;

    cache.reset({ silent: true });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(calls.length, afterFirst, "the session-lost path must issue no new request");
  });

  it("reset() notifies subscribers (they cannot render a ghost payload)", async () => {
    const { cache } = harness();
    const path = "/api/overview";
    let notifications = 0;
    cache.subscribe(path, () => {
      notifications += 1;
    });
    await tick();
    const before = notifications;
    cache.reset();
    assert.ok(notifications > before, "reset must notify");
  });

  it("setOwner() drops entries belonging to a different account", async () => {
    const { cache } = harness({ owner: "user-A" });
    const path = "/api/overview";
    cache.subscribe(path, () => {});
    await tick();
    assert.notEqual(cache.peek(path).data, null);

    cache.setOwner("user-B");
    assert.equal(cache.peek(path).data, null, "user-A's payload must not survive");
  });

  it("setOwner(null) drops tagged entries", async () => {
    const { cache } = harness({ owner: "user-A" });
    cache.subscribe("/api/overview", () => {});
    await tick();
    cache.setOwner(null);
    assert.equal(cache.peek("/api/overview").data, null);
  });

  it("an account switch refetches and yields the new account's payload", async () => {
    const { cache } = harness({ owner: "user-A" });
    const path = "/api/overview";
    cache.subscribe(path, () => {});
    await tick();
    cache.reset();
    cache.setOwner("user-B");
    cache.subscribe(path, () => {});
    await tick();
    assert.ok(cache.peek(path).data, "user-B gets a fresh fetch");
  });
});

describe("out-of-order 请求不得覆盖新数据", () => {
  it("5 rapid reloads settle on the last response", async () => {
    const path = "/api/overview";
    let call = 0;
    let lastResolved = 0;
    const cache = createApiCache({
      fetchJson: async () => {
        const n = ++call;
        // The first request is the slowest, so it resolves *after* all five
        // reloads. Without a request id its stale payload would win.
        await new Promise((r) => setTimeout(r, n === 1 ? 120 : 5));
        lastResolved = n;
        return { call: n };
      },
    });
    cache.subscribe(path, () => {});
    await tick();
    for (let i = 0; i < 5; i++) cache.reload(path);
    await new Promise((r) => setTimeout(r, 300));

    // The slowest request really did resolve last...
    assert.equal(lastResolved, 1, "request #1 was supposed to resolve last");
    // ...and its commit was discarded, leaving the newest payload on screen.
    assert.equal(
      (cache.peek(path).data as { call: number }).call,
      6,
      "the rendered payload must be request #6, not the late request #1",
    );
    assert.equal(cache.peek(path).error, null);
  });

  it("superseded requests are aborted, not merely ignored", async () => {
    let completed = 0;
    const cache = createApiCache({
      fetchJson: async (_p, init) => {
        // Behave like a real `fetch`: aborting settles the promise immediately
        // and stops the request from occupying the connection.
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 60);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          });
        });
        completed += 1;
        return { ok: true };
      },
    });
    const off = cache.subscribe("/api/overview", () => {});
    await tick();
    for (let i = 0; i < 4; i++) cache.reload("/api/overview");
    // Let every abort/reject settle.
    await new Promise((r) => setTimeout(r, 200));
    off();
    assert.equal(completed, 1, "only the newest request may survive; 4 were superseded");
    assert.notEqual(cache.peek("/api/overview").data, null);
  });

  it("an aborted request does not raise an unhandled rejection", async () => {
    const rejections: unknown[] = [];
    const onRejection = (e: { reason?: unknown }) => rejections.push(e.reason);
    process.on("unhandledRejection", onRejection);
    const cache = createApiCache({
      fetchJson: async (_p, init) => {
        await new Promise((r) => setTimeout(r, 50));
        if (init?.signal?.aborted) throw new Error("aborted");
        return { ok: true };
      },
    });
    cache.subscribe("/api/overview", () => {});
    await tick();
    cache.reload("/api/overview");
    cache.reload("/api/overview");
    await new Promise((r) => setTimeout(r, 200));
    process.off("unhandledRejection", onRejection);
    assert.deepEqual(rejections, []);
  });
});

describe("render 期不得写缓存", () => {
  it("peek() on an unknown path creates nothing", () => {
    const { cache, calls } = harness();
    const snap = cache.peek("/api/never-fetched");
    assert.equal(snap.data, null);
    assert.equal(snap.error, null);
    assert.equal(cache.stats().size, 0, "peek must not allocate an entry");
    assert.deepEqual(calls, [], "peek must not trigger a request");
  });

  it("peek() returns a stable snapshot identity for a missing path", () => {
    const { cache } = harness();
    assert.equal(cache.peek("/api/a"), cache.peek("/api/b"));
  });

  it("repeated peek() calls do not grow the cache", async () => {
    const { cache } = harness();
    cache.subscribe("/api/overview", () => {});
    await tick();
    const size = cache.stats().size;
    for (let i = 0; i < 50; i++) cache.peek("/api/overview");
    assert.equal(cache.stats().size, size);
  });
});

describe("LRU + TTL", () => {
  it("200 filter combinations stay within the entry cap", async () => {
    const { cache } = harness();
    for (let i = 0; i < 200; i++) {
      const off = cache.subscribe(`/api/data?days=${i}`, () => {});
      await tick();
      off();
    }
    assert.ok(
      cache.stats().size <= API_CACHE_MAX_ENTRIES,
      `size=${cache.stats().size} must be <= ${API_CACHE_MAX_ENTRIES}`,
    );
  });

  it("nothing older than the TTL survives", async () => {
    let clock = 1_000_000;
    const { cache } = harness({ clock: () => clock });
    for (let i = 0; i < 20; i++) {
      const off = cache.subscribe(`/api/data?days=${i}`, () => {});
      await tick();
      off();
    }
    const stats = cache.stats();
    assert.ok(stats.oldestAgeMs <= API_CACHE_TTL_MS);
    clock += API_CACHE_TTL_MS + 1;
    assert.equal(cache.sweep() > 0, true, "sweep must collect expired entries");
    assert.equal(cache.stats().size, 0);
  });

  it("the TTL is finite and the cap is positive", () => {
    assert.ok(API_CACHE_TTL_MS > 0 && API_CACHE_TTL_MS <= 10 * 60 * 1000);
    assert.ok(API_CACHE_MAX_ENTRIES > 0 && API_CACHE_MAX_ENTRIES <= 1000);
  });

  it("a path with a live subscriber is never evicted", async () => {
    const { cache } = harness();
    const keep = "/api/overview";
    cache.subscribe(keep, () => {});
    await tick();
    for (let i = 0; i < API_CACHE_MAX_ENTRIES + 30; i++) {
      const off = cache.subscribe(`/api/data?x=${i}`, () => {});
      await tick();
      off();
    }
    assert.notEqual(cache.peek(keep).data, null, "in-use entry was evicted");
  });
});

describe("error handling", () => {
  it("a failed first fetch surfaces the error", async () => {
    const cache = createApiCache({
      fetchJson: async () => {
        throw new Error("流水加载失败，请稍后重试");
      },
    });
    cache.subscribe("/api/ledger", () => {});
    await tick();
    assert.equal(cache.peek("/api/ledger").data, null);
    assert.equal(cache.peek("/api/ledger").error?.message, "流水加载失败，请稍后重试");
  });

  it("a silent reload keeps the previous payload on failure", async () => {
    let fail = false;
    const cache = createApiCache({
      fetchJson: async () => {
        if (fail) throw new Error("账目读取失败，请稍后重试");
        return { v: 1 };
      },
    });
    cache.subscribe("/api/settings", () => {});
    await tick();
    fail = true;
    cache.reload("/api/settings", { silent: true });
    await tick();
    const snap = cache.peek("/api/settings");
    assert.deepEqual(snap.data, { v: 1 }, "payload must survive a silent failure");
    assert.equal(snap.error, null);
  });

  it("a retry after a failure recovers", async () => {
    let fail = true;
    const cache = createApiCache({
      fetchJson: async () => {
        if (fail) throw new Error("数据加载失败，请稍后重试");
        return { v: 2 };
      },
    });
    cache.subscribe("/api/overview", () => {});
    await tick();
    assert.ok(cache.peek("/api/overview").error);
    fail = false;
    cache.reload("/api/overview");
    await tick();
    assert.deepEqual(cache.peek("/api/overview").data, { v: 2 });
    assert.equal(cache.peek("/api/overview").error, null);
  });
});
