/*
 * [D-18] `TypePicker` 的 APG radiogroup 键盘契约 —— 真实挂载 + 真实 KeyboardEvent。
 *
 * ## 为什么这个文件存在
 *
 * 改造前的实现只在 `<Box role="radiogroup">` 里放三个 `role="radio"` 的 Chip，
 * **宣告了 radiogroup 语义却没有履行它**：三个 chip 各自 `tabIndex=0`（键盘用户要
 * Tab 三次才走得完这个组），且没有任何 `onKeyDown`（←/→/↑/↓/Home/End 全部无响应）。
 * 违反 WCAG 2.2 SC 2.1.1 与 WAI-ARIA APG § radiogroup。
 *
 * 上一轮审核在 jsdom 探针里实测通过了 23 条断言，但**那些断言只活在
 * `%TMPDIR%/wp4-probe/dom-probe.cjs` 这个临时探针里，没有落进仓库** ——
 * 于是「通过了」这件事无法被 `npm test` 复现，探针一被清理证据就没了。
 * 本文件把那 14 条（探针里的 B 组 14 条，编号沿用 B0.x/B1/B2.x/B3/B4）补成
 * 仓库内的常驻回归。
 *
 * **断言没有做弱**：每一条都是「具体值 === 具体值」，不是 `ok()`、不是
 * `assert.ok(sel)`、不是「存在某个 tabindex=0」。B1 更是 12 次按键逐次比对
 * 选中项与 `document.activeElement` 两个独立维度，漏一次即红。
 *
 * 焦点环可见性（`:focus-visible`）**无法**在这里验证：jsdom 不实现该伪类，
 * `getComputedStyle` 也无法回答 `:focus-visible` 是否命中。这一条按 CSS 规范与
 * Chrome 行为推断为真，但**不计为已验证**（见 DESIGN.md §十一 #9）。
 */

import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { createRequire } from "node:module";

import type { ComponentType, ReactElement } from "react";
import type { TypeOption } from "./type-picker";

// 挂载环境必须先于组件 import 生效 —— 理由同 confirm-submit-button.test.ts：
// 静态 import 会在本文件任何一行执行前完成求值，那时 global 上还没有 document。
// harness 在 src/components/ 下，本测试在 src/app/ledger/ 下 —— 用仓库相对路径跨目录取。
const require = createRequire(import.meta.url);
const harness = require("../../components/test-dom-harness.cjs") as Harness;

interface Harness {
  React: typeof import("react");
  act: (cb: () => void) => void;
  loadModule(rel: string): Record<string, unknown>;
  mount(el: ReactElement): Mounted;
  click(el: Element): void;
  keyDown(el: Element, init: Record<string, unknown>): void;
  keyUp(el: Element, init: Record<string, unknown>): void;
  restore(): void;
}

interface Mounted {
  host: HTMLElement;
  doc: Document;
  render(el: ReactElement): void;
  unmount(): void;
}

/**
 * 顺序即键盘左右顺序，与组件的 `TX_TYPES` 同源。
 * 这里独立写一份而不是 import 组件的常量：断言必须能在**常量被改坏**时失败，
 * 若断言复用被测常量，两者一起漂移就再也测不出东西。
 */
const TX: TypeOption[] = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "转账" },
];

/** 本文件挂过的所有 root，由 afterEach 统一收走（失败断言会跳过用例末尾的清理） */
const mountedHandles: Array<{ unmount(): void }> = [];

/**
 * 组件在 `before()` 里经 harness 的加载管线载入。
 *
 * 声明必须排在 `mountPicker` **之前** —— 它是 `let`（有 TDZ），而 `mountPicker`
 * 在模块求值时就会以它作为参数构造元素。原先声明在 describe 回调里，运行时
 * 直接 `ReferenceError: Picker is not defined`。
 */
let Picker!: ComponentType<{ value: string; onChange: (next: string) => void; label?: string }>;

function renderComponent(element: ReactElement) {
  const mounted = harness.mount(element);
  mountedHandles.push(mounted);
  return mounted;
}

/**
 * 挂一个受控的 TypePicker。
 *
 * `onChange` 写回局部 `value` 并立即重渲染 —— 这是**受控组件**的正确模拟：
 * 若组件不遵守受控契约，选中态会停在旧值，B1/B2 的断言就会红。
 */
function mountPicker(initial: string) {
  let value = initial;
  const rerender = (next: string) => {
    value = next;
    mounted.render(
      harness.React.createElement(Picker, { value, onChange: rerender }),
    );
  };
  const mounted = renderComponent(
    harness.React.createElement(Picker, { value, onChange: rerender }),
  );
  return { ...mounted, get value() { return value; } };
}

function radios(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll('[role="radio"]'));
}

