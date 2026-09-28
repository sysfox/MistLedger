#!/usr/bin/env node
/**
 * [D-25] Proves the DESIGN.md §十一 lint guards actually fail.
 *
 * A lint rule that never fires is indistinguishable from no rule at all, and
 * these are the rules standing between the taboo list and a `text-zinc-500`.
 * So: write a throwaway file that violates each guard, run ESLint against it,
 * assert the expected message came back, then delete the file.
 *
 * Usage: node scripts/check-taboo-guard.mjs
 * Exit code 0 = every guard fired as designed.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROBE_REL = "src/__taboo_guard_probe__.tsx";
const VIOLATION_FILE = join(ROOT, "src", "__taboo_guard_probe__.tsx");

/** Each case: a label, the probe source, and either `expect` (must fire) or
 *  `expectNot` (must stay silent — a false-positive guard).
 *
 *  [WP6-06] The `CONSTRUCTION_ROUTES` block below is the load-bearing part.
 *  Every way of assembling a class name at runtime is a separate escape unless
 *  the rule covers it: two earlier review rounds were rejected for exactly this
 *  — the rule scanned `TemplateLiteral` quasis, then someone reached the same
 *  result through `+` concatenation. A new route is a new bypass, so a new
 *  probe belongs here before the route is called supported.
 */
