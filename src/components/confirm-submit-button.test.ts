
import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { createRequire } from "node:module";

import type { ComponentType, ReactElement } from "react";
import type { ConfirmSubmitButtonProps } from "./confirm-submit-button";

const require = createRequire(import.meta.url);
const harness = require("./test-dom-harness.cjs") as Harness;

interface Harness {
  React: typeof import("react");
  act: (cb: () => void) => void;
  loadModule(rel: string): Record<string, unknown>;
  mount(el: ReactElement): Mounted;
  click(el: Element): void;
  mouseDown(el: Element): void;
  keyDown(el: Element, init: Record<string, unknown>): void;
  submit(form: HTMLFormElement, submitter?: Element | null): Event;
  flush(ms?: number): Promise<void>;
  dialog(doc?: Document): HTMLElement | null;
  dialogOpen(doc?: Document): boolean;
  confirmButton(doc?: Document): HTMLButtonElement | null;
  triggerButton(scope: ParentNode): HTMLButtonElement | null;
  stub(request: string, exports: unknown): void;
  restore(): void;
}

interface Mounted {
  host: HTMLElement;
  doc: Document;
  render(el: ReactElement): void;
  unmount(): void;
}

type Call = Array<[string, FormDataEntryValue]>;

function makeCallSite() {
  const calls: Call[] = [];
  return {
    calls,
    action: (formData: FormData) => {
      calls.push([...formData.entries()]);
    },
  };
}

const mountedHandles: Array<{ cleanup(): void }> = [];

function renderComponent(element: ReactElement) {
  const mounted = harness.mount(element);
  const handle = {
    ...mounted,
    cleanup: () => mounted.unmount(),
  };
  mountedHandles.push(handle);
  return handle;
}

