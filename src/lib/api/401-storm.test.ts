/**
 * End-to-end regression for the 401 self-sustaining request storm.
 *
 * `apiGet` calls `onSessionLost()` *before* throwing on a 401, and that
 * handler runs `cache.reset()`. A non-silent reset wipes the payloads and then
 * calls `repumpAll()`, so each 401 re-arms the mounted panels, whose fresh
 * requests come back 401, which reset again — a loop with no natural bound.
 * The fix is `cache.reset({ silent: true })`: wipe + notify, no pump.
 *
 * This file drives the REAL modules (`client.ts` and `api-cache.ts`) and only
 * stubs the two globals they touch: `fetch` (always answers 401) and
 * `window.location.replace` (counted). `client.test.ts` covers the same seam
 * with a single panel and a stubbed `fetchJson`; what this adds is the CONTROL
 * arm — the pre-fix wiring (`reset()` with no flag) is re-run on every
 * `npm test` and asserted to still blow past its cap, so the `silent` flag is
 * proven load-bearing rather than assumed to be.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { apiGet, setSessionLostHandler } from "./client.js";
import { createApiCache } from "./api-cache.js";

const PANELS = ["/api/overview", "/api/ledger", "/api/data", "/api/settings"];

/** How long to let the event loop run. A converged system is idle well before. */
const SETTLE_MS = 300;

/**
 * Safety cap for the CONTROL arm only. The point of that arm is to show the
 * pre-fix loop does not stop on its own, so the cap is hit rather than reached.
 */
const CONTROL_CAP = 200;

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  setSessionLostHandler(null);
  delete (globalThis as { window?: unknown }).window;
});

/** Count every `fetch` and every `location.replace`, like a real tab would. */
function installProbe({ stopAfter = Infinity }: { stopAfter?: number } = {}) {
  const counters = { requests: 0, redirects: 0 };
  (globalThis as { window?: unknown }).window = {
    location: {
      replace: () => {
        counters.redirects += 1;
      },
    },
  };
  globalThis.fetch = (async () => {
    counters.requests += 1;
    if (counters.requests > stopAfter) throw new Error("probe cap reached");
    // The scenario under test: the session is gone and stays gone.
    return new Response(null, { status: 401 });
  }) as typeof fetch;
  return counters;
}

/** Mount `PANELS` and let the loop either converge or run away. */
async function run({ silent, cap }: { silent: boolean; cap: number }) {
  const counters = installProbe({ stopAfter: cap });
  const cache = createApiCache({ fetchJson: apiGet });
  setSessionLostHandler(() => (silent ? cache.reset({ silent: true }) : cache.reset()));
  for (const path of PANELS) cache.subscribe(path, () => {});
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  setSessionLostHandler(null);
  return { ...counters, size: cache.stats().size };
}

describe("401 自激请求风暴", () => {
  it("对照组：修复前的接线不收敛（撞到探针上限而非自行停止）", async () => {
    // NOT a claim about the app's wiring — it calls `reset()` without the flag
    // purely to show the flag is load-bearing.
    const before = await run({ silent: false, cap: CONTROL_CAP });
    assert.ok(
      before.requests >= CONTROL_CAP,
      `修复前必须不收敛，实际 ${before.requests} 次请求 / ${before.redirects} 次跳转（上限 ${CONTROL_CAP}）`,
    );
  });

  it("实验组：修复后的接线每个 panel 恰好一次请求", async () => {
    const after = await run({ silent: true, cap: Infinity });
    assert.equal(after.requests, PANELS.length, `每个 panel 一次请求（实际 ${after.requests}）`);
    assert.ok(
      after.redirects <= PANELS.length,
      `跳转次数同样有界，实际 ${after.redirects} 次（≤ ${PANELS.length}）`,
    );
    assert.equal(after.size, 0, "会话丢失后缓存必须被清空");
  });
});
