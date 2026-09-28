/**
 * [D-08] 金额书写铁律（DESIGN.md 第三节）的回归测试。
 *
 * 铁律原文：支出前缀 `−`（U+2212）、收入前缀 `+`、转账前缀 `⇄`，`¥` 紧跟其后。
 * 关键点是**符号在前、¥ 在后**：负数写 `−¥12.50`，不写 `¥-12.50`。
 *
 * 为什么是 src 下的 .test.ts 而不是 .hermes/audits 里的 format-check.mjs：
 * 旧脚本把 format.ts 的实现**原样抄了一份**在文件头部再断言那份抄本，
 * 于是「format.ts 改了、脚本没同步」时脚本照样全绿 —— 验证的是抄本与抄本一致，
 * 而不是被测实现。真正能防回归的形式是直接 import 真实实现。
 * 迁移后 .hermes/audits/format-check.mjs 保留为薄壳，转发到本文件。
 *
 * 运行：npm test（Node 内置 node:test，见 package.json）
 * 无新增依赖 —— [D-25] 的立意就是让套件在 CI 里可跑。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AMOUNT_PREFIX,
  MINUS,
  YUAN,
  amountSign,
  formatMoney,
  formatSignedMoney,
} from "./format.js";

const Y = YUAN;
const ARROW = "⇄";

describe("[D-08] formatMoney —— 符号下沉后的纯数字", () => {
  it("正数无符号、千分位、两位小数", () => {
    assert.equal(formatMoney(12.5), "12.50");
    assert.equal(formatMoney(1234.56), "1,234.56");
    assert.equal(formatMoney(0), "0.00");
  });

  it("负数的负号是 U+2212，不是 ASCII hyphen-minus", () => {
    const out = formatMoney(-12.5);
    assert.equal(out[0].codePointAt(0), 0x2212);
    // 显式排除 ASCII：toLocaleString("zh-CN") 原本产出的是 U+002D
    assert.notEqual(out[0], "-");
    assert.equal(out, `${MINUS}12.50`);
  });

  it("负号只有一处 —— 符号内部不重复（无双符号）", () => {
    assert.equal(formatMoney(-12.5).split(MINUS).length - 1, 1);
  });
});

describe("[D-08] formatSignedMoney —— 符号在前、¥ 紧跟其后", () => {
  it("负数输出 `−¥`，符号在 ¥ 之前", () => {
    assert.equal(formatSignedMoney(-12.5), `${MINUS}${Y}12.50`);
    assert.equal(formatSignedMoney(-1234), `${MINUS}${Y}1,234.00`);
    // 位置断言：索引 0 是减号，索引 1 才是 ¥
    const out = formatSignedMoney(-12.5);
    assert.equal(out.codePointAt(0), 0x2212);
    assert.equal(out[1], Y);
  });

  it("neutral（余额 / 总资产）正数不带任何类型前缀", () => {
    assert.equal(formatSignedMoney(1234.56), `${Y}1,234.56`);
    assert.equal(formatSignedMoney(0), `${Y}0.00`);
  });

  it("三类语义前缀与 DESIGN.md 第三节一致", () => {
    assert.equal(formatSignedMoney(12.5, "expense"), `${MINUS}${Y}12.50`);
    assert.equal(formatSignedMoney(12.5, "income"), `+${Y}12.50`);
    assert.equal(formatSignedMoney(12.5, "transfer"), `${ARROW}${Y}12.50`);
  });

  it("负数吞掉 kind 的前缀 —— 不出 `−−¥`（[D-08] 明确要求的组合）", () => {
    // expense 的前缀本身就是 −，负数若不吞掉就会叠成 −−¥12.50
    assert.equal(formatSignedMoney(-12.5, "expense"), `${MINUS}${Y}12.50`);
    assert.equal(formatSignedMoney(-12.5, "income"), `${MINUS}${Y}12.50`);
    assert.equal(formatSignedMoney(-12.5, "transfer"), `${MINUS}${Y}12.50`);
    for (const kind of ["expense", "income", "transfer", "neutral"] as const) {
      const out = formatSignedMoney(-12.5, kind);
      assert.equal(out.split(MINUS).length - 1, 1, `${kind} 出现双减号: ${out}`);
    }
  });

  it("金额内部不出现 ASCII hyphen-minus（千分位/小数点不受影响）", () => {
    for (const n of [-1234.56, -1234567.89, 1234567.89]) {
      assert.ok(!formatSignedMoney(n).includes("-"), `${n} 渲染出 ASCII 负号`);
    }
  });

  it("四舍五入到 0.00 的极小负数仍保留符号（不吞掉方向）", () => {
    assert.equal(formatSignedMoney(-0.004), `${MINUS}${Y}0.00`);
  });
});

describe("[D-08] 迁移前后的行为一致性", () => {
  it("旧调用点 `{PREFIX}¥{formatMoney(正数)}` 与新 API 输出逐字相同", () => {
    for (const type of ["expense", "income", "transfer"] as const) {
      const legacy = `${AMOUNT_PREFIX[type]}${Y}${formatMoney(12.5)}`;
      assert.equal(formatSignedMoney(12.5, type), legacy, `${type} 迁移后行为漂移`);
      assert.equal(legacy.includes(`${MINUS}${MINUS}`), false);
    }
  });

  it("自带前缀的旧调用点传入负数也不出双符号（prefix + |formatMoney| 的组合）", () => {
    // 若某调用点把负数金额喂给「自带前缀」写法，正确降级是取绝对值：
    // formatMoney(Math.abs(n)) 恒不带符号，故整串至多一个减号（expense 的那个）。
    for (const type of ["expense", "income", "transfer"] as const) {
      const defensive = `${AMOUNT_PREFIX[type]}${Y}${formatMoney(Math.abs(-12.5))}`;
      assert.equal(defensive, `${AMOUNT_PREFIX[type]}${Y}12.50`);
      assert.ok(defensive.split(MINUS).length - 1 <= 1, `${type} 出现双减号: ${defensive}`);
    }
    // 对照：漏掉 Math.abs 时，前缀的 − 与 formatMoney 的 − 会同时出现（虽不邻接，
    // 仍是一个字符串里两个减号）—— 正确形态是下面的 formatSignedMoney 那样只留一个。
    const buggy = `${AMOUNT_PREFIX.expense}${Y}${formatMoney(-12.5)}`;
    assert.equal(buggy, `${MINUS}${Y}${MINUS}12.50`);
    assert.equal(buggy.split(MINUS).length - 1, 2, "对照组应确实含两个减号");
    assert.equal(formatSignedMoney(-12.5, "expense").split(MINUS).length - 1, 1);
  });
});

describe("amountSign —— 只取符号（供 ¥ 单独染灯色的 hero 场景）", () => {
  it("与 formatSignedMoney 的符号判定完全一致", () => {
    const cases: [number, "expense" | "income" | "transfer" | "neutral"][] = [
      [-12.5, "neutral"],
      [-12.5, "expense"],
      [12.5, "neutral"],
      [12.5, "expense"],
      [12.5, "income"],
      [12.5, "transfer"],
      [0, "neutral"],
    ];
    for (const [n, kind] of cases) {
      const sign = amountSign(n, kind);
      // 拼回去应与 formatSignedMoney 的前导符号段一致
      assert.ok(
        formatSignedMoney(n, kind).startsWith(`${sign}${Y}`),
        `amountSign(${n}, ${kind}) 与 formatSignedMoney 不一致`,
      );
      assert.ok(!sign.includes(Y), "amountSign 不应包含 ¥");
    }
  });

  it("负数一律返回 U+2212", () => {
    assert.equal(amountSign(-1), MINUS);
    assert.equal(amountSign(-1).codePointAt(0), 0x2212);
  });
});
