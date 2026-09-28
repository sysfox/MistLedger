import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { apiGet, setSessionLostHandler } from "./client.js";
import { createApiCache } from "./api-cache.js";

const PANELS = ["/api/overview", "/api/ledger", "/api/data", "/api/settings"];

const SETTLE_MS = 300;

const CONTROL_CAP = 200;

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  setSessionLostHandler(null);
  delete (globalThis as { window?: unknown }).window;
});

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
    return new Response(null, { status: 401 });
  }) as typeof fetch;
  return counters;
}

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
