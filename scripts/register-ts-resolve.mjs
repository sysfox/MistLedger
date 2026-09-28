/**
 * Entry point for `node --import` that installs the `.js` → `.ts` resolver
 * remap used by `npm test`. See `scripts/ts-resolve-hooks.mjs` for why it is
 * needed.
 *
 * Prefers the synchronous `module.registerHooks` (same thread, works on
 * Node 22.15+ / 23.5+) and falls back to the loader-thread `module.register`
 * so the script does not pin a minimum Node version.
 */
import * as moduleApi from "node:module";
import { hooks, resolve } from "./ts-resolve-hooks.mjs";

if (typeof moduleApi.registerHooks === "function") {
  moduleApi.registerHooks(hooks());
} else {
  // Older runtimes: hand the hooks to a loader thread.
  moduleApi.register("data:text/javascript," + encodeURIComponent(
    `export { resolve } from ${JSON.stringify(new URL("./ts-resolve-hooks.mjs", import.meta.url).href)};`,
  ));
}

// `resolve` is re-exported so the loader-thread fallback above stays type/impl
// discoverable; nothing consumes it directly in the registerHooks path.
export { resolve };
