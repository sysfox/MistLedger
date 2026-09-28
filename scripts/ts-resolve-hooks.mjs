
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function isRemappable(specifier) {
  return (specifier.startsWith("./") || specifier.startsWith("../")) && specifier.endsWith(".js");
}

function remap(specifier, parentURL) {
  if (!parentURL || !parentURL.startsWith("file:") || !isRemappable(specifier)) return null;
  const candidate = new URL(specifier.slice(0, -3) + ".ts", parentURL);
  return existsSync(fileURLToPath(candidate)) ? candidate.href : null;
}

export function hooks() {
  return {
    resolve(specifier, context, nextResolve) {
      const remapped = remap(specifier, context.parentURL);
      return nextResolve(remapped ?? specifier, context);
    },
  };
}

export function resolve(specifier, context, nextResolve) {
  const remapped = remap(specifier, context.parentURL);
  return nextResolve(remapped ?? specifier, context);
}
