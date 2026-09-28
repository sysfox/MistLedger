/**
 * Node ESM resolver hook that maps `./foo.js` onto `./foo.ts`.
 *
 * Why this file exists:
 *
 * The test files import their subject with the `./x.js` specifier. That is the
 * *correct* specifier for the bundler world this project lives in — Next.js,
 * webpack and `tsc` with `moduleResolution: "bundler"` all resolve `./api-cache.js`
 * to `src/lib/api/api-cache.ts`, and it is what the rest of `src/` does. But
 * Node's built-in TypeScript support (`--experimental-strip-types`, stable since
 * Node 23) only strips types; it does **not** perform TypeScript's
 * extension-substitution, so `npm test` died with
 * `ERR_MODULE_NOT_FOUND: ...\src\lib\api\api-cache.js`.
 *
 * Rewriting the imports in the test files to `./api-cache.ts` is not an option:
 * that requires `allowImportingTsExtensions` in tsconfig.json, which tsconfig
 * is not free to set and which would leak a test-runner concern into the app's
 * compiler options. Importing via `new URL(...)` + dynamic `import()` would
 * work but throws away the static types the tests rely on.
 *
 * So the substitution happens here, at the resolution layer, where it belongs:
 * the source keeps the specifier every other tool in the repo understands.
 *
 * Only *relative* specifiers ending in `.js` are remapped, and only when the
 * sibling `.ts` actually exists — a missing target falls through to Node's
 * normal resolution, so a genuine typo still produces a real error.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** `true` when `specifier` is a relative `./x.js` we should try to remap. */
function isRemappable(specifier) {
  return (specifier.startsWith("./") || specifier.startsWith("../")) && specifier.endsWith(".js");
}

/**
 * Shared resolver body. Returns a rewritten specifier, or `null` to fall back.
 * Kept separate so both the sync (`registerHooks`) and async (`register`)
 * install paths below use exactly the same logic.
 */
function remap(specifier, parentURL) {
  if (!parentURL || !parentURL.startsWith("file:") || !isRemappable(specifier)) return null;
  const candidate = new URL(specifier.slice(0, -3) + ".ts", parentURL);
  return existsSync(fileURLToPath(candidate)) ? candidate.href : null;
}

/** Synchronous hook — `module.registerHooks` (Node 22.15+/23.5+). */
export function hooks() {
  return {
    resolve(specifier, context, nextResolve) {
      const remapped = remap(specifier, context.parentURL);
      return nextResolve(remapped ?? specifier, context);
    },
  };
}

/**
 * Loader-thread hook — `module.register` fallback for older runtimes, and the
 * shape the `--import` entry point below registers either way.
 */
export function resolve(specifier, context, nextResolve) {
  const remapped = remap(specifier, context.parentURL);
  return nextResolve(remapped ?? specifier, context);
}
