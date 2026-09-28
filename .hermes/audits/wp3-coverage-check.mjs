#!/usr/bin/env node
// WP-3 覆盖度核验（round 3）
//
// 审核员在 round 2 §7 指出的根因：上一轮的核验脚本只查三项
// （date-window 归零 / 路径存在 / 符号导出），**不验证注释里的覆盖度声明**，
// 所以漏过了 D-4 的三条。本脚本把覆盖度变成可机器验证的断言。
//
// 解析器对**两种清单写法都生效**，因为返工前后的注释格式不同：
//   旧写法  符号列表单独一行，下一行才是 `→ 路径`（或「（…由 X 覆盖）」）
//   新写法  `符号 → 路径` 同行
// 若解析器只认新写法，它会漏掉旧写法的全部声明，从而对错误注释报 PASS ——
// 那比没有检查更危险。所以本脚本带 GUARD 自检，并要求跑负向对照
// （对返工前的旧注释跑，必须 FAIL；详见 .hermes/audits/wp3-fix-round3.md）。
//
// 断言：
//   RULE A  清单里每条「符号 → 路径」，该符号必须真的出现在该路径里
//           （\b 边界匹配，非子串误配）
//   RULE B  标 `(无测试覆盖)` 的符号，必须在整个 src/** 的 *.test.ts(x) 里
//           确实 0 引用 —— 双向防谎报：有覆盖说成无覆盖 / 无覆盖说成有覆盖
//   GUARD   抓到的断言数不得为 0，否则这次 PASS 是空跑，脚本无效
//
// 退出码：0 = 全部通过；1 = 有断言失败。只读，不修改任何文件。
//
// 用法：node .hermes/audits/wp3-coverage-check.mjs [目标文件(仓库相对路径)]

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
// argv[2] 可覆盖目标文件（负向对照用：对旧版注释跑，应 FAIL）
const STATS = process.argv[2] ? join(ROOT, process.argv[2]) : join(ROOT, "src/lib/ledger/stats.ts");

const read = (p) => readFileSync(p, "utf8");
const rel = (f) => relative(ROOT, f).split("\\").join("/");

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e === ".git") continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const srcFiles = walk(join(ROOT, "src"));
const testFiles = srcFiles.filter((f) => /\.test\.(ts|tsx)$/.test(f));

const countIn = (text, sym) => (text.match(new RegExp(`\\b${sym}\\b`, "g")) || []).length;

const isSymbolList = (s) =>
  /^[A-Za-z_$][\w$]*(\s*\/\s*[A-Za-z_$][\w$]*)*$/.test(s.trim()) && !s.includes("→");

// ── 解析注释头（到第一个非注释行为止）─────────────────────────────
const headLines = [];
for (const line of read(STATS).split("\n")) {
  if (!line.startsWith("//")) break;
  headLines.push(line);
}
const stripped = headLines.map((l) => l.replace(/^\/\/\s?/, ""));

// claims: {symbols, target}；noneCovered: [{symbols}]
const claims = [];
const noneCovered = [];
let pending = []; // 尚未绑定路径的符号（旧写法：列表行与箭头行分开）
let group = [];   // 当前 ①②③ 组已收集的符号（供「以上…」回指）

