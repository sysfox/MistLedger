#!/usr/bin/env node
/**
 * TTFB / total-time benchmark for MistLedger pages and API routes.
 *
 * Usage:
 *   node scripts/bench.mjs [--base http://localhost:3000] [--runs 10] [--cookie "sb-...=..."]
 *
 * Each target is fetched `runs` times sequentially; TTFB = time to response
 * headers, total = full body consumed. Reports mean and p95 in ms.
 * Anonymous page requests follow redirects ("manual" fetch) so the auth-gate
 * roundtrip stays part of the measurement.
 */

const args = process.argv.slice(2);
function argOf(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const BASE = argOf("--base", "http://localhost:3000").replace(/\/$/, "");
const RUNS = Number(argOf("--runs", "10"));
const COOKIE = argOf("--cookie", process.env.BENCH_COOKIE ?? "");

const PAGE_TARGETS = ["/", "/ledger", "/data", "/settings", "/login"];
const API_TARGETS = ["/api/overview", "/api/ledger", "/api/data", "/api/settings"];

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function measure(url, { follow, json }) {
  const headers = {};
  if (COOKIE) headers.cookie = COOKIE;
  if (json) headers.accept = "application/json";
  const t0 = performance.now();
  const res = await fetch(BASE + url, {
    redirect: follow ? "follow" : "manual",
    headers,
  });
  const ttfb = performance.now() - t0;
  await res.arrayBuffer();
  const total = performance.now() - t0;
  return { status: res.status, ttfb, total, redirected: res.redirected || res.status === 302 };
}

function report(name, rows) {
  const ttfbs = rows.map((r) => r.ttfb).sort((a, b) => a - b);
  const totals = rows.map((r) => r.total).sort((a, b) => a - b);
  const statuses = [...new Set(rows.map((r) => r.status))].join("/");
  return {
    name,
    statuses,
    ttfbMean: ttfbs.reduce((s, v) => s + v, 0) / ttfbs.length,
    ttfbP95: percentile(ttfbs, 95),
    totalMean: totals.reduce((s, v) => s + v, 0) / totals.length,
    totalP95: percentile(totals, 95),
  };
}

async function main() {
  const results = [];
  for (const path of PAGE_TARGETS) {
    const rows = [];
    for (let i = 0; i < RUNS; i++) {
      rows.push(await measure(path, { follow: false, json: false }));
      await new Promise((r) => setTimeout(r, 100));
    }
    results.push(report(`PAGE ${path}`, rows));
  }
  for (const path of API_TARGETS) {
    const rows = [];
    for (let i = 0; i < RUNS; i++) {
      rows.push(await measure(path, { follow: false, json: true }));
      await new Promise((r) => setTimeout(r, 100));
    }
    results.push(report(`API  ${path}`, rows));
  }

  console.log(`\nbase=${BASE} runs=${RUNS} cookie=${COOKIE ? "yes" : "no (anonymous)"}\n`);
  console.log(
    "target".padEnd(18),
    "status".padEnd(8),
    "ttfb avg".padStart(10),
    "ttfb p95".padStart(10),
    "total avg".padStart(11),
    "total p95".padStart(11),
  );
  for (const r of results) {
    console.log(
      r.name.padEnd(18),
      r.statuses.padEnd(8),
      `${r.ttfbMean.toFixed(1)}ms`.padStart(10),
      `${r.ttfbP95.toFixed(1)}ms`.padStart(10),
      `${r.totalMean.toFixed(1)}ms`.padStart(11),
      `${r.totalP95.toFixed(1)}ms`.padStart(11),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
