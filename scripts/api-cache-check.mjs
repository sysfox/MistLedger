#!/usr/bin/env node
/**
 * Executable proof for the client data cache.
 *
 * The cache module is dependency-free, so it can be driven directly under
 * `node --test` (see `src/lib/api/api-cache.test.ts` for the unit suite). This
 * script is the runnable, human-readable counterpart used in review: it prints
 * the actual numbers behind the three claims the audit makes.
 *
 * Usage: npm run test:api-cache
 *   (or: node --experimental-strip-types scripts/api-cache-check.mjs)
 */

import {
  createApiCache,
  API_CACHE_MAX_ENTRIES,
  API_CACHE_TTL_MS,
} from "../src/lib/api/api-cache.ts";

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function checkLogoutClears() {
  console.log("\n登出清空：用户 A 登出后，缓存不得残留 A 的账");
  let payload = { owner: "user-A", total: 4200 };
  const cache = createApiCache({ fetchJson: async () => payload });
  cache.setOwner("user-A");
  const path = "/api/overview";

  // The real sign-out shape: pages are being torn down, so nothing re-pumps.
  for (let i = 0; i < 6; i++) {
    const off = cache.subscribe(i === 0 ? path : `/api/data?days=${i}`, () => {});
    await tick();
    off();
  }
  const a1 = cache.peek(path);
  check("A 首次取数成功", a1.data?.owner === "user-A", `data.owner=${a1.data?.owner}`);
  check("A 期间缓存有 6 条", cache.stats().size === 6, `size=${cache.stats().size}`);

  // Sign-out path: resetApiCache().
  cache.reset();
  check("登出后 entries.size === 0", cache.stats().size === 0, `size=${cache.stats().size}`);
  check("登出后 data 归 null", cache.peek(path).data === null, `data=${cache.peek(path).data}`);

  // User B signs in. The cache must not hand back A's payload.
  payload = { owner: "user-B", total: 100 };
  cache.setOwner("user-B");
  {
    const off = cache.subscribe(path, () => {});
    await tick();
    off();
  }
  check("B 只看到自己的数据", cache.peek(path).data?.owner === "user-B", `data.owner=${cache.peek(path).data?.owner}`);

  // Owner-tag fallback: same tab, cache not reset, owner flips.
  const cache2 = createApiCache({ fetchJson: async () => ({ n: 1 }) });
  cache2.setOwner("user-A");
  {
    const off = cache2.subscribe("/api/overview", () => {});
    await tick();
    off();
  }
  check("A 的 entry 有 owner 标记", cache2.getOwner() === "user-A" && cache2.peek("/api/overview").data !== null);
  cache2.setOwner("user-C");
  check("owner 切换后旧 entry 被丢弃", cache2.peek("/api/overview").data === null, `data=${cache2.peek("/api/overview").data}`);
}

async function checkOutOfOrder() {
  console.log("\nout-of-order：连点 5 次重试，最终数据必须来自最后一次响应");
  const path = "/api/overview";
  let call = 0;
  let aborted = 0;
  const cache = createApiCache({
    fetchJson: async (_p, init) => {
      const n = ++call;
      // Request #1 is the slowest, so it resolves *after* all five reloads.
      // Without a request id its stale payload would overwrite the newest.
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, n === 1 ? 200 : 10);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          aborted += 1;
          reject(new Error("aborted"));
        });
      });
      return { call: n };
    },
  });
  cache.subscribe(path, () => {});
  await tick();
  for (let i = 0; i < 5; i++) cache.reload(path);
  await new Promise((r) => setTimeout(r, 500));
  check("5 次 reload 后数据 = 最后一次响应", cache.peek(path).data?.call === 6, `data.call=${cache.peek(path).data?.call}（期望 #6）`);
  check("无 error 泄漏", cache.peek(path).error === null, `error=${cache.peek(path).error}`);
  check("被取代的请求真的被 AbortController 取消", aborted === 5, `aborted=${aborted}（期望 5）`);

  // Strongest case: a fetch that IGNORES the abort signal entirely (a
  // misbehaving transport, a cached layer, a polyfill). Only the request-id
  // comparison can save us here — the last *resolved* payload is #1, and it
  // must still lose to #4.
  let call2 = 0;
  const cache2 = createApiCache({
    fetchJson: async () => {
      const n = ++call2;
      await new Promise((r) => setTimeout(r, n === 1 ? 150 : 5));
      return { call: n };
    },
  });
  cache2.subscribe(path, () => {});
  await tick();
  for (let i = 0; i < 3; i++) cache2.reload(path);
  await new Promise((r) => setTimeout(r, 400));
  check("忽略 abort 的旧请求也不覆盖新数据", cache2.peek(path).data?.call === 4, `data.call=${cache2.peek(path).data?.call}（期望 #4）`);
}

async function checkLruTtl() {
  console.log("\nLRU + TTL：200 个筛选组合后常驻不超过上限，且无过期条目");
  let clock = 1_000_000;
  const cache = createApiCache({
    fetchJson: async (p) => ({ path: p }),
    now: () => clock,
  });
  for (let i = 0; i < 200; i++) {
    // Subscribe then immediately unsubscribe: the data page does not hold a
    // listener for every historic filter combination.
    const off = cache.subscribe(`/api/data?days=${i}`, () => {});
    await tick();
    off();
  }
  const stats = cache.stats();
  check(
    `200 个组合后 size <= ${API_CACHE_MAX_ENTRIES}`,
    stats.size <= API_CACHE_MAX_ENTRIES,
    `size=${stats.size}`,
  );
  check(
    `无 TTL 之前的条目（TTL=${API_CACHE_TTL_MS}ms）`,
    stats.oldestAgeMs <= API_CACHE_TTL_MS,
    `oldestAgeMs=${stats.oldestAgeMs}`,
  );

  // Advance past the TTL: everything must be collectable.
  clock += API_CACHE_TTL_MS + 1;
  const swept = cache.sweep();
  check("TTL 到期后全部回收", cache.stats().size === 0, `swept=${swept} size=${cache.stats().size}`);

  // A live subscriber must survive eviction pressure (never evict in-use paths).
  const cache2 = createApiCache({ fetchJson: async (p) => ({ p }), now: () => clock });
  const keep = "/api/overview";
  cache2.subscribe(keep, () => {});
  await tick();
  for (let i = 0; i < API_CACHE_MAX_ENTRIES + 20; i++) {
    const off = cache2.subscribe(`/api/data?x=${i}`, () => {});
    await tick();
    off();
  }
  check(
    "有订阅者的 path 不被淘汰",
    cache2.peek(keep).data !== null,
    `data=${cache2.peek(keep).data !== null}`,
  );
}

async function main() {
  await checkLogoutClears();
  await checkOutOfOrder();
  await checkLruTtl();
  console.log("");
  if (failures > 0) {
    console.log(`结果：${failures} 项未通过`);
    process.exit(1);
  }
  console.log("结果：全部通过");
}

main();
