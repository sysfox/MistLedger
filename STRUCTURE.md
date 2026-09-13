# MistLedger — Project Structure & Architecture

> Single source of truth for the codebase layout, architecture, design system, and conventions. **Any agent may (and must) update this file** when it changes routes, data model, libs, components, or conventions — keep it in the same commit as the code it describes.

MistLedger (雾夜账) is a Chinese-language personal bookkeeping PWA: "a lamp lit in fog at night to read the ledger." Track where every yuan goes and how much remains. Forced permanent night theme.

- Stack: Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 (`@theme` tokens) · Supabase (Postgres + Auth via `@supabase/ssr`) · Recharts · SheetJS (xlsx)
- Runtime notes: scripts `dev`, `build`, `start`, `lint` (`eslint`), `typecheck` (`tsc --noEmit`); path alias `@/* → ./src/*`; no `middleware.ts` — Next 16 uses `src/proxy.ts` instead.

## 1. Directory layout

```
src/
  app/                  # Routes (all pages are server components unless noted)
    layout.tsx          # Fonts (Noto Serif SC / Noto Sans SC / Geist Mono via next/font),
                        # metadata, viewport (themeColor #0a0e14, viewportFit=cover),
                        # mounts ServiceWorkerRegister + SiteNav, safe-area bottom padding
    template.tsx        # Per-navigation remount wrapper: .page-enter "fog-develops" transition
    loading.tsx         # "Holding the lamp" loading state (breathing lamp dot + 掌灯…)
    error.tsx           # Route error boundary (client, retry button)
    global-error.tsx    # Root error boundary (renders its own html/body with bg-night)
    manifest.ts         # Web App Manifest (雾夜账, standalone, portrait, zh-CN,
                        # theme/background #0a0e14, icons 192/512 + maskable)
    page.tsx            # "/" Overview: total assets, month expense/income, budget bars,
                        # account balances, 3 lazy charts. force-dynamic, auth-gated
    login/page.tsx      # Client page; email/password sign-in + sign-up via browser
                        # Supabase client; friendly Chinese error mapping
    ledger/             # Manual bookkeeping: page.tsx (form + recent 100 transactions),
                        # transaction-form.tsx (client, useActionState), delete button,
                        # actions.ts (createTransaction / deleteTransaction)
    data/               # Query & analytics: 12-month trend, asset curve (30/90/180-day
                        # chips), preset query chips, QueryForm (client, searchParams),
                        # results (summary + top-200 list + expense pie)
    import/             # Bill import: import-client.tsx parses files in the browser,
                        # actions.ts submitImportAction (dedupe + batch + rules),
                        # recent import_batches + category rule chips
    accounts/           # Account CRUD: create form, toggle active, delete; computed
                        # balances; actions.ts
    settings/           # Categories + budgets management, ensure-default button; actions.ts
    globals.css         # Design tokens (@theme) + component classes + fog/lamp effects
  proxy.ts              # Edge auth gate (Next 16 replacement for middleware.ts)
  components/
    site-nav.tsx        # Desktop top bar + mobile fixed bottom tab bar (6 links),
                        # active lamp-line, sign-out via browser Supabase, hidden on /login
    dashboard-charts.tsx        # Recharts: TrendChart (bar, ember/jade), AssetChart
                        # (line, lamp), ShareChart (pie, 8-color palette); reduced-motion
                        # aware; figure/aria labels
    dashboard-charts-lazy.tsx   # next/dynamic (ssr:false) wrappers + skeleton
    service-worker-register.tsx # Registers /sw.js on window load (silent failure)
  lib/
    supabase/client.ts  # Browser client (createBrowserClient, publishable key)
    supabase/server.ts  # Server client with cookie getAll/setAll adapters
    supabase/proxy.ts   # (session helper used by proxy.ts)
    supabase/database.types.ts  # Generated Database type
    ledger/constants.ts # ACCOUNT_TYPES, CHANNELS, accountTypeLabel/channelLabel,
                        # DEFAULT_CATEGORIES seed (expense: 餐饮/交通/购物/学习/宿舍/娱乐;
                        # income: 生活费/兼职/红包)
    ledger/format.ts    # formatMoney (zh-CN, 2dp), formatBudget (0dp)
    ledger/stats.ts     # Pure functions: monthlyTrend, categoryShare, assetCurve,
                        # filterTxs, summarizeTxs, accountBalances
    ledger/import-parse.ts  # Parsers: parseAlipay (CSV-GBK/xlsx), parseWechat (xlsx),
                        # parseCCB (建行 hqmx xls); parseBillFile entrypoint
public/
  sw.js                 # Service worker (cache "mistledger-v1"): static cache-first,
                        # navigation network-first + inline offline page
  icons/                # PWA icons 192/512 (+ maskable)
data/                   # Personal bank statements — gitignored, never commit
```

