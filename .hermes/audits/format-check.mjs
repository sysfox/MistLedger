#!/usr/bin/env node
/**
 * [D-08] 金额格式化回归 —— 薄壳转发。
 *
 * 历史：本文件曾把 `src/lib/ledger/format.ts` 的实现**原样抄了一份**在文件头部，
 * 再对那份抄本做断言。那样验证的是「抄本与抄本一致」：format.ts 改了而本文件
 * 没同步时，断言照样全绿 —— 一道看起来在防回归、实际什么都拦不住的护栏。
 *
 * 现在断言已迁到 `src/lib/ledger/format.test.ts`，那里 `import` 的是真实实现，
 * 改动 format.ts 会直接让 `npm test` 失败。
 *
 * 用法：
 *   node .hermes/audits/format-check.mjs    转发到 node --test（只跑 format 用例）
 *   npm test                               全量（推荐）
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

console.log(
  "format-check.mjs → src/lib/ledger/format.test.ts（直接 import 真实实现）\n",
);

const result = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    "./scripts/register-ts-resolve.mjs",
    "--test",
    "src/lib/ledger/format.test.ts",
  ],
  { cwd: ROOT, stdio: "inherit" },
);

process.exit(result.status ?? 1);
