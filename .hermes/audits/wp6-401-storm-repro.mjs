#!/usr/bin/env node
/**
 * [WP6-01] Reproduction and proof for the 401 self-sustaining request storm.
 *
 * The defect: `apiGet` calls `onSessionLost()` *before* throwing on a 401, and
 * that handler ran `cache.reset()`, which wiped the payloads and then called
 * `repumpAll()`. So each 401 re-armed the four mounted panels, whose fresh
 * requests came back 401, which reset again — forever. The reviewer measured
 * 84 requests / 80 `location.replace` from 4 panels before their probe's own
 * cap; the loop has no natural bound.
 *
 * The fix: `cache.reset({ silent: true })` — wipe + notify, no pump.
 *
 * This script drives the REAL modules (`src/lib/api/client.ts` and
 * `src/lib/api/api-cache.ts`) and only stubs the two globals they touch:
 * `fetch` (always answers 401) and `window.location.replace` (counted). It
 * asserts at the end that the wiring it mirrors is still the wiring the app
 * ships, so this probe cannot quietly drift away from the fix.
 *
 * Usage (from the repo root):
 *   node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs \
 *        .hermes/audits/wp6-401-storm-repro.mjs
 *
 * Exit code 0 = the fixed path is bounded. Non-zero = the storm is back.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { apiGet, setSessionLostHandler } from "../../src/lib/api/client.ts";
import { createApiCache } from "../../src/lib/api/api-cache.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PANELS = ["/api/overview", "/api/ledger", "/api/data", "/api/settings"];
/** How long to let the event loop run. A converged system is idle well before. */
const SETTLE_MS = 1500;
/**
 * Safety cap for the PRE-FIX run only. The point of that run is to show the
 * loop does not stop on its own, so the cap is hit rather than reached.
 */
const PRE_FIX_CAP = 2000;

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

/** Count every `fetch` and every `location.replace`, like a real tab would. */
function installProbe({ stopAfter = Infinity } = {}) {
  const counters = { requests: 0, redirects: 0 };
  globalThis.window = {
    location: {
      replace: () => {
        counters.redirects += 1;
      },
    },
  };
  globalThis.fetch = async () => {
    counters.requests += 1;
    if (counters.requests > stopAfter) throw new Error("probe cap reached");
    // The scenario under test: the session is gone and stays gone.
    return new Response(null, { status: 401 });
  };
  return counters;
}

/** Mount `PANELS` and let the loop either converge or run away. */
async function run({ silent, cap }) {
  const counters = installProbe({ stopAfter: cap });
  const cache = createApiCache({ fetchJson: apiGet });
  setSessionLostHandler(() =>
    silent ? cache.reset({ silent: true }) : cache.reset(),
  );
  for (const path of PANELS) cache.subscribe(path, () => {});
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  setSessionLostHandler(null);
  return { ...counters, size: cache.stats().size };
}

async function main() {
  console.log("[WP6-01] 401 自激请求风暴复现 / 修复验证");
  console.log(
    `\n  场景：${PANELS.length} 个已挂载的 panel，服务端对每一个 ${PANELS.join(" / ")} 恒回 401`,
  );
  console.log(`  静置窗口：${SETTLE_MS}ms\n`);

  // ---- The defect, simulated. NOT a claim about the current code: it calls
  // reset() without the flag purely to show the flag is load-bearing. ----
  console.log("── 对照组：修复前的接线（cache.reset()，无 silent）──");
  const before = await run({ silent: false, cap: PRE_FIX_CAP });
  console.log(
    `\n  total network requests issued  : ${before.requests}\n` +
      `  location.replace invocations   : ${before.redirects}`,
  );
  check(
    "修复前：不收敛（撞到探针上限而非自行停止）",
    before.requests >= PRE_FIX_CAP,
    `${before.requests} 次请求 / ${before.redirects} 次跳转（上限 ${PRE_FIX_CAP}）`,
  );

  // ---- The shipped wiring. ----
  console.log("\n── 实验组：修复后的接线（cache.reset({ silent: true })）──");
  const after = await run({ silent: true, cap: Infinity });
  console.log(
    `\n  total network requests issued  : ${after.requests}\n` +
      `  location.replace invocations   : ${after.redirects}`,
  );
  check(
    "修复后：每个 panel 恰好一次请求，不再自激",
    after.requests === PANELS.length,
    `${after.requests} 次请求（期望 ${PANELS.length}）`,
  );
  check(
    "修复后：跳转次数同样有界",
    after.redirects <= PANELS.length,
    `${after.redirects} 次跳转（≤ ${PANELS.length}）`,
  );
  check("修复后：缓存被清空，无残留", after.size === 0, `entries.size=${after.size}`);

  // ---- The probe mirrors the app. If this fails, the numbers above are about
  // a wiring the product no longer uses. ----
  const source = readFileSync(`${ROOT}src/lib/api/use-api-data.ts`, "utf8");
  check(
    "use-api-data.ts 的 session-lost 接线确实是静默复位",
    /setSessionLostHandler\(\(\) => cache\.reset\(\{ silent: true \}\)\)/.test(source),
    "src/lib/api/use-api-data.ts",
  );

  console.log("");
  if (failures > 0) {
    console.log(`结果：${failures} 项未通过`);
    process.exit(1);
  }
  console.log("结果：全部通过");
}

main();
