/*
 * jsdom + TSX 的真实挂载环境，供 `src/` 下的 `*.test.ts` 使用。
 *
 * 为什么需要它：`npm test` 跑的是 `node --experimental-strip-types --test`，
 * 它只剥类型、不转译 JSX，也不认识 tsconfig 的 `@/*` 路径别名，更没有 DOM。
 * 于是「组件在真实浏览器里到底做了什么」这类问题（本轮 P0 的根因正是
 * 「DOM 属性组合的运行时语义」）无法被现有测试体系覆盖 —— 静态类型检查
 * 看不见 `form` 与 `type` 的区别。
 *
 * 本文件只做**管道**（DOM 注入、TSX 转译、别名解析、依赖打桩），
 * 一条断言都不写：断言全部在 `.test.ts` 里，那边是类型检查 + ESLint 覆盖的。
 * 同理它是 `.cjs` 而非 `.ts`：Node 内置的 `Module._extensions` / `Module._load`
 * 这些加载器内部接口没有官方类型，写成 TS 只能靠断言绕过，那等于把类型系统
 * 关掉再声称通过。
 *
 * 顺带说明：Node 的 `--test` 对每个测试文件开独立子进程，所以这里往 global
 * 上挂 `window` / `document` 不会污染同批次的其他测试文件。
 */

/* eslint-disable @typescript-eslint/no-require-imports --
 * 本文件必须是 CommonJS，且必须用 `require()`。
 *
 * 原因不是「懒得写 import」，而是**求值顺序**：本文件要在同一个同步过程里，
 * 先把 `Module._extensions[".tsx"]` 与 `Module._resolveFilename` 换掉，
 * 再去 `require` 组件。若改成 ESM，`import` 是静态的、会在本模块求值**之前**
 * 就完成解析，那时打桩还没装上，组件会以「模块解析失败」的形式挂掉，
 * 而不是以「行为断言失败」的形式暴露问题。
 *
 * `@typescript-eslint/no-require-imports` 存在的意义是拦住**源码**里的
 * CommonJS 残留（TS 走 `verbatimModuleSyntax` 时这会是真 bug）。本文件不在
 * 该规则的适用范围内：它就是加载器本身，每个 `require` 都必需。
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { JSDOM } = require("jsdom");
const ts = require("typescript");

const REPO = path.resolve(__dirname, "..", "..");

/**
 * jsdom 缺少、但 React 19 / MUI 会真实使用到的全局量。
 * 少任何一个，报错都会以「组件挂了」的形式出现，而不是「环境没配好」，
 * 那会把环境问题误读成回归。
 */
const DOM_GLOBALS = [
  "window",
  "document",
  "navigator",
  "location",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "Element",
  "Node",
  "NodeList",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "FocusEvent",
  "FormData",
  "DOMRect",
  "MutationObserver",
  "DocumentFragment",
  "ShadowRoot",
  "SVGElement",
  "HTMLElement",
  "HTMLFormElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLIFrameElement",
  // 断言里要用 `CSS.escape` 按 id 反查 aria-labelledby 指向的标题节点。
  // jsdom 有 `window.CSS` 但不注入 global，少了它测试会以
  // `ReferenceError: CSS is not defined` 挂掉 —— 一个环境缺口伪装成断言失败。
  "CSS",
];

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/ledger",
  pretendToBeVisual: true,
});

for (const key of DOM_GLOBALS) {
  if (!dom.window[key]) continue;
  // Node 26 自带若干只读的 global（`navigator` 就是 getter-only 的），
  // 直接赋值会抛 TypeError。defineProperty 能覆盖，且不会静默失败 ——
  // 环境没配好时必须在这里炸出来，而不是让组件以「行为异常」的形式挂掉。
  Object.defineProperty(global, key, {
    value: dom.window[key],
    configurable: true,
    writable: true,
  });
}
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};

/** 供测试文件使用的 document / window（类型在 .test.ts 侧收窄）。 */
const harnessDom = dom;

/* ------------------------------------------------------------------ *
 * TSX 转译 + `@/` 别名
 * ------------------------------------------------------------------ */

const TSX_OPTIONS = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
};

/**
 * 让 CJS 加载器能吃 .tsx / .ts：Node 只会剥类型，不会转译 JSX。
 * 挂在 `.ts` 上是为了让组件树里被间接引入的 .ts 也能一起转。
 */
