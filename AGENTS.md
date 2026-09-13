# 工作流约定（所有 agent 必须遵守）

- **提交纪律**：每完成一项功能或修复，就提交一次自己改过的文件。禁止把多个不相关的改动堆进同一个提交。
- **提交信息要求规范详细**：
  - 格式：`<type>(<scope>): <中文摘要>`，正文用中文说明改了什么、为什么改。
  - type 取值：`feat` 新功能、`fix` 修复、`style` 视觉/样式、`refactor` 重构、`docs` 文档、`chore` 杂项。
  - scope 用模块名：`design-system`（globals.css/layout/template/loading/nav）、`dashboard`（总览）、`ledger`、`accounts`、`import`、`settings`、`login`、`charts` 等。
  - 示例：`style(design-system): 建立雾夜主题令牌与灯线签名`。
- **设计契约**：一切界面改动遵循 `DESIGN.md`，改动后同步更新该文件（含变更记录）。
- **提交前验证**：`npm run lint` 通过再提交；涉及构建产物的改动跑 `npm run build`。
- 界面改动完成后对照 `DESIGN.md` 第十一节禁忌清单自查。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
