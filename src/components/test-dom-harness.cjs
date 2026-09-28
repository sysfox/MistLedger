
/* eslint-disable @typescript-eslint/no-require-imports -- 本文件是加载器本身，必须 CommonJS + require()：它要在同一同步过程里先装好 _extensions 与 _resolveFilename 再 require 组件，ESM 的静态 import 会在打桩前就完成解析。 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { JSDOM } = require("jsdom");
const ts = require("typescript");

const REPO = path.resolve(__dirname, "..", "..");

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
  "CSS",
];

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/ledger",
  pretendToBeVisual: true,
});

for (const key of DOM_GLOBALS) {
  if (!dom.window[key]) continue;
  Object.defineProperty(global, key, {
    value: dom.window[key],
    configurable: true,
    writable: true,
  });
}
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};

const harnessDom = dom;

const TSX_OPTIONS = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
};

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

const stubs = new Map();
const previousLoad = Module._load;

function stub(request, exportsObject) {
  stubs.set(request, exportsObject);
}

Module._load = function load(request, ...rest) {
  if (stubs.has(request)) return stubs.get(request);
  return previousLoad.call(this, request, ...rest);
};

const React = require("react");
const { act } = React;
const ReactDOMClient = require("react-dom/client");

const liveRoots = new Set();

function loadModule(relativePath) {
  const absolute = path.join(REPO, relativePath);
  return require(absolute);
}

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

function submit(form, submitter = null) {
  const event = new dom.window.Event("submit", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "submitter", { value: submitter, configurable: true });
  act(() => {
    form.dispatchEvent(event);
  });
  return event;
}

const flush = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

function dialog(doc = dom.window.document) {
  return doc.querySelector(".MuiDialog-root");
}

function dialogOpen(doc = dom.window.document) {
  const root = dialog(doc);
  if (!root) return false;
  const container = root.querySelector(".MuiDialog-container");
  if (!container) return false;
  const style = container.getAttribute("style") || "";
  const matched = /opacity:\s*([\d.]+)/.exec(style);
  return matched ? Number(matched[1]) > 0 : true;
}

function confirmButton(doc = dom.window.document) {
  const root = dialog(doc);
  return root ? root.querySelector("[data-confirm-submit]") : null;
}

function triggerButton(scope) {
  return scope.querySelector("form button");
}

function restore() {
  for (const root of [...liveRoots]) {
    try {
      act(() => {
        root.unmount();
      });
    } catch {
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