for (const body of stripped) {
  const text = body.trim();
  if (!text) continue;

  // 换组 → 收尾上一组
  if (/^[①②③]/.test(text)) {
    if (group.length) claims.push({ symbols: group, target: "(本组汇总)" });
    group = [];
    pending = [];
    continue;
  }

  // 「（以上日期函数另由 <path> 覆盖）」——回指当前组 + pending
  const paren = text.match(/由\s+(\S+?)\s*覆盖/);
  if (paren && /[（(]/.test(text)) {
    const refs = [...new Set([...group, ...pending])];
    if (refs.length) claims.push({ symbols: refs, target: paren[1] });
    pending = [];
    continue;
  }

  // `符号 → 目标`（新写法）或 `→ 目标`（旧写法的箭头行）
  const arrow = text.match(
    /^([A-Za-z_$][\w$]*(?:\s*\/\s*[A-Za-z_$][\w$]*)*)?\s*→\s*(\S+)\s*$/,
  );
  if (arrow) {
    const symbols = arrow[1]
      ? arrow[1].split("/").map((s) => s.trim()).filter(Boolean)
      : [...pending];
    const target = arrow[2];
    if (/\(无测试覆盖\)/.test(target)) noneCovered.push({ symbols });
    else claims.push({ symbols, target });
    pending = [];
    group.push(...symbols);
    continue;
  }

  // 纯符号列表行
  if (isSymbolList(text)) {
    const syms = text.split("/").map((s) => s.trim()).filter(Boolean);
    pending.push(...syms);
    group.push(...syms);
    continue;
  }

  // 其它散文行：切断 pending 生命周期
  pending = [];
}
if (group.length) claims.push({ symbols: group, target: "(本组汇总)" });

// ── 报告 ──────────────────────────────────────────────────────────
let failures = 0;
const fail = (m) => { console.log(`  FAIL  ${m}`); failures++; };
const pass = (m) => console.log(`  ok    ${m}`);

console.log("WP-3 覆盖度核验 —— 注释声明 vs 实测引用");
console.log(`目标文件: ${rel(STATS)}  (注释头 ${headLines.length} 行)`);
console.log(`测试文件全集 (${testFiles.length}): ${testFiles.map(rel).join(", ")}\n`);

const cache = new Map();
const bodyOf = (p) => {
  if (!cache.has(p)) cache.set(p, read(join(ROOT, p)));
  return cache.get(p);
};

const pathClaims = claims.filter((c) => !/^\(.*\)$/.test(c.target));
console.log(`[RULE A] 清单里每条「符号 → 路径」，符号必须真的出现在该路径中 (${pathClaims.length} 条)`);
for (const c of pathClaims) {
  if (c.symbols.length === 0) {
    // 空符号列表 = 解析失败，会 vacuous pass —— 宁可误报也不放过
    fail(`→ ${c.target} : 解析出的符号列表为空，注释格式无法被机器解析 —— 核验无效`);
    continue;
  }
  let bad = false;
  for (const sym of c.symbols) {
    let n;
    try {
      n = countIn(bodyOf(c.target), sym);
    } catch {
      bad = true;
      fail(`${sym} → ${c.target} : 目标文件不存在`);
      continue;
    }
    if (n === 0) {
      bad = true;
      fail(`${sym} → ${c.target} : 该文件里找不到 \\b${sym}\\b  ← 覆盖度声明不实`);
    }
  }
  if (!bad) pass(`${c.symbols.join(" / ")} → ${c.target} : 全部在位`);
}

const ruleB = noneCovered.flatMap((n) => n.symbols);
console.log(`\n[RULE B] 标 (无测试覆盖) 的符号必须在所有测试文件里 0 引用 (${ruleB.length} 个)`);
for (const sym of ruleB) {
  const hits = testFiles
    .map((f) => ({ f: rel(f), n: countIn(read(f), sym) }))
    .filter((x) => x.n > 0);
  if (hits.length === 0) pass(`${sym} : 测试文件中 0 引用 —— 声明属实`);
  else fail(`${sym} : 实际被 ${hits.map((h) => `${h.f}(${h.n})`).join(", ")} 引用 —— 「无测试覆盖」不实`);
}

// ── RULE C：`num()` 收敛声明（D-4-a）─────────────────────────────────
// 注释声称「本文件 15 处 `num(` 调用、分布在 13 个代码行，全部落在 ② 组内」。
// 这条不是「符号→文件」型声明，正则抓不到，故单独校验：
//   C1 日期口径段（`── 日期口径` 分隔线之后）内 num( 调用数必须为 0
//   C2 全文件 num( 调用「处数」与「代码行数」两个数字都必须与注释一致
//      （排除注释行与 `function num(` 声明本身；同一行可有多处调用）
const srcBody = read(STATS);
const lines = srcBody.split("\n");
const headEnd = headLines.length;
const dateSectionStart = lines.findIndex((l, i) => i >= headEnd && l.includes("日期口径（Asia/Shanghai"));

const isDecl = (l) => /^\s*(export\s+)?function\s+num\s*\(/.test(l);
const codeLines = lines
  .map((l, i) => ({ n: i + 1, l }))
  .filter(({ n, l }) => n > headEnd && !/^\s*\/\//.test(l));
const numCallLines = codeLines.filter(({ l }) => !isDecl(l) && /\bnum\(/.test(l));
const numCallOccurrences = numCallLines.reduce(
  (a, { l }) => a + (l.match(/\bnum\(/g) || []).length,
  0,
);
const dateSectionNumCalls =
  dateSectionStart === -1 ? [] : numCallLines.filter(({ n }) => n > dateSectionStart + 1);

console.log(`\n[RULE C] \`num()\` 收敛声明 (D-4-a)`);
if (dateSectionStart === -1) {
  fail("未找到「日期口径（Asia/Shanghai）」分隔行，无法定位第 ① 组 —— 注释结构已变，需更新核验脚本");
} else if (dateSectionNumCalls.length === 0) {
  pass(`C1 日期口径段 (第 ${dateSectionStart + 1} 行起) 内 num( 调用数 = 0 —— 「第 ① 组不经过 num()」属实`);
} else {
  fail(
    `C1 日期口径段内有 num( 调用: 第 ${dateSectionNumCalls.map((x) => x.n).join(", ")} 行 —— 「第 ① 组不经过 num()」不实`,
  );
}

const headText = headLines.map((l) => l.replace(/^\/\/\s?/, "")).join("\n");
const claimedOcc = headText.match(/(\d+)\s*处\s*`num\(/);
const claimedLines = headText.match(/分布在\s*(\d+)\s*个代码行/);
if (!claimedOcc || !claimedLines) {
  fail("C2 注释里没有同时写明 `num(` 的「处数」与「代码行数」，无法核对");
} else {
  const co = Number(claimedOcc[1]);
  const cl = Number(claimedLines[1]);
  if (co === numCallOccurrences && cl === numCallLines.length) {
    pass(
      `C2 注释声称 ${co} 处 / ${cl} 个代码行，实测 ${numCallOccurrences} 处 / ${numCallLines.length} 行（行 ${numCallLines.map((x) => x.n).join(",")}）—— 属实`,
    );
  } else {
    fail(
      `C2 注释声称 ${co} 处 / ${cl} 个代码行，实测 ${numCallOccurrences} 处 / ${numCallLines.length} 行 —— 数字已过期`,
    );
  }
}

const total = pathClaims.length + ruleB.length + 2;
console.log(`\n[GUARD] 解析器抓到的断言总数: ${total - 2} + RULE C 2 条 = ${total}`);
if (pathClaims.length + ruleB.length === 0) fail("解析器未抓到任何覆盖度声明 —— 这次 PASS 是空跑，脚本无效");

console.log(`\n断言总数: ${total}  失败: ${failures}`);
console.log(failures === 0 ? "RESULT: PASS —— 注释里每一条覆盖度声明都经实测为真。" : "RESULT: FAIL");
process.exit(failures === 0 ? 0 : 1);
