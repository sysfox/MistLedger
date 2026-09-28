/**
 * Node ESM resolver hook that maps `./foo.js` onto `./foo.ts`.
 *
 * Node's built-in TypeScript support (`--experimental-strip-types`, stable since Node 23) only
 * strips types; it does **not** perform TypeScript's extension-substitution, so `npm test` died
 * with `ERR_MODULE_NOT_FOUND: ...\src\lib\api\api-cache.js`. Rewriting the test imports to
 * `./api-cache.ts` would require `allowImportingTsExtensions` in tsconfig, leaking a test-runner
 * concern into the app's compiler options. So the substitution happens here, at the resolution
 * layer, where the source keeps the specifier every other tool in the repo understands.
 *
 * Only *relative* specifiers ending in `.js` are remapped, and only when the sibling `.ts` exists
 * — a missing target falls through to Node's normal resolution, so a typo still errors.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** `true` when `specifier` is a relative `./x.js` we should try to remap. */
function isRemappable(specifier) {
  return (specifier.startsWith("./") || specifier.startsWith("../")) && specifier.endsWith(".js");
}

/**
 * Shared resolver body. Returns a rewritten specifier, or `null` to fall back. Kept separate so
 * both the sync (`registerHooks`) and async (`register`) install paths use the same logic.
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

/** Loader-thread hook — `module.register` fallback for older runtimes. */
export function resolve(specifier, context, nextResolve) {
  const remapped = remap(specifier, context.parentURL);
  return nextResolve(remapped ?? specifier, context);
}