/** tab 序列里的项：APG radiogroup 要求组内恒为 0 或 1 个（此处恒为 1） */
function tabbables(scope: ParentNode): HTMLElement[] {
  return radios(scope).filter((r) => r.getAttribute("tabindex") === "0");
}

function selected(scope: ParentNode): HTMLElement {
  const found = radios(scope).find((r) => r.getAttribute("aria-checked") === "true");
  assert.ok(found, "任何时刻都必须恰好有一个 aria-checked=true");
  return found;
}

describe("[D-18] TypePicker · APG radiogroup 键盘契约", () => {
  before(() => {
    Picker = harness.loadModule("src/app/ledger/type-picker.tsx")
      .default as ComponentType<{ value: string; onChange: (next: string) => void }>;
  });

  afterEach(() => {
    while (mountedHandles.length > 0) {
      mountedHandles.pop()!.unmount();
    }
  });

  after(() => {
    harness.restore();
  });

  /* ---------------------------------------------------------------- *
   * 初始 DOM：roving tabindex 与可访问名
   * ---------------------------------------------------------------- */

  describe("初始 DOM", () => {
    it("B0.1 radiogroup 有可访问名", () => {
      const p = mountPicker("expense");
      const group = p.host.querySelector('[role="radiogroup"]')!;
      assert.ok(group, "必须存在 role=radiogroup");
      const label = group.getAttribute("aria-label");
      assert.equal(label, "收支类型", "radiogroup 必须有可访问名（aria-label）");
    });

    it("B0.2 恰好 1 个 tabindex=0（roving tabindex）", () => {
      const p = mountPicker("expense");
      const rs = radios(p.host);
      assert.equal(rs.length, 3, "词汇表应有 3 项");
      assert.equal(
        tabbables(p.host).length,
        1,
        "组内只能有 1 项在 tab 序列里，否则键盘用户要 Tab 三次才走得完",
      );
      // 不能是「随便哪个」：必须在选中项上。
      assert.equal(tabbables(p.host)[0], selected(p.host), "tabindex=0 的必须是选中项");
    });

    it("B0.3 恰好 1 个 aria-checked=true", () => {
      const p = mountPicker("expense");
      assert.equal(
        radios(p.host).filter((r) => r.getAttribute("aria-checked") === "true").length,
        1,
      );
      assert.equal(selected(p.host).textContent, "支出", "初始选中项应与 value 一致");
    });

    it("B0.4 三个 radio 都显式带 tabindex 属性", () => {
      const p = mountPicker("expense");
      for (const r of radios(p.host)) {
        assert.notEqual(
          r.getAttribute("tabindex"),
          null,
          `${r.textContent} 缺 tabindex —— 未选中项必须是 -1，不能靠缺省`,
        );
      }
      const values = radios(p.host).map((r) => r.getAttribute("tabindex"));
      assert.deepEqual(values, ["0", "-1", "-1"], "roving：只有选中项为 0");
    });
  });

  /* ---------------------------------------------------------------- *
   * 方向键：APG § radiogroup Keyboard Interaction
   * ---------------------------------------------------------------- */

  describe("方向键移动并选中", () => {
    /**
     * B1 —— 12 次连续按键，**逐次**比对「选中项」与「document.activeElement」
     * 两个独立维度。
     *
     * 之所以拆成 12 条 `it` 而不是探针里的一整轮循环：一旦某一次移动算错，
     * 报错会直接指认是第几次、哪个键、从哪到哪，而不是只给一句「整体不符」。
     * 断言强度与探针相同（B1 本就是一个覆盖 12 次移动的单条断言），拆细只增加
     * 可诊断性，不放松任何一条判据。
     */
    const NAV: Array<[string, number, string]> = [
      // [键, 起始项下标, 按键后应落到的项文案]
      ["ArrowRight", 0, "收入"],
      ["ArrowRight", 1, "转账"],
      ["ArrowRight", 2, "支出"], // 末项 → 回环到首项
      ["ArrowLeft", 0, "转账"], // 首项 → 回环到末项
      ["ArrowLeft", 2, "收入"],
      ["ArrowLeft", 1, "支出"],
      ["ArrowDown", 0, "收入"],
      ["ArrowDown", 1, "转账"],
      ["ArrowDown", 2, "支出"],
      ["ArrowUp", 0, "转账"],
      ["ArrowUp", 2, "收入"],
      ["ArrowUp", 1, "支出"],
    ];

    for (const [key, from, wantLabel] of NAV) {
      it(`B1 ${key} 从「${TX[from].label}」移到「${wantLabel}」（选中与焦点同步）`, () => {
        const p = mountPicker(TX[from].value);
        const fromEl = radios(p.host)[from];
        assert.equal(
          fromEl.getAttribute("aria-checked"),
          "true",
          "前置条件：起始项就是选中项",
        );

        harness.keyDown(fromEl, { key, code: key });

        assert.equal(
          selected(p.host).textContent,
          wantLabel,
          `${key} 后选中项应是「${wantLabel}」（APG 单选 radiogroup：移动即选中）`,
        );
        assert.equal(
          selected(p.host).getAttribute("aria-checked"),
          "true",
          "必须恰好一个 aria-checked=true",
        );
        const active = p.doc.activeElement as HTMLElement | null;
        assert.ok(active, "焦点不得落空");
        assert.equal(
          active.textContent,
          wantLabel,
          `${key} 后焦点必须跟着选中项移动（roving tabindex 的「roving」部分）`,
        );
        assert.equal(
          active.getAttribute("tabindex"),
          "0",
          "焦点所在项必须回到 tab 序列",
        );
        assert.equal(
          tabbables(p.host).length,
          1,
          "移动后 tab 序列里仍必须只有 1 项",
        );
      });
    }

    it("B2.1 Home 跳到首项并选中", () => {
      const p = mountPicker("income");
      harness.keyDown(radios(p.host)[1], { key: "Home", code: "Home" });
      assert.equal(selected(p.host).textContent, "支出");
      assert.equal((p.doc.activeElement as HTMLElement).textContent, "支出");
    });

    it("B2.2 End 跳到末项并选中", () => {
      const p = mountPicker("income");
      harness.keyDown(radios(p.host)[1], { key: "End", code: "End" });
      assert.equal(selected(p.host).textContent, "转账");
      assert.equal((p.doc.activeElement as HTMLElement).textContent, "转账");
    });

    it("B2.3 方向键被 preventDefault（不滚页面）", () => {
      const p = mountPicker("expense");
      for (const key of ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"]) {
        const ev = new p.doc.defaultView!.KeyboardEvent("keydown", {
          key,
          bubbles: true,
          cancelable: true,
        });
        radios(p.host)[0].dispatchEvent(ev);
        assert.equal(
          ev.defaultPrevented,
          true,
          `${key} 未被 preventDefault，按键会同时滚动页面（APG 要求拦截）`,
        );
      }
    });
  });

  /* ---------------------------------------------------------------- *
   * Space / Enter 选中
   * ---------------------------------------------------------------- */

  describe("Space / Enter 选中", () => {
    // Chip 的根元素是 ButtonBase 渲染的原生 <button>，激活由 ButtonBase 的
    // 键盘处理（useButtonBase.js:144-156）完成，不是浏览器默认行为 ——
    // jsdom 既不做默认激活，**也不会**因为派发按键就把元素聚焦。
    // 所以先显式 .focus()（真实用户是先 Tab / 方向键到这一项的），
    // 再派发按键与抬起。少了这步 focus()，activeElement 会停在别处，
    // 断言就变成在测「jsdom 有没有自动聚焦」而不是「按 Space 会不会选中」。
    for (const [key, code] of [[" ", "Space"], ["Enter", "Enter"]] as const) {
      it(`B3 ${code} 选中当前聚焦项`, () => {
        const p = mountPicker("expense");
        const target = radios(p.host)[2];
        target.focus();
        assert.equal(
          (p.doc.activeElement as HTMLElement).textContent,
          "转账",
          "前置条件：焦点已在目标项上",
        );

        harness.keyUp(target, { key, code });
        harness.keyDown(target, { key, code });

        assert.equal(
          selected(p.host).textContent,
          "转账",
          `${code} 必须选中聚焦的那一项`,
        );
        assert.equal(
          (p.doc.activeElement as HTMLElement).textContent,
          "转账",
          `${code} 不应把焦点移走`,
        );
        assert.equal(
          tabbables(p.host)[0],
          selected(p.host),
          `${code} 选中后 roving tabindex 应移到新选中项`,
        );
      });
    }
  });

  /* ---------------------------------------------------------------- *
   * 点击与自定义可访问名
   * ---------------------------------------------------------------- */

  describe("指针与可访问名", () => {
    it("B5 点击任一项即选中该项并移入 tab 序列", () => {
      const p = mountPicker("expense");
      harness.click(radios(p.host)[2]);
      assert.equal(selected(p.host).textContent, "转账");
      assert.equal(tabbables(p.host)[0], selected(p.host));
    });

    it("B6 label prop 可配置，且落到 aria-label 上", () => {
      const mounted = harness.mount(
        harness.React.createElement(Picker, {
          value: "expense",
          onChange: () => {},
          label: "流水类型",
        }),
      );
      mountedHandles.push(mounted);
      const group = mounted.host.querySelector('[role="radiogroup"]')!;
      assert.equal(group.getAttribute("aria-label"), "流水类型");
    });
  });
});