describe("ConfirmSubmitButton · 二次确认与真实提交", () => {
  let ConfirmSubmitButton: ComponentType<ConfirmSubmitButtonProps>;

  before(() => {
    const mod = harness.loadModule("src/components/confirm-submit-button.tsx");
    ConfirmSubmitButton = mod.default as ComponentType<ConfirmSubmitButtonProps>;
  });

  afterEach(() => {
    while (mountedHandles.length > 0) {
      mountedHandles.pop()!.cleanup();
    }
  });

  after(() => {
    harness.restore();
  });

  describe("A 组 · 能完成操作（P0 的正面证据）", () => {
    it("A1 确认按钮是 type=submit 且显式关联到表单 —— 缺任一条都不会提交", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "删除这笔流水？",
          confirmLabel: "确认删除",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-1" }),
        }),
      );

      harness.click(harness.triggerButton(ctx.host)!);
      const form = ctx.host.querySelector("form")!;
      const confirm = harness.confirmButton(ctx.doc)!;

// form 只关联不提交，缺 type=submit 就是死按钮。
      assert.equal(
        confirm.getAttribute("type"),
        "submit",
        "确认按钮必须显式 type=submit；缺省时 MUI 补成 button，点击不会提交",
      );
      assert.equal(
        confirm.getAttribute("form"),
        form.getAttribute("id"),
        "确认按钮经 Portal 渲染，必须用 form 属性显式关联回表单",
      );

      harness.click(confirm);
      await harness.flush();
      ctx.cleanup();
    });

    it("A2 点「删除」→ 弹框 → 点「确认删除」→ action 被调用恰好 1 次", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "删除这笔流水？",
          confirmBody: "删除后不可恢复。",
          confirmLabel: "确认删除",
          confirmColor: "error",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-1" }),
        }),
      );

      harness.click(harness.triggerButton(ctx.host)!);
      assert.equal(harness.dialogOpen(ctx.doc), true, "点触发按钮应弹出确认框");

      harness.click(harness.confirmButton(ctx.doc)!);
      await harness.flush();

      assert.equal(site.calls.length, 1, `action 应被调用 1 次，实为 ${site.calls.length}`);
      assert.deepEqual(
        [...site.calls[0]],
        [["id", "TX-1"]],
        "action 收到的 FormData 应含表单里的隐藏字段",
      );

      assert.equal(harness.dialogOpen(ctx.doc), false, "确认后对话框应收起");
      ctx.cleanup();
    });

    it("A3 提交过程中确认框收起，但 pending 期间两个按钮都禁用", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "保存",
          pendingLabel: "保存中…",
          pending: true,
          confirmTitle: "确认保存？",
          confirmLabel: "确认修改",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-2" }),
        }),
      );

      assert.equal(harness.triggerButton(ctx.host)!.disabled, true, "pending 时触发按钮应禁用");

      harness.click(harness.triggerButton(ctx.host)!);
      assert.equal(harness.dialogOpen(ctx.doc), false, "pending 时不应弹出确认框");
      ctx.cleanup();
    });

    it("A4 pending 为真时，确认框里的「确认」与「取消」也都是 disabled", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "删除这笔流水？",
          confirmLabel: "确认删除",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-3" }),
        }),
      );

      harness.click(harness.triggerButton(ctx.host)!);
      assert.equal(harness.dialogOpen(ctx.doc), true);

      ctx.render(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          pending: true,
          confirmTitle: "删除这笔流水？",
          confirmLabel: "确认删除",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-3" }),
        }),
      );

      const buttons = Array.from(
        harness.dialog(ctx.doc)!.querySelectorAll("button"),
      ) as HTMLButtonElement[];
      assert.equal(buttons.length, 2, "确认框里应有「取消」「确认」两个按钮");
      for (const button of buttons) {
        assert.equal(
          button.disabled,
          true,
          `pending 时「${button.textContent}」应禁用，否则可重复提交`,
        );
      }
      assert.equal(site.calls.length, 0, "pending 期间不应发生提交");
      ctx.cleanup();
    });

    it("A5 「确认修改」路径同样能提交（记账页的保存修改调用点）", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "保存",
          pendingLabel: "保存中…",
          confirmTitle: "确认保存这笔流水的修改？",
          confirmBody: "修改后相关账户余额会同步更新。",
          confirmLabel: "确认修改",
          formClassName: "flex flex-col gap-2",
          children: [
            harness.React.createElement("input", { key: "id", name: "id", defaultValue: "TX-4" }),
            harness.React.createElement("input", {
              key: "amount",
              name: "amount",
              type: "number",
              defaultValue: "42",
            }),
          ],
        }),
      );

      harness.click(harness.triggerButton(ctx.host)!);
      harness.click(harness.confirmButton(ctx.doc)!);
      await harness.flush();

      assert.equal(site.calls.length, 1, `action 应被调用 1 次，实为 ${site.calls.length}`);
      assert.deepEqual([...site.calls[0]], [["id", "TX-4"], ["amount", "42"]]);
      ctx.cleanup();
    });
  });

  describe("B 组 · 绕过确认的尝试全部被拦下", () => {
    function fresh(id: string) {
      const site = makeCallSite();
      const state = { validateCalls: 0 };
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "删除这笔流水？",
          confirmLabel: "确认删除",
          validate: () => {
            state.validateCalls += 1;
            return true;
          },
          children: harness.React.createElement("input", { name: "id", defaultValue: id }),
        }),
      );
      return { site, state, ...ctx, form: ctx.host.querySelector("form")! };
    }

    it("B1 鼠标点触发按钮：弹框但不提交", async () => {
      const t = fresh("TX-B1");
      harness.click(harness.triggerButton(t.host)!);
      assert.equal(harness.dialogOpen(t.doc), true, "应弹出确认框");
      assert.equal(t.site.calls.length, 0, "确认之前不得调用 action");
      await harness.flush();
      t.cleanup();
    });

    it("B2 回车隐式提交（submitter=null）：被拦下并弹框", async () => {
      const t = fresh("TX-B2");
// 规范：表单内无 submit 按钮时回车由表单自身提交，submitter 为 null。
      harness.submit(t.form, null);
      assert.equal(t.state.validateCalls, 1, "无标记的提交必须走 requestConfirm（被拦下）");
      assert.equal(harness.dialogOpen(t.doc), true, "被拦下后应弹确认框");
      assert.equal(t.site.calls.length, 0);
      await harness.flush();
      t.cleanup();
    });

    it("B3 form.requestSubmit() 无参（submitter=null）：同样被拦下", async () => {
      const t = fresh("TX-B3");
      harness.submit(t.form, null);
      assert.equal(t.state.validateCalls, 1, "requestSubmit() 无参必须被拦下");
      assert.equal(harness.dialogOpen(t.doc), true);
      assert.equal(t.site.calls.length, 0);
      await harness.flush();
      t.cleanup();
    });

    it("B4 程序化派发不带 data-confirm-submit 标记的 submitter：被拦下", async () => {
      const t = fresh("TX-B4");
      const impostor = t.doc.createElement("button");
      impostor.type = "submit";
      impostor.setAttribute("form", t.form.getAttribute("id")!);
      impostor.textContent = "确认删除";
      t.doc.body.appendChild(impostor);

      harness.submit(t.form, impostor);
      assert.equal(t.state.validateCalls, 1, "标记不对的 submitter 必须被拦下");
      assert.equal(harness.dialogOpen(t.doc), true);
      assert.equal(t.site.calls.length, 0);

      impostor.remove();
      await harness.flush();
      t.cleanup();
    });

    it("B5 反向对照：带标记的真实确认按钮是唯一能放行的 submitter", async () => {
      const t = fresh("TX-B5");
      harness.click(harness.triggerButton(t.host)!);
      const confirm = harness.confirmButton(t.doc)!;
      const baseline = t.state.validateCalls;
      assert.equal(baseline, 1, "点触发按钮应恰好走一次 requestConfirm");

      harness.submit(t.form, confirm);
      assert.equal(t.state.validateCalls, baseline, "真实确认按钮发起的提交不得被二次拦下");
      assert.equal(t.site.calls.length, 1, "放行后 action 恰好被调用 1 次");
      await harness.flush();
      t.cleanup();
    });
  });

  describe("C 组 · 触发按钮 type=button 是有意的", () => {
    it("C1 触发按钮是 type=button，点击只走 onClick 开框", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "t",
          confirmLabel: "c",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-C1" }),
        }),
      );

      const trigger = harness.triggerButton(ctx.host)!;
      assert.equal(trigger.getAttribute("type"), "button");

      harness.click(trigger);
      assert.equal(harness.dialogOpen(ctx.doc), true, "点触发按钮应弹框");
      assert.equal(site.calls.length, 0, "点触发按钮绝不能提交");
      await harness.flush();
      ctx.cleanup();
    });

    it("C2 触发按钮在表单内，但不是表单的 submit 入口", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "t",
          confirmLabel: "c",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-C2" }),
        }),
      );

      const trigger = harness.triggerButton(ctx.host)!;
      assert.equal(trigger.form, ctx.host.querySelector("form"), "触发按钮应在该表单内");
      const inForm = Array.from(
        ctx.host.querySelectorAll("form button"),
      ) as HTMLButtonElement[];
      assert.equal(
        inForm.filter((b) => b.type === "submit").length,
        0,
        "表单内不应有 submit 按钮：唯一入口是确认按钮，避免 Enter 绕过弹框",
      );
      ctx.cleanup();
    });

    it("C3 表单不合法时不弹确认框（reportValidity 先于弹框）", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "t",
          confirmLabel: "c",
          children: harness.React.createElement("input", { name: "id", required: true }),
        }),
      );

      harness.click(harness.triggerButton(ctx.host)!);
      assert.equal(
        harness.dialogOpen(ctx.doc),
        false,
        "原生校验不通过时不应弹出一个「可以确认」的对话框",
      );
      assert.equal(site.calls.length, 0);
      await harness.flush();
      ctx.cleanup();
    });

    it("C4 validate() 返回 false 时既不弹框也不提交", async () => {
      const site = makeCallSite();
      let validateCalls = 0;
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "调整",
          confirmTitle: "t",
          confirmLabel: "确认调整",
          validate: () => {
            validateCalls += 1;
            return false;
          },
          children: harness.React.createElement("input", { name: "amount", defaultValue: "-1" }),
        }),
      );

      harness.click(harness.triggerButton(ctx.host)!);
      assert.equal(validateCalls, 1, "validate 只应被调用一次");
      assert.equal(harness.dialogOpen(ctx.doc), false);
      assert.equal(site.calls.length, 0);
      await harness.flush();
      ctx.cleanup();
    });
  });

  describe("D 组 · Esc / 遮罩关闭与 aria", () => {
    it("D1 Esc 关闭确认框", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "删除这笔流水？",
          confirmLabel: "确认删除",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-D1" }),
        }),
      );

      harness.click(harness.triggerButton(ctx.host)!);
      assert.equal(harness.dialogOpen(ctx.doc), true);

      const inner = harness.dialog(ctx.doc)!.querySelector('[role="dialog"]')!;
      harness.keyDown(inner, { key: "Escape", code: "Escape" });
      await harness.flush();

      assert.equal(harness.dialogOpen(ctx.doc), false, "Esc 应关闭确认框");
      assert.equal(site.calls.length, 0, "Esc 关闭不等于提交");
      ctx.cleanup();
    });

    it("D2 点遮罩关闭确认框", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "删除这笔流水？",
          confirmLabel: "确认删除",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-D2" }),
        }),
      );

      harness.click(harness.triggerButton(ctx.host)!);
      assert.equal(harness.dialogOpen(ctx.doc), true);

      const container = harness.dialog(ctx.doc)!.querySelector(".MuiDialog-container")!;
      harness.mouseDown(container);
      harness.click(harness.dialog(ctx.doc)!);
      await harness.flush();

      assert.equal(harness.dialogOpen(ctx.doc), false, "点遮罩应关闭确认框");
      assert.equal(site.calls.length, 0);
      ctx.cleanup();
    });

    it("D3 点对话框内容不关闭（避免误触丢失已填内容）", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "删除这笔流水？",
          confirmLabel: "确认删除",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-D3" }),
        }),
      );

      harness.click(harness.triggerButton(ctx.host)!);
      const paper = harness.dialog(ctx.doc)!.querySelector(".MuiPaper-root")!;
      harness.mouseDown(paper);
      harness.click(paper);
      await harness.flush();

      assert.equal(harness.dialogOpen(ctx.doc), true, "点在内容上不应关闭");
      ctx.cleanup();
    });

    it("D4 aria-modal / role / 标题关联都正确", async () => {
      const site = makeCallSite();
      const ctx = renderComponent(
        harness.React.createElement(ConfirmSubmitButton, {
          action: site.action,
          label: "删除",
          confirmTitle: "删除这笔流水？",
          confirmBody: "删除后不可恢复。",
          confirmLabel: "确认删除",
          children: harness.React.createElement("input", { name: "id", defaultValue: "TX-D4" }),
        }),
      );

      harness.click(harness.triggerButton(ctx.host)!);
      const root = harness.dialog(ctx.doc)!;
      const surface = root.querySelector('[role="dialog"]')!;

      assert.equal(surface.getAttribute("aria-modal"), "true", "模态必须宣告 aria-modal");
      const labelledBy = surface.getAttribute("aria-labelledby");
      assert.ok(labelledBy, "role=dialog 必须有可访问名（aria-labelledby）");
      const title = root.querySelector(`#${CSS.escape(labelledBy!)}`);
      assert.ok(title, "aria-labelledby 指向的标题节点必须存在");
      assert.equal(title!.textContent, "删除这笔流水？");
      ctx.cleanup();
    });
  });
});
