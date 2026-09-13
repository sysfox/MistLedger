# Workflow Contract (binding for all agents)

- **Subagents first**: the main agent should delegate as much work as possible to subagents (code exploration, retrieval, independent feature implementation). The main agent only orchestrates, synthesizes, and does the final review — avoid piling up large chunks of exploration or implementation in the main context.
- **Commit discipline**: after each completed feature or fix, commit the files you changed in that unit of work. Never pile unrelated changes into one commit.
- **Commit message requirements (detailed and standardized)**:
  - Format: `<type>(<scope>): <summary>`, with a body explaining what changed and why.
  - Types: `feat` (new feature), `fix` (bug fix), `style` (visual/styling), `refactor`, `docs`, `chore` (misc).
  - Scopes use module names: `design-system` (globals.css/layout/template/loading/nav), `dashboard` (overview), `ledger`, `accounts`, `import`, `settings`, `login`, `charts`, etc.
  - Example: `style(design-system): establish mist-night theme tokens and lamp-line signature`.
- **Project knowledge**: read `STRUCTURE.md` before working — it documents the full architecture, design system summary, data model, and conventions. Agents are allowed (and required) to keep `STRUCTURE.md` up to date: whenever your change affects routes, the data model, libs, components, or conventions, update it in the same commit.
- **Design contract**: every UI change follows `DESIGN.md`; update that file (including its changelog) alongside the change.
- **Pre-commit verification**: `npm run lint` must pass before committing; run `npm run build` for changes affecting build output.
- After UI changes, self-check against the taboo list in `DESIGN.md` section 11.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
