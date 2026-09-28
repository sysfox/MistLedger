// WP-1 对比度校验脚本（WCAG 2.2 相对亮度公式）
// 用法：node .hermes/audits/contrast-check.mjs
// 断言：
//   1. --color-fogline-strong 对 --color-veil >= 3.0:1（SC 1.4.11，.input 边界）
//   2. --color-fogline-strong 对 --color-mist >= 3.0:1（SC 1.4.11，.chip 边界）
//   3. --color-fogline（面板/装饰边框）不得比修复前更亮（保持「雾」的层次）
//   4. prefers-contrast: more 覆盖下两个令牌均 >= 3.0:1
//   5. 焦点环 lamp@60% 对 night / mist >= 3.0:1
//   6. 文字层不得被本次改动带低（ink/dim on night >= 4.5:1）
// 退出码非 0 即失败。

/** sRGB 8-bit hex -> 线性 RGB 三元组 */
const linear = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
};

/** WCAG 2.x 相对亮度 */
const luminance = (hex) => {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.x 对比度 */
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** 半透明前景在实底上的合成结果（sRGB 空间 alpha 混合，与浏览器一致） */
const over = (fg, bg, alpha) => {
  const chan = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const mix = (i) =>
    Math.round(chan(fg, i) * alpha + chan(bg, i) * (1 - alpha))
      .toString(16)
      .padStart(2, "0");
  return `#${mix(0)}${mix(1)}${mix(2)}`;
};

/** DESIGN.md 第二节令牌（本次改动后的值） */
const T = {
  night: "#0a0e14",
  mist: "#111826",
  veil: "#1b2436",
  ink: "#e9e4d8",
  lamp: "#e3b341",
  dim: "#8b93a7",
  // 装饰/面板边框：保持原值，本次不改（「雾」的层次靠它维持）
  fogline: "#28324a",
  // 新增：交互控件边界（.input / .chip），对 veil 与 mist 均需 >= 3:1
  foglineStrong: "#5e6f8c",
};

/** prefers-contrast: more 覆盖值（globals.css 同步） */
const MORE = {
  fogline: "#46516e",
  foglineStrong: "#8b98b8",
};

const rows = [];
const check = (label, fg, bg, min, note = "") => {
  const r = ratio(fg, bg);
  rows.push({
    组合: label,
    前景: fg,
    背景: bg,
    比值: `${r.toFixed(2)}:1`,
    下限: `${min.toFixed(1)}:1`,
    判定: r >= min ? "PASS" : "FAIL",
    说明: note,
  });
  return r;
};

console.log("── 令牌表 ──");
console.table(T);
console.log("── prefers-contrast: more 覆盖 ──");
console.table(MORE);

// 1 / 2 —— 本次修复目标：交互控件边界
check("fogline-strong on veil（.input 边框）", T.foglineStrong, T.veil, 3.0, "SC 1.4.11");
check("fogline-strong on mist（.chip 边框）", T.foglineStrong, T.mist, 3.0, "SC 1.4.11");

// 3 —— 回归护栏：装饰边框不得被一起提亮
check(
  "fogline on mist（.panel 装饰边框）",
  T.fogline,
  T.mist,
  0,
  `保持修复前 ${ratio(T.fogline, T.mist).toFixed(2)}:1`,
);
check("fogline on veil（.panel 装饰边框）", T.fogline, T.veil, 0, "修复前 1.22:1，装饰性，不设下限");

// 4 —— 偏好覆盖
check("more: fogline-strong on veil", MORE.foglineStrong, T.veil, 3.0);
check("more: fogline-strong on mist", MORE.foglineStrong, T.mist, 3.0);
check("more: fogline on mist（装饰线）", MORE.fogline, T.mist, 1.4, "仅回归护栏");

// 5 —— 焦点环（灯色 60% 叠在底色上）
check("焦点环 lamp@60% on night", over(T.lamp, T.night, 0.6), T.night, 3.0);
check("焦点环 lamp@60% on mist", over(T.lamp, T.mist, 0.6), T.mist, 3.0);

// 6 —— 文字层回归护栏
check("ink on night（正文）", T.ink, T.night, 4.5);
check("dim on night（次要文字）", T.dim, T.night, 4.5);

console.log("\n── 对比度实测 ──");
console.table(rows);

const failed = rows.filter((r) => r.判定 === "FAIL");
console.log(`\n结论：${rows.length - failed.length}/${rows.length} 通过，${failed.length} 失败`);
if (failed.length) {
  for (const f of failed) console.error(`FAIL: ${f.组合} = ${f.比值} < ${f.下限}`);
  process.exit(1);
}
