#!/usr/bin/env node
/**
 * Independent reverse-attack set for the DESIGN.md §十一 taboo guards.
 *
 * Separate from `check-taboo-guard.mjs` on purpose: that script is the rule's own regression
 * suite (one probe per route the rule claims to fold), while this one *attacks the fixes* — each
 * case targets a branch that could plausibly be bypassed. A guard that only ever tests the cases
 * it was written for proves nothing about the cases it was not. A new construction route means a
 * new case here before the route is called supported.
 *
 * `expect`    = must be reported. Silence is a finding.
 * `expectNot` = must stay silent. A hit is a finding (a guard the team learns to ignore is not
 *               a guard).
 *
 * Every case was checked against the real runtime value of its expression — several early
 * "escapes" here were bugs in the *test*, not the rule, and asserting on a string that was never
 * a violation is how a guard gets "hardened" into uselessness.
 *
 * Usage: node scripts/attack-taboo-guard.mjs
 * Exit 0 = every `expect` case was caught and every `expectNot` stayed quiet.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REL = "src/__taboo_attack_probe__.tsx";
const ABS = join(ROOT, "src", "__taboo_attack_probe__.tsx");
const ESLINT_JS = join(ROOT, "node_modules", "eslint", "bin", "eslint.js");

/** Lint a throwaway source string and return the taboo-rule messages only. */
function lint(source) {
  writeFileSync(ABS, source);
  try {
    let stdout;
    try {
      stdout = execFileSync(
        process.execPath,
        [ESLINT_JS, "--no-warn-ignored", REL, "--format", "json"],
        { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (e) {
      // eslint exits 1 when it reports errors — the expected path here.
      stdout = e.stdout ?? "";
    }
    const messages = JSON.parse(stdout || "[]")[0]?.messages ?? [];
    return messages.map((m) => m.message).filter((m) => /DESIGN\.md|无法静态解析/.test(m));
  } finally {
    rmSync(ABS, { force: true });
  }
}

const Z = 'const RAMP = "zinc";\n';

const CASES = [
  // --- A. the number fold ------------------------------------------------------
  { label: "A1 数字在 + 链最左（运行时 500-zinc，非类名）", expectNot: "DESIGN.md",
    why: "数字折叠不得凭位置造出禁忌",
    src: 'const RAMP2 = "zinc";\nexport const A = () => <p className={500 + "-" + RAMP2} />;\n' },
  { label: "A2 纯算术 5 + 0 不得折叠成 \"50\"", expectNot: "DESIGN.md",
    why: "折叠数字最易引入的误报：把算术当拼接",
    src: 'export const A = () => <p className={"5" + 0} />;\n' },
  { label: "A3 数字 0 不触发禁忌", expectNot: "DESIGN.md",
    why: "0 是合法数字字面量", src: 'export const A = () => <p className={"panel-" + 0} />;\n' },
  { label: "A4 数字在模板槽位", expect: "DESIGN.md",
    why: "E2 修复不得回退模板路径",
    src: Z + "export const A = () => <p className={`text-${RAMP}-${500}`} />;\n" },
  { label: "A5 负数色阶 -500", expect: "DESIGN.md",
    why: "-500 是 UnaryExpression 而非 Literal",
    src: 'export const A = () => <p className={"text-zinc" + -500} />;\n' },

  // --- B. concat ordering ------------------------------------------------------
  { label: "B1 concat 追加在前（运行时 500-text-zinc，无色号）", expectNot: "DESIGN.md",
    why: "顺序正确后不该凭空造出禁忌",
    src: 'export const A = () => <p className={["500"].concat(["text-zinc"]).join("-")} />;\n' },
  { label: "B2 双层 concat（分隔符重复，运行时 text--zinc-500）", expectNot: "DESIGN.md",
    why: "重复分隔符产生的不是类名；递归 peel 不得凭空造词",
    src: 'export const A = () => <p className={["text-"].concat(["zinc"]).concat(["500"]).join("-")} />;\n' },
  { label: "B2b 双层 concat（元素自带完整片段）", expect: "DESIGN.md",
    why: "真正该拦的形态：片段自带类名，不靠分隔符拼出色号",
    src: 'export const A = () => <p className={["text-zinc"].concat(["500"]).concat([]).join("-")} />;\n' },
  { label: "B3 concat 混入不可折叠数组（运行时 text--zinc）", expectNot: "DESIGN.md",
    why: "与 check-taboo-guard 的 U6 一致：非槽位空洞不报，否则每个 prop 透传都变噪音",
    src: 'export const A = (k) => <p className={["text-"].concat([k]).join("-")} />;\n' },

  // --- C. the method-chain boundary --------------------------------------------
  { label: "C1 replace 改写成合法色（已知过近似，仍按接收者报）", expect: "DESIGN.md",
    why: "接收者里确实写着 text-zinc-500；这是 Known boundaries 声明的过近似，不是新缺陷",
    src: 'const K = ["text-zinc-500"];\nexport const A = () => <p className={K.join(" ").replace("zinc", "night")} />;\n' },
  { label: "C2 replace 实参里藏禁忌", expect: "DESIGN.md",
    why: "实参本身可能带禁忌 token",
    src: 'export const A = () => <p className={"panel".replace("panel", "text-zinc-500")} />;\n' },
  { label: "C3 padStart 尾缀", expect: "DESIGN.md",
    why: "STRING_DERIVING_METHODS 的其他成员是否同样生效",
    src: 'const K = ["text-zinc-500"];\nexport const A = () => <p className={K.join(" ").padStart(20, " ")} />;\n' },

  // --- D. the split-index boundary ---------------------------------------------
  { label: "D1 split 取第二段", expect: "DESIGN.md",
    why: "下标不是 0 时是否仍成立",
    src: 'const K = ["panel", "text-zinc-500"];\nexport const A = () => <p className={K.join(" ").split(" ")[1]} />;\n' },
  { label: "D2 split 越界下标不得误报", expectNot: "DESIGN.md",
    why: "越界返回 undefined，不能凭空造出禁忌",
    src: 'const K = ["panel"];\nexport const A = () => <p className={K.join(" ").split(" ")[5]} />;\n' },
  { label: "D3 split 接收者含洞（与 className={t} 同形）", expectNot: "DESIGN.md",
    why: "接收者全未知时无法与合法 prop 透传区分，报它等于给每个透传加噪音",
    src: 'export const A = (t) => <p className={t.split(" ")[0]} />;\n' },

  // --- E. the Known-boundaries claims --------------------------------------
  { label: "E1 导入的常量（无法静态求值 → 报洞，不静默）", expect: "无法静态解析",
    why: "同文件解析的固有边界；按「宁可误报」原则应报洞而非放过",
    src: 'import { RAMP } from "./constants";\nexport const A = () => <p className={`text-${RAMP}-500`} />;\n' },
  { label: "E2 动态下标取数组（落在槽位内）", expect: "无法静态解析",
    why: "K[i] 落在 text- 槽位时必须报",
    src: 'const K = ["zinc", "500"];\nexport const A = (i) => <p className={`text-${K[i]}-500`} />;\n' },
  { label: "E3 动态下标不在槽位", expectNot: "DESIGN.md",
    why: "非槽位洞是合法的 prop 透传",
    src: 'const K = ["panel", "card"];\nexport const A = (i) => <p className={K[i]} />;\n' },
  { label: "E4 超出 MAX_INTERPOLATION_HOPS 的两跳插值", expect: "无法静态解析",
    why: "一跳上限的边界；同样应报洞而非静默放过",
    src: Z + "const A1 = `zinc${RAMP}`;\nexport const A = () => <p className={`text-${A1}-500`} />;\n" },

  // --- F. regressions these folds must not cause -------------------------------
  { label: "F1 合规 concat/join 不得误报", expectNot: "DESIGN.md",
    why: "concat 修复是否污染正常代码",
    src: 'export const A = () => <p className={["panel", "card"].concat(["border-fogline"]).join(" ")} />;\n' },
  { label: "F2 合规数字拼接不得误报", expectNot: "DESIGN.md",
    why: "数字折叠是否对合规类名过度敏感",
    src: 'export const A = () => <p className={"grid-cols-" + 3} />;\n' },
  { label: "F3 合规 replace/trim 不得误报", expectNot: "DESIGN.md",
    why: "实参空格分隔是否造成新误报",
    src: 'export const A = () => <p className={"  panel  ".trim().replace(/\\s+/g, " ")} />;\n' },
  { label: "F4 合规 split 下标不得误报", expectNot: "DESIGN.md",
    why: "split 索引是否对合规类名过度敏感",
    src: 'export const A = () => <p className={"panel text-ink".split(" ")[1]} />;\n' },
  { label: "F5 运行时数组不得误报", expectNot: "DESIGN.md",
    why: "不可静态求值的数组应退化为洞而非误报",
    src: 'export const A = (arr) => <p className={arr.map((s) => s).join(" ")} />;\n' },

  // --- G. shapes not covered by check-taboo-guard.mjs ---------------------------
  { label: "G1 join 的元素本身是数组", expect: "DESIGN.md",
    why: "[[a],[b]].join() 的元素是数组而非字符串",
    src: 'export const A = () => <p className={[["text-zinc-500"], ["panel"]].join(" ")} />;\n' },
  { label: "G2 join 的分隔符本身带禁忌", expect: "DESIGN.md",
    why: "分隔符是字面量时也该被扫到",
    src: 'export const A = () => <p className={["a", "b"].join("text-zinc-500")} />;\n' },
  { label: "G3 flatMap 回调内拼禁忌", expect: "DESIGN.md",
    why: "CLASS_REGION_NODES 含箭头函数，回调体应被走进去",
    src: 'export const A = () => <p className={["zinc", "500"].flatMap((s) => "text-" + s).join(" ")} />;\n' },
  { label: "G4 reverse 后再 join", expect: "DESIGN.md",
    why: "filtering 族应整体可剥离",
    src: 'export const A = () => <p className={["text-zinc", "500"].reverse().join("-")} />;\n' },
  { label: "G5 sort 后再 join（运行时 500-text-zinc，无色号）", expectNot: "DESIGN.md",
    why: "确认 sort 被剥离后不会凭空造出禁忌",
    src: 'export const A = () => <p className={["500", "text-zinc"].sort().join("-")} />;\n' },
  { label: "G5b sort 后再 join（真的含色号）", expect: "DESIGN.md",
    why: "filtering 族应整体可剥离",
    src: 'export const A = () => <p className={["text-zinc", "500"].sort().join("-")} />;\n' },
  { label: "G6 标签模板 tw`…`", expect: "DESIGN.md",
    why: "QUARANTINED_TAGS 是否真的生效",
    src: Z + "export const A = () => <p className={tw`text-${RAMP}-500`} />;\n" },
  { label: "G7 逗号运算符组装", expect: "DESIGN.md",
    why: "SequenceExpression 在 CLASS_REGION_NODES 里",
    src: 'export const A = () => <p className={("panel", "text-zinc-500")} />;\n' },
  { label: "G8 class 而非 className", expect: "DESIGN.md",
    why: "CLASS_NAME_KEYS 含 class",
    src: 'export const A = () => <p class="text-zinc-500" />;\n' },
  { label: "G9 非空断言 ! 载体", expect: "DESIGN.md",
    why: "TSNonNullExpression 应被穿透",
    src: Z + 'export const A = () => <p className={"text-" + RAMP + "-500"!} />;\n' },
  { label: "G10 嵌套 cn(cn(…))", expect: "DESIGN.md",
    why: "包装器套包装器不应成为绕过",
    src: 'const K = ["text-", "zinc", "-500"];\nexport const A = () => <p className={cn(cn(...K))} />;\n' },
];

let escaped = 0;
let falsePositives = 0;
let caught = 0;

console.log("DESIGN.md §十一 禁忌守卫 · 独立反向攻击用例\n");
for (const testCase of CASES) {
  const hits = lint(testCase.src);
  if (testCase.expectNot) {
    if (hits.length) {
      falsePositives += 1;
      console.log(`  ✗ 误报  ${testCase.label}`);
      console.log(`        ${hits[0].split("\n")[0]}`);
    } else {
      caught += 1;
      console.log(`  ✓ 静默  ${testCase.label}`);
    }
  } else if (hits.length) {
    caught += 1;
    console.log(`  ✓ 拦下  ${testCase.label}`);
  } else {
    escaped += 1;
    console.log(`  ✗ 逃逸  ${testCase.label}`);
    console.log(`        ← ${testCase.why}`);
  }
}

if (existsSync(ABS)) rmSync(ABS, { force: true });

console.log(
  `\n合计 ${CASES.length} 例：符合预期 ${caught}，误报 ${falsePositives}，逃逸 ${escaped}`,
);
if (falsePositives || escaped) process.exit(1);