Config: `next.config.ts` (empty), `eslint.config.mjs` (flat config, core-web-vitals + TS), `tsconfig.json` (strict, bundler resolution), `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only — never service_role).

## 2. Routes

| Route | Purpose | Notes |
|---|---|---|
| `/` | Overview (总览) | Hero assets number, month stats, budget progress, 3 lazy charts |
| `/ledger` | Record (记账) | Transaction form + recent 100 rows; delete with confirm |
| `/data` | Query (数据) | URL-searchParams-driven queries; chips 30/90/180 days |
| `/import` | Import (导入) | Browser-side parsing; max 2000 rows per batch |
| `/accounts` | Accounts (账户) | Balances = initial + sums; transfers move both sides |
| `/settings` | Settings (设置) | Categories (default seed), budgets (month = YYYY-MM-01) |
| `/login` | Auth | Client page; only route without auth gate |

Auth gating: `src/proxy.ts` redirects unauthenticated users to `/login` (except `/login`), and authenticated users away from `/login`. Pages double-check via server-side `supabase.auth.getUser()`. All pages are `force-dynamic`.

## 3. Data model (Supabase `public` schema)

| Table | Key columns |
|---|---|
| `accounts` | `user_id, name, type` (bank_card / alipay_balance / wechat_change / lingqiantong / other)`, initial_balance, is_active` |
| `categories` | `user_id, name, kind` (expense/income)`, icon, sort` |
| `budgets` | `user_id, month, category_id, limit_amount` — unique per (user, month, category) |
| `category_rules` | `user_id, keyword, category_id` — substring match for auto-categorization |
| `transactions` | `user_id, date, amount, type` (expense/income/transfer)`, account_id, to_account_id, category_id, channel` (alipay/wechat/direct/other)`, counterparty, source` (manual/batch)`, external_id, import_batch_id, note` |
| `import_batches` | `user_id, source` (alipay_import/wechat_import/bank_import)`, filename, row_count, success_count, duplicate_count` |

Conventions:
- Server actions return `ActionResult = { ok: boolean; message: string }` and are consumed by `useActionState` (pending state, `role=alert` / `aria-live`).
- Import dedupe: `external_id` per `(user_id, source)` — formats `alipay|<order no>`, `wechat|<bill no>`, `ccb|<date>|<seq-or-note+amount>`.
- All money mutations revalidate the affected routes (`/ledger`, `/accounts`, `/`, …).
- All deletes require a second confirmation in the UI; FK violations surface as user-facing Chinese messages.

## 4. Design system (summary — full contract in DESIGN.md)

**The sole design contract is `DESIGN.md`; every UI change must follow it and update it (with a changelog entry).** Essence:

- Concept: night (blue-black layered surfaces), fog (drifting atmosphere, fogline borders), lamp (amber accent — CTA, active lamp line, ¥ on key numbers), ledger (serif titles, mono tabular amounts).
- Tokens (`@theme` in globals.css): night `#0a0e14`, ink `#e9e4d8`, lamp `#e3b341`, ember `#e2574c` (expense), jade `#6fbf8f` (income), mist `#111826`, veil `#1b2436`, fogline `#28324a`, dim `#8b93a7`.
- Typography: Noto Serif SC (display only), Noto Sans SC (body), Geist Mono (`tabular-nums`) for every amount via `.money`.
- Signature: `.lamp-line` (whitelisted positions only), fog layers on `body::before/::after`, `mist-in` route transition 380ms, `lamp-breathe` loading.
- Component classes in `@layer components`: `.panel .input .btn-primary .btn-ghost .link-subtle .chip .chip-active .eyebrow .money .skeleton`.
- Charts: ember/jade bars, lamp asset line, 8-color pie palette, fogline grid, veil tooltips.
- Copy tone: old bookkeeper — verb-first buttons (保存/创建/确认导入), no 提交/确定, fixed vocabulary, counter word always 笔.

Taboo list (DESIGN.md §十一, 10 items): no new standard reds/greens/blues; no large lamp surfaces; ≤1 lamp line per screen (nav exempt); no gradients/glow headlines; no `dark:` variants; no zinc/neutral/slate; no non-mono amounts; no animation >500ms (ambient fog/lamp/skeleton exempt but must go static under reduced-motion); no removed/non-lamp focus rings; no numbered decorations, emoji icons, or stacked skeuomorphic shadows.

## 5. Workflow & verification

1. Before touching Next.js conventions, read the relevant guide in `node_modules/next/dist/docs/` (this Next version may differ from training data).
2. Agents should delegate exploration/research to subagents; see `AGENTS.md` for the full workflow contract (commit discipline, message format, lint/build gates).
3. Verify: `npm run lint` before every commit; `npm run build` for build-affecting changes; UI changes additionally get a `DESIGN.md` changelog entry and the §十一 taboo self-check.
4. Accessibility acceptance: keyboard Tab pass (lamp focus rings visible), reduced-motion pass (no animation), 375px width pass (no horizontal scroll).
5. Commit message format: `<type>(<scope>): <summary>` — types feat/fix/style/refactor/docs/chore; scopes design-system, dashboard, ledger, accounts, import, settings, login, charts, etc.