const previousExtensions = { ...Module._extensions };
Module._extensions[".tsx"] = compileSource;
Module._extensions[".ts"] = compileSource;

function compileSource(mod, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: TSX_OPTIONS,
    fileName: filename,
  });
  mod._compile(outputText, filename);
}

/** `@/lib/x` → `<repo>/src/lib/x`，按 TS 的扩展名优先级依次试探。 */
const previousResolve = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...rest) {
  if (request.startsWith("@/")) {
    const base = path.join(REPO, "src", request.slice(2));
    for (const candidate of [
      `${base}.tsx`,
      `${base}.ts`,
      base,
      path.join(base, "index.tsx"),
    ]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }
  return previousResolve.call(this, request, ...rest);
};

/* ------------------------------------------------------------------ *
 * 依赖打桩
 * ------------------------------------------------------------------ */

/**
 * 调用点组件会 import server action 与浏览器 API 模块：前者要 Supabase
 * 与 `next/cache`，后者要 `window` 上的自定义事件。两者都不是本轮要验证的
 * 对象，而它们在 Node 里直接 import 会失败（`"use server"` 目录无法解析、
 * `next/*` 依赖构建产物）。所以按 **specifier** 打桩 —— 与调用方源码里写的
 * 字符串完全一致，任何拼写漂移都会让桩失效并立刻抛错，而不是静默走到真模块。
 */
const stubs = new Map();
const previousLoad = Module._load;

/** 注册一个桩；`request` 必须与源码里的 import specifier 逐字相同。 */
function stub(request, exportsObject) {
  stubs.set(request, exportsObject);
}

Module._load = function load(request, ...rest) {
  if (stubs.has(request)) return stubs.get(request);
  return previousLoad.call(this, request, ...rest);
};

/* ------------------------------------------------------------------ *
 * 组件加载与挂载
 * ------------------------------------------------------------------ */

const React = require("react");
const { act } = React;
const ReactDOMClient = require("react-dom/client");

/**
 * 尚未卸载的 root。
 *
 * **它存在的唯一理由是让进程能退出。** 实测：只要还有一个挂载中、且确认框
 * 打开的 root 留在文档里，事件循环上就有一个 ref 住的句柄，`--test` 永远不会
 * 结束（`npm test` 直接挂到超时）；逐个 `unmount()` 掉立刻就退出了。
 *
 * 靠测试文件自己记得清理是不可靠的：断言一抛错，后面的 `cleanup()` 就被跳过，
 * 于是**第一条失败的断言会污染后面所有用例**，并让整个 run 挂死。
 * 所以由 harness 统一记账，`restore()` 兜底。
 */
const liveRoots = new Set();

/** 按仓库相对路径加载一个组件模块，例如 `src/app/ledger/type-picker.tsx`。 */
function loadModule(relativePath) {
  const absolute = path.join(REPO, relativePath);
  return require(absolute);
}

/**
 * 挂载一个组件，返回测试用的操作句柄。
 *
 * 每次 mount 都新建一个独立容器并挂到 body 上。`unmount()` 卸载 root 并移除
 * 容器；Portal 出去的对话框由 React 一并回收。
 */
function mount(element) {
  const doc = dom.window.document;
  const container = doc.createElement("div");
  const host = doc.createElement("div");
  container.appendChild(host);
  doc.body.appendChild(container);

  const root = ReactDOMClient.createRoot(host);
  liveRoots.add(root);

  const handle = {
    host,
    container,
    doc,
    dom: dom.window,
    root,
    /** 在 act 里渲染/重渲染。 */
    render(next) {
      act(() => {
        root.render(next);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      liveRoots.delete(root);
      container.remove();
    },
  };
  handle.render(element);
  return handle;
}

/** 在 act 内派发一个真实事件。`init` 传给对应的事件构造器。 */
function fire(target, Ctor, type, init) {
  act(() => {
    target.dispatchEvent(new dom.window[Ctor](type, {
      bubbles: true,
      cancelable: true,
      ...init,
    }));
  });
}

const click = (el) => fire(el, "MouseEvent", "click");
const mouseDown = (el) => fire(el, "MouseEvent", "mousedown");
const keyDown = (el, init) => fire(el, "KeyboardEvent", "keydown", init);
const keyUp = (el, init) => fire(el, "KeyboardEvent", "keyup", init);

/**
 * 按 HTML 规范手工派发一个 `submit` 事件，并指定 `submitter`。
 *
 * 为什么不用 `form.requestSubmit()`：jsdom 实现了它，但它派发的事件不带
 * `submitter`，而 `submitter` 正是本组件区分「已确认」与「首次提交」的唯一
 * 依据（见 confirm-submit-button.tsx 的 onSubmit）。要验证真实按钮点击这条
 * 路径，只能在这里显式把 submitter 装上去 —— 这恰好也是浏览器会做的事。
 */
function submit(form, submitter = null) {
  const event = new dom.window.Event("submit", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "submitter", { value: submitter, configurable: true });
  act(() => {
    form.dispatchEvent(event);
  });
  return event;
}

/**
 * 推进定时器与 transition；MUI 的关闭动画需要一拍才真正卸载节点。
 *
 * 80ms 足以让 `Fade` 走完入场/退场（实测 opacity 在 60ms 内已到 0），
 * 又不至于把 18 个用例的等待时间堆成秒级。
 */
const flush = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

/** 当前打开的确认对话框（`.MuiDialog-root`），没有则返回 null。 */
function dialog(doc = dom.window.document) {
  return doc.querySelector(".MuiDialog-root");
}

/**
 * 确认框此刻是否处于「打开」态。
 *
 * **判据必须是容器的不透明度，不能是「节点还在不在」。** MUI v9 的 Dialog
 * 关闭时走 `Fade`：root 节点会**继续留在 DOM 里直到过渡动画播完**，实测点
 * 确认后 200ms 内 `.MuiDialog-root` 依然存在；`data-state` 属性则根本不存在
 * （MUI v5 的 `data-state="exited"` 已被移除）。所以「节点存在」在关闭期间
 * 为真，会把「已关闭」误判成「仍打开」—— 上一版 10 条断言集体变红正是这个原因。
 *
 * `.MuiDialog-container` 上的内联 `opacity` 才是可靠的开关信号：
 * 打开时 `opacity: 1`，关闭动画一开始就是 `opacity: 0`。
 */
function dialogOpen(doc = dom.window.document) {
  const root = dialog(doc);
  if (!root) return false;
  const container = root.querySelector(".MuiDialog-container");
  if (!container) return false;
  const style = container.getAttribute("style") || "";
  const matched = /opacity:\s*([\d.]+)/.exec(style);
  return matched ? Number(matched[1]) > 0 : true;
}

/** 对话框里的「确认」按钮。 */
function confirmButton(doc = dom.window.document) {
  const root = dialog(doc);
  return root ? root.querySelector("[data-confirm-submit]") : null;
}

/** 表单里的触发按钮（本组件保证它不是 submit，见组件注释第 3 条）。 */
function triggerButton(scope) {
  return scope.querySelector("form button");
}

/**
 * 还原加载器、卸载所有残留 root、关闭 jsdom 窗口。
 *
 * 供单个测试文件在结束时调用（不影响其他测试文件：各自独立进程）。
 * 三件事缺一不可：还原加载器让后续 import 走真实模块；卸载残留 root 解除
 * 事件循环上的 ref 句柄（否则进程永不退出）；关窗口释放 jsdom 的 rAF 泵。
 */
function restore() {
  for (const root of [...liveRoots]) {
    try {
      act(() => {
        root.unmount();
      });
    } catch {
      // 一个已经炸掉的 root 不该把 cleanup 变成第二处报错。
    }
    liveRoots.delete(root);
  }
  Module._load = previousLoad;
  Module._resolveFilename = previousResolve;
  for (const ext of [".tsx", ".ts"]) {
    if (previousExtensions[ext] === undefined) delete Module._extensions[ext];
    else Module._extensions[ext] = previousExtensions[ext];
  }
  dom.window.close();
}

module.exports = {
  REPO,
  dom: harnessDom,
  document: dom.window.document,
  window: dom.window,
  React,
  act,
  loadModule,
  mount,
  click,
  mouseDown,
  keyDown,
  keyUp,
  submit,
  flush,
  dialog,
  dialogOpen,
  confirmButton,
  triggerButton,
  stub,
  restore,
};
