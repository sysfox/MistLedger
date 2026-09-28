#!/usr/bin/env node
/**
 * [WP6-03] Probe for the tightened taboo-classname guard.
 *
 * The reviewer found that the guard could be walked around by splitting a
 * taboo class across a template interpolation:
 *
 *     const RAMP = "zinc";
 *     <p className={`text-${RAMP}-500`} />      // → 0 ESLint messages
 *
 * because the rule scanned each `TemplateElement` in isolation and no single
 * quasi ever contained `text-zinc-500`. The rule now stitches the template
 * back together (resolving same-file `const` bindings) and scans the result.
 *
 * Scope note: `scripts/check-taboo-guard.mjs` is the project's canonical guard
 * self-test, but it is outside this work package's file ownership, so the
 * [WP6-03] cases live here. They belong in that script; wiring them in is a
 * one-line follow-up for whoever owns `scripts/**`.
 *
 * Every case below is a file ESLint actually lints — not a unit test of the
 * regexes — because the claim being made is "ESLint reports this", and only a
 * real run can support it.
 *
 * Usage (from the repo root): node .hermes/audits/wp6-taboo-guard-probe.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROBE_REL = "src/__wp6_taboo_probe__.tsx";
const PROBE_ABS = join(ROOT, "src", "__wp6_taboo_probe__.tsx");
const ESLINT_JS = join(ROOT, "node_modules", "eslint", "bin", "eslint.js");

/** `expect` = the guard must fire; `expectNot` = it must stay silent. */
const CASES = [
  {
    label: "对照组：合规类名（含真实项目里的 FOCUS_RING 拼接）不误报",
    expectNot: "DESIGN.md",
    source: [
      'const FOCUS_RING = "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-lamp/60";',
      "export const OK = ({ active }: { active: boolean }) => (",
      '  <div className={`panel border-fogline text-ink ${active ? "text-dim" : "text-ink"} ${FOCUS_RING}`}>',
      '    <span className="money text-ember">¥12.00</span>',
      "  </div>",
      ");",
      "",
    ].join("\n"),
  },
  {
    label: "[WP6-03] const 插值绕过（审核员原探针）",
    expect: "DESIGN.md §十一#6",
    source: [
      'const RAMP = "zinc";',
      "export const C = () => <p className={`text-${RAMP}-500`}>掌灯中</p>;",
      "",
    ].join("\n"),
  },
  {
    label: "[WP6-03] const 对象成员插值绕过",
    expect: "DESIGN.md §十一#1",
    source: [
      'const TONE = { hue: "red" };',
      "export const D = () => <span className={`text-${TONE.hue}-500`} />;",
      "",
    ].join("\n"),
  },
  {
    label: "[WP6-03] 禁忌色整体塞进 const 再插值",
    expect: "DESIGN.md §十一#6",
    source: [
      'const BAD = "bg-slate-700";',
      "export const E = () => <div className={`${BAD} p-2`} />;",
      "",
    ].join("\n"),
  },
  {
    label: "[WP6-03] dark: 变体经由 const 插值",
    expect: "DESIGN.md §十一#5",
    source: [
      'const NIGHT = "dark";',
      "export const F = () => <div className={`${NIGHT}:bg-veil`} />;",
      "",
    ].join("\n"),
  },
  {
    label: "[WP6-03] 运行时拼接（无法静态解析）在 className 位上报出",
    expect: "无法静态解析",
    source: [
      "export const G = (ramp: string) => <p className={`text-${ramp}-500`}>掌灯中</p>;",
      "",
    ].join("\n"),
  },
  {
    label: "[WP6-03] 同样的运行时拼接出现在非 className 位置不报噪音",
    expectNot: "无法静态解析",
    source: [
      "export const H = (id: string) => <p>{`账目 ${id} 读取失败，请稍后重试`}</p>;",
      "",
    ].join("\n"),
  },
  {
    label: "回归：dark: 前缀不误报（darkness-500 / archived:）",
    expectNot: "DESIGN.md §十一#5",
    source: [
      "export const I = () => <div className=\"darkness-500 archived:bg-veil\" />;",
      "",
    ].join("\n"),
  },
  {
    label: "回归：模板字面量里的禁忌类名仍被拦截",
    expect: "DESIGN.md",
    source: [
      "export const J = (tone) => <div className={`border-red-500 text-ink`} />;",
      "",
    ].join("\n"),
  },
];

function lint() {
  try {
    return {
      ok: true,
      stdout: execFileSync(
        process.execPath,
        [ESLINT_JS, "--no-warn-ignored", PROBE_REL, "--format", "json"],
        { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    };
  } catch (e) {
    // eslint exits 1 when it reports errors — the expected path here.
    return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

function main() {
  console.log("[WP6-03] 禁忌守卫 · 模板插值绕过探针\n");
  if (!existsSync(ESLINT_JS)) {
    console.error(`ESLint not found at ${ESLINT_JS} — run "npm install" first.`);
    process.exit(1);
  }
  let failures = 0;

  for (const testCase of CASES) {
    writeFileSync(PROBE_ABS, testCase.source);
    try {
      const messages = JSON.parse(lint().stdout || "[]")[0]?.messages ?? [];
      const hit = messages.find((m) => String(m.message).includes(testCase.expectNot ?? testCase.expect));

      if (testCase.expectNot) {
        if (hit) {
          failures += 1;
          console.log(`  ✗ ${testCase.label} —— 误报：${hit.message}`);
        } else {
          console.log(`  ✓ ${testCase.label}`);
        }
        continue;
      }

      if (hit) {
        console.log(`  ✓ ${testCase.label}`);
        console.log(`      ${hit.message}`);
      } else {
        failures += 1;
        console.log(`  ✗ ${testCase.label} —— lint 未报错，实际输出：`);
        console.log(
          messages.length
            ? messages.map((m) => `      ${m.ruleId}: ${m.message}`).join("\n")
            : "      （无任何 ESLint 报错 —— 守卫失效）",
        );
      }
    } finally {
      rmSync(PROBE_ABS, { force: true });
    }
  }

  if (existsSync(PROBE_ABS)) rmSync(PROBE_ABS, { force: true });

  console.log("");
  if (failures > 0) {
    console.log(`结果：${failures} 个守卫未生效`);
    process.exit(1);
  }
  console.log(`结果：全部 ${CASES.length} 项通过，临时探针文件已删除`);
}

main();
