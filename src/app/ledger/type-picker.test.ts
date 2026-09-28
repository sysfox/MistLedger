
import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { createRequire } from "node:module";

import type { ComponentType, ReactElement } from "react";
import type { TypeOption } from "./type-picker";

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

const TX: TypeOption[] = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "转账" },
];

const mountedHandles: Array<{ unmount(): void }> = [];

let Picker!: ComponentType<{ value: string; onChange: (next: string) => void; label?: string }>;

function renderComponent(element: ReactElement) {
  const mounted = harness.mount(element);
  mountedHandles.push(mounted);
  return mounted;
}

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

function tabbables(scope: ParentNode): HTMLElement[] {
  return radios(scope).filter((r) => r.getAttribute("tabindex") === "0");
}

function selected(scope: ParentNode): HTMLElement {
  const found = radios(scope).find((r) => r.getAttribute("aria-checked") === "true");
  assert.ok(found, "任何时刻都必须恰好有一个 aria-checked=true");
  return found;
}

describe("TypePicker · APG radiogroup 键盘契约", () => {
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

  describe("方向键移动并选中", () => {
    const NAV: Array<[string, number, string]> = [
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

  describe("Space / Enter 选中", () => {
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
