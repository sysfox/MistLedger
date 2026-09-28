import * as moduleApi from "node:module";
import { hooks, resolve } from "./ts-resolve-hooks.mjs";

if (typeof moduleApi.registerHooks === "function") {
  moduleApi.registerHooks(hooks());
} else {
  moduleApi.register("data:text/javascript," + encodeURIComponent(
    `export { resolve } from ${JSON.stringify(new URL("./ts-resolve-hooks.mjs", import.meta.url).href)};`,
  ));
}

export { resolve };