const CASES = [
  {
    label: "§十一#6 zinc 灰阶",
    source: `export const A = () => <p className="text-zinc-500">掌灯中</p>;\n`,
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "§十一#6 slate 灰阶",
    source: `export const B = () => <div className="border-slate-700" />;\n`,
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "§十一#6 neutral 灰阶",
    source: `export const C = () => <div className="bg-neutral-900" />;\n`,
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "§十一#1 标准色 red-500",
    source: `export const D = () => <span className="text-red-500" />;\n`,
    expect: "DESIGN.md §十一#1",
  },
  {
    label: "§十一#1 标准色 blue-600",
    source: `export const E = () => <span className="bg-blue-600" />;\n`,
    expect: "DESIGN.md §十一#1",
  },
  {
    label: "§十一#1 标准色 indigo-500",
    source: `export const F = () => <span className="border-indigo-500" />;\n`,
    expect: "DESIGN.md §十一#1",
  },
  {
    label: "§十一#5 dark: 变体",
    source: `export const G = () => <div className="bg-night dark:bg-veil" />;\n`,
    expect: "DESIGN.md §十一#5",
  },
  {
    label: "§十一#5 dark: 前缀不误报（darkness-500 / archived:）",
    source: `export const H = () => <div className="darkness-500 archived:bg-veil" />;\n`,
    expectNot: "DESIGN.md §十一#5",
  },
  {
    label: "外部标准色板 import",
    source: `import colors from "tailwindcss/colors";\nexport default colors;\n`,
    expect: "禁止引入外部标准色板",
  },
  {
    label: "window.confirm",
    source: `export function I() { window.confirm("确认删除这笔？"); }\n`,
    expect: "window.confirm",
  },

  // ---- [WP6-06] construction routes: every one of these is an escape hatch
  // unless the rule can fold it or flag the hole. Keep one probe per route.
  {
    label: "构造·纯字面量（基线）",
    source: `export const R1 = () => <p className="text-zinc-500" />;\n`,
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·模板插值 + 同文件 const",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R2 = () => <p className={`text-${RAMP}-500`} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·+ 字符串拼接（WP6-06 原始绕过口子）",
    source:
      "const BASE = \"zinc\";\n" +
      "export const R3 = () => <p className={\"text-\" + BASE + \"-500\"} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·const 数组下标",
    source:
      "const K = [\"zinc\", \"500\"];\n" +
      "export const R4 = () => <p className={`text-${K[0]}-${K[1]}`} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·数组字面量 join",
    source:
      "export const R5 = () => <p className={[\"text-\", \"zinc\", \"-500\"].join(\"\")} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·const 数组 join",
    source:
      "const K2 = [\"text-\", \"zinc\", \"-500\"];\n" +
      "export const R5b = () => <p className={K2.join(\"\")} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·对象查表 MAP.r",
    source:
      "const MAP = { r: \"zinc\", s: \"500\" };\n" +
      "export const R6 = () => <p className={`text-${MAP.r}-${MAP.s}`} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·对象查表 MAP[\"r\"] + 拼接",
    source:
      "const MAP = { r: \"zinc\", s: \"500\" };\n" +
      "export const R6b = () => <p className={\"text-\" + MAP[\"r\"] + \"-\" + MAP[\"s\"]} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·String.raw 标签模板",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R7 = () => <p className={String.raw`text-${RAMP}-500`} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·逻辑表达式 ||",
    source: `export const R8 = (x) => <p className={x || "text-zinc-500"} />;\n`,
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·条件表达式（禁忌藏在未走到分支）",
    source: `export const R9 = (x) => <p className={x ? "text-ink" : "bg-zinc-900"} />;\n`,
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·cn(...) 包裹 + 拼接",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R10 = (x) => <p className={cn(\"text-\", RAMP, \"-500\", x)} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·变量间接引用 const V = \"text-\" + RAMP",
    source:
      "const RAMP = \"zinc\";\n" +
      "const V = \"text-\" + RAMP + \"-500\";\n" +
      "export const R11 = () => <p className={V} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·两跳 const 间接引用",
    source:
      "const W1 = \"text-zinc\";\n" +
      "const W2 = W1 + \"-500\";\n" +
      "export const R12 = () => <p className={W2} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·as string 载体",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R13 = () => <p className={(\"text-\" + RAMP + \"-500\") as string} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·satisfies 载体",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R14 = () => <p className={(\"text-\" + RAMP + \"-500\") satisfies string} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·右括号嵌套 (\"text-\" + (RAMP + \"-500\"))",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R15 = () => <p className={\"text-\" + (RAMP + \"-500\")} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·拼接里嵌模板字面量",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R16 = () => <p className={\"text-\" + `${RAMP}` + \"-500\"} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·拼接链中含未知量，静态片段已可判定禁忌",
    source: `export const R17 = (t) => <p className={"text-" + t + "zinc-500"} />;\n`,
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·dark: 拼接",
    source:
      "const DARK = \"dark:bg-veil\";\n" +
      "export const R18 = () => <p className={\"bg-night \" + DARK} />;\n",
    expect: "DESIGN.md §十一#5",
  },
  {
    label: "构造·模板里嵌 + 拼接",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R19 = () => <p className={`panel ${\"text-\" + RAMP + \"-500\"}`} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·map 回调体内拼接（整串在箭头函数里组装）",
    source:
      "export const R20 = () => <p className={[\"text-zinc\", \"500\"].map((s) => s).join(\"-\")} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·map 回调体内槽位拼接（报无法静态解析）",
    source:
      "export const R20b = (k) => <p className={[k].map((s) => \"text-\" + s).join(\" \")} />;\n",
    expect: "无法静态解析",
  },
  {
    label: "构造·模板里嵌三元 + 拼接",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R21 = (x) => <p className={`a ${x ? \"text-ink\" : \"text-\" + RAMP + \"-500\"}`} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·对象属性 className 形式",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R22 = () => <p {...{ className: \"text-\" + RAMP + \"-500\" }} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·完全由片段字面量拼出（无中间变量）",
    source: `export const R23 = () => <p className={"te" + "xt-zinc" + "-500"} />;\n`,
    expect: "DESIGN.md §十一#6",
  },

  {
    label: "构造·join 前有 reduce（数组仍可静态求值）",
    source:
      "export const R24 = () => <p className={[\"text-zinc\", \"500\"].reduce((a, b) => [...a, b], []).join(\"-\")} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·join 前有 concat（追加的数组也要算进去）",
    source:
      "export const R25 = () => <p className={[\"text-zinc\"].concat([\"500\"]).join(\"-\")} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·数字色阶（色号是数字不是字符串）",
    source:
      "const RAMP = \"zinc\";\n" +
      "export const R26 = () => <p className={\"text-\" + RAMP + \"-\" + 500} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·join 后接 replace（实参不得粘坏接收者的边界）",
    source:
      "const K3 = [\"text-zinc\", \"500\"];\n" +
      "export const R27 = () => <p className={K3.join(\"-\").replace(\"z\", \"z\")} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·join 后 split 再下标取回类名",
    source:
      "const K4 = [\"text-zinc-500\", \"panel\"];\n" +
      "export const R28 = () => <p className={K4.join(\" \").split(\" \")[0]} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·cn 跨 const 展开（E3）",
    source:
      "const K5 = [\"text-\", \"zinc\", \"-500\"];\n" +
      "export const R29 = () => <p className={cn(...K5)} />;\n",
    expect: "DESIGN.md §十一#6",
  },
  {
    label: "构造·对象内联展开取值（E4）",
    source:
      "const M2 = { a: \"text-\", b: \"zinc-500\" };\n" +
      "export const R30 = () => <p className={{ ...M2 }.a + { ...M2 }.b} />;\n",
    expect: "DESIGN.md §十一#6",
  },

  // ---- [WP6-06] unresolvable holes: a hole the resolver cannot fold must be
  // reported when it sits exactly where a banned ramp or shade would go.
  {
    label: "无法静态解析·槽位前缀 text-",
    source: `export const U1 = (t) => <p className={"text-" + t} />;\n`,
    expect: "无法静态解析",
  },
  {
    label: "无法静态解析·槽位后缀 -500",
    source: `export const U2 = (t) => <p className={t + "-500"} />;\n`,
    expect: "无法静态解析",
  },
  {
    label: "无法静态解析·dark: 变体槽位",
    source: `export const U3 = (t) => <p className={"bg-night " + t + ":bg-veil"} />;\n`,
    expect: "无法静态解析",
  },
  {
    label: "无法静态解析·模板里的数组下标",
    source:
      "const K = [\"zinc\", \"500\"];\n" +
      "export const U4 = (i) => <p className={`text-${K[i]}-500`} />;\n",
    expect: "无法静态解析",
  },
  {
    label: "无法静态解析·cn 内模板插值落在槽位",
    source: `export const U5 = (t) => <p className={cn("text-", t)} />;\n`,
    expect: "无法静态解析",
  },
  // A hole that is *not* in a banned slot is idiomatic (passing a prop through),
  // and reporting it would be noise the team learns to ignore.
  {
    label: "无法静态解析·非槽位空洞不误报（透传 prop）",
    source: `export const U6 = (t) => <p className={cn("panel", t)} />;\n`,
    expectNot: "无法静态解析",
  },
];

/**
 * Invoke the locally installed ESLint through its JS entry point. Going
 * through `npx` fails as a spawned child on Windows (`npx.cmd` needs a shell),
 * and the `.bin/eslint.cmd` shim has the same problem — `node <entry>` works
 * identically on every platform.
 */
const ESLINT_JS = join(ROOT, "node_modules", "eslint", "bin", "eslint.js");

function lint() {
  if (!existsSync(ESLINT_JS)) {
    throw new Error(`ESLint not found at ${ESLINT_JS} — run "npm install" first.`);
  }
  try {
    const stdout = execFileSync(
      process.execPath,
      [ESLINT_JS, "--no-warn-ignored", PROBE_REL, "--format", "json"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { ok: true, stdout };
  } catch (e) {
    // eslint exits 1 when it reports errors — that is the expected path here.
    return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

function main() {
  console.log("DESIGN.md §十一 lint 守卫自测\n");
  let failures = 0;

  // Control case: a compliant file must NOT be flagged by the taboo rules.
  writeFileSync(VIOLATION_FILE, `export const OK = () => (\n  <div className="panel border-fogline text-ink">\n    <span className="money text-ember">¥12.00</span>\n  </div>\n);\n`);
  try {
    const control = lint();
    const messages = JSON.parse(control.stdout || "[]")[0]?.messages ?? [];
    const tabooHits = messages.filter((m) => String(m.message).includes("DESIGN.md"));
    if (tabooHits.length > 0) {
      console.log(`  ✗ 对照组误报：合规类名被禁忌规则命中 ${tabooHits.length} 次`);
      for (const m of tabooHits) console.log(`      ${m.message}`);
      failures += 1;
    } else {
      console.log("  ✓ 对照组：panel / border-fogline / text-ink / text-ember / .money 无误报");
    }
  } finally {
    rmSync(VIOLATION_FILE, { force: true });
  }

  for (const testCase of CASES) {
    writeFileSync(VIOLATION_FILE, testCase.source);
    try {
      const result = lint();
      const parsed = JSON.parse(result.stdout || "[]");
      const messages = parsed[0]?.messages ?? [];

      if (testCase.expectNot) {
        // False-positive guard: this input must stay silent.
        const hit = messages.find((m) => String(m.message).includes(testCase.expectNot));
        if (hit) {
          failures += 1;
          console.log(`  ✗ ${testCase.label} —— 误报：`);
          console.log(`      ${hit.message}`);
        } else {
          console.log(`  ✓ ${testCase.label}`);
        }
        continue;
      }

      const hit = messages.find((m) => String(m.message).includes(testCase.expect));
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
      rmSync(VIOLATION_FILE, { force: true });
    }
  }

  if (existsSync(VIOLATION_FILE)) rmSync(VIOLATION_FILE, { force: true });

  console.log("");
  if (failures > 0) {
    console.log(`结果：${failures} 个守卫未生效`);
    process.exit(1);
  }
  console.log(`结果：全部 ${CASES.length + 1} 项通过，临时违规文件已删除`);
}

main();
