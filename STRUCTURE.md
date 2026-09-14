# MistLedger �?Project Structure & Architecture

> Single source of truth for the codebase layout, architecture, design system, and conventions. **Any agent may (and must) update this file** when it changes routes, data model, libs, components, or conventions �?keep it in the same commit as the code it describes.

MistLedger (雾夜�? is a Chinese-language personal bookkeeping PWA: "a lamp lit in fog at night to read the ledger." Track where every yuan goes and how much remains. Forced permanent night theme.

- Stack: Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 (`@theme` tokens) · Supabase (Postgres + Auth via `@supabase/ssr`) · Recharts · SheetJS (xlsx) · MUI (`@mui/material` + `@emotion/react` + `@emotion/styled` + `@mui/material-nextjs`，`/ledger` `/settings` `/login` 使用，详�?DESIGN.md §十三)
- Runtime notes: scripts `dev`, `build`, `start`, `lint` (`eslint`), `typecheck` (`tsc --noEmit`); path alias `@/* �?./src/*`; no `middleware.ts` �?Next 16 uses `src/proxy.ts` instead.

## 1. Directory layout

```
src/
  app/                  # Routes (all pages are server components unless noted)
    layout.tsx          # Fonts (Noto Serif SC / Noto Sans SC / Geist Mono via next/font),
                        # metadata, viewport (themeColor #0a0e14, viewportFit=cover),
                        # mounts ServiceWorkerRegister + SiteNav, safe-area bottom padding
    template.tsx        # Per-navigation remount wrapper: .page-enter "fog-develops" transition
    loading.tsx         # "Holding the lamp" loading state (breathing lamp dot + 掌灯�?
    error.tsx           # Route error boundary (client, retry button)
    global-error.tsx    # Root error boundary (renders its own html/body with bg-night)
    manifest.ts         # Web App Manifest (雾夜�? standalone, portrait, zh-CN,
                        # theme/background #0a0e14, icons 192/512 + maskable)
    page.tsx            # "/" Overview: dashboard_snapshot RPC only (active balances,
                        # 6-mo trend, month expense share, 30-day curve) + budget bars +
                        # 3 lazy charts; month/day keys use Asia/Shanghai. force-dynamic,
                        # getClaims-gated
    login/page.tsx      # Client page; email/password sign-in + sign-up via browser
                        # Supabase client; MUI TextField/Button; friendly Chinese error
                        # mapping; surfaces the "confirm email" path instead of bouncing
    ledger/             # Manual bookkeeping: page.tsx (form + recent 100 transactions),
                        # transaction-form.tsx (client, useActionState, MUI: TextField/
                        # Select/Chip/Button), delete-transaction-button.tsx (MUI Dialog
                        # confirm), edit-transaction-button.tsx (inline edit panel, MUI,
                        # Dialog confirm), actions.ts (createTransaction /
                        # updateTransaction / deleteTransaction; all validate
                        # account/category ownership before writing)
    data/               # Query & analytics: 12-month trend, asset curve (30/90/180-day
                        # chips), preset query chips, QueryForm (client, searchParams),
                        # results �?filters and aggregation run server-side (PostgREST
                        # filters + dashboard_snapshot / filtered_tx_stats RPCs), list
                        # capped at 200 rows, no full-history fetch
    settings/           # Accounts + categories + budgets + bill import unified (anchors
                        # #accounts / #import; account-actions.ts, import-actions.ts);
                        # controls on MUI: forms use TextField/Select/Button,
                        # delete/adjust/confirm flows use MUI Dialog;
                        # import-client.tsx parses files in the browser (preview table
                        # stays native); adjust-balance-button.tsx adjusts account
                        # balance inline via initial_balance rewrite + Dialog confirm
    globals.css         # Design tokens (@theme) + component classes + fog/lamp effects
  proxy.ts              # Edge auth gate (Next 16 replacement for middleware.ts); forwards
                        # Supabase anti-cache headers and excludes PWA/manifest assets
  components/
    site-nav.tsx        # Desktop top bar; mobile sticky top bar (wordmark + sign-out,
                        # safe-area-inset-top for notch) + fixed bottom tab bar (4 links),
                        # active lamp-line, sign-out via browser Supabase, hidden on /login
    dashboard-charts.tsx        # Recharts: TrendChart (bar, ember/jade), AssetChart
                        # (line, lamp), ShareChart (pie, 8-color palette); reduced-motion
                        # aware; figure/aria labels
    dashboard-charts-lazy.tsx   # next/dynamic (ssr:false) wrappers + skeleton
    service-worker-register.tsx # Registers /sw.js on window load (silent failure)
    mui-theme.tsx       # MUI 主题 ("use client")：palette/typography/components
                        # 全量映射 DESIGN tokens（灯/�?�?夜空/雾面/纱面/雾线/远雾），
                        # 复刻 .input/.btn 观感；warning/info 指回灯色/远雾
    mui-provider.tsx    # "use client"：AppRouterCacheProvider
                        # (@mui/material-nextjs/v16-appRouter) + ThemeProvider +
                        # CssBaseline；layout 用其包裹 SiteNav/children
  lib/
    supabase/client.ts  # Browser client (createBrowserClient, publishable key)
    supabase/server.ts  # Server client with cookie getAll/setAll adapters
    supabase/proxy.ts   # (session helper used by proxy.ts)
    supabase/database.types.ts  # Generated Database type, incl. the Functions (RPCs) below
    ledger/constants.ts # ACCOUNT_TYPES, CHANNELS, accountTypeLabel/channelLabel,
                        # DEFAULT_CATEGORIES seed (expense: 餐饮/交�?购物/学习/宿舍/娱乐;
                        # income: 生活�?兼职/红包)
    ledger/format.ts    # formatMoney (zh-CN, 2dp), formatBudget (0dp)
    ledger/stats.ts     # Pure-function library: monthlyTrend, categoryShare, assetCurve,
                        # filterTxs, summarizeTxs, accountBalances (single-pass; TxLike.type
                        # is a closed union). Retained for reuse/tests �?pages now aggregate
                        # via the RPCs instead
    ledger/import-parse.ts  # Parsers: parseAlipay (CSV GBK/UTF-8-BOM/xlsx), parseWechat
                        # (xlsx), parseCCB (建行 hqmx xls); parseBillFile entrypoint lazily
                        # imports xlsx (code-split) and decodes CSV with TextDecoder
public/
  sw.js                 # Service worker (cache "mistledger-v1"): static cache-first,
                        # navigation network-first + inline offline page
  icons/                # PWA icons 192/512 (+ maskable)
data/                   # Personal bank statements �?gitignored, never commit
```

Config: `next.config.ts` (empty), `eslint.config.mjs` (flat config, core-web-vitals + TS), `tsconfig.json` (strict, bundler resolution), `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only �?never service_role).

## 2. Routes

| Route | Purpose | Notes |
|---|---|---|
| `/` | Overview (总览) | Single `dashboard_snapshot` RPC for balances/trend/share/curve; budget bars; 3 lazy charts |
| `/ledger` | Record (记账) | Transaction form + recent 100 rows; edit/delete with MUI Dialog confirm; controls on MUI; writes validate owner |
| `/data` | Query (数据) | URL-searchParams queries applied server-side; summary via `filtered_tx_stats`; list �?00 |
| `/settings` | Settings (设置) | Accounts (#accounts) · categories · budgets · bill import (#import); anchors for in-page sections; controls on MUI with Dialog confirmations; balances via `account_balances` RPC + inline balance adjustment (adjusts `initial_balance` by the delta), imports via atomic `import_transactions` RPC |
| `/login` | Auth | Client page; only route without auth gate; controls on MUI |

Auth gating: `src/proxy.ts` redirects unauthenticated users to `/login` (except `/login`), and authenticated users away from `/login`; it excludes `_next/static`, `_next/image`, `favicon.ico`, `sw.js`, `manifest.webmanifest`, and image assets from the matcher, applies Supabase's `Cache-Control: private, no-cache…` headers on token refresh, and copies refreshed cookies onto redirect responses. Pages double-check via `supabase.auth.getClaims()` and throw on session errors. All pages are `force-dynamic`.

## 3. Data model (Supabase `public` schema)

| Table | Key columns |
|---|---|
| `accounts` | `user_id, name, type` (bank_card / alipay_balance / wechat_change / lingqiantong / other)`, initial_balance, is_active` |
| `categories` | `user_id, name, kind` (expense/income)`, icon, sort` |
| `budgets` | `user_id, month, category_id, limit_amount` �?unique per (user, month, category) |
| `category_rules` | `user_id, keyword, category_id` �?substring match for auto-categorization |
| `transactions` | `user_id, date, amount, type` (expense/income/transfer)`, account_id, to_account_id, category_id, channel` (alipay/wechat/direct/other)`, counterparty, source` (manual/batch)`, external_id, import_batch_id, note` |
| `import_batches` | `user_id, source` (alipay_import/wechat_import/bank_import)`, filename, row_count, success_count, duplicate_count` |

Indexes: `transactions_user_date_idx (user_id, date DESC)`, `transactions_import_dedup_uidx (user_id, source, external_id) WHERE external_id IS NOT NULL`, plus FK-covering indexes on `account_id`, `to_account_id`, `category_id`, `import_batch_id`, and `budgets.category_id` / `category_rules.category_id`.

Database functions (RPCs; all `security invoker` + `set search_path = public`, `execute` granted to `authenticated` only, so RLS still scopes every row):

| Function | Returns | Purpose |
|---|---|---|
| `account_balances()` | `(account_id, balance)` | Each account's balance = `initial_balance` + all transactions (expense �? income +, transfer −from/+to) |
| `dashboard_snapshot(p_months, p_days)` | `jsonb` | `{ accounts:[{id,balance}], months:[], monthly:[{month,expense,income}], category:[{category_id,spent}], daily:[{date,delta}] }`; active-account balances, monthly trend, current-month expense by category (`"__none__"` = unclassified), and active-account daily net delta with transfer remapping; Asia/Shanghai clock |
| `filtered_tx_stats(p_from,p_to,p_type,p_category,p_account,p_min,p_max,p_q)` | `jsonb` | Exact `{ count, expense, income, transfer, by_category }` for arbitrary filters (no PostgREST row cap); `p_category` accepts a uuid or `"none"` |
| `import_transactions(p_source,p_filename,p_account_id,p_rows)` | `(batch_id,inserted_count,duplicate_count)` | One transaction: creates the batch, inserts rows with `ON CONFLICT �?DO NOTHING`, updates counters; validates source/row-count/account-ownership and every row (date, amount, type, externalId, channel, transfer/category ownership) |

Conventions:
- Server actions return `ActionResult = { ok: boolean; message: string }` and are consumed by `useActionState` (pending state, `role=alert` / `aria-live`).
- Every money-mutating action calls `supabase.auth.getUser()`; writes/deletes are scoped by `user_id` and check the affected row count so RLS-filtered no-ops report failure instead of false success.
- Import dedupe: `external_id` per `(user_id, source)` �?formats `alipay|<order no>`, `wechat|<bill no>`, `ccb|<date>|<signed amount>|<balance>|<content hash>|<occurrence>`. The CCB key is content-based (序号 restarts per export); rows imported before this change will not match the new key on a re-import.
- All money mutations revalidate the affected routes (`/ledger`, `/settings`, `/data`, `/`).
- All deletes and edits (transactions, account balances) require a second confirmation in the UI; FK violations surface as user-facing Chinese messages.

## 4. Design system (summary �?full contract in DESIGN.md)

**The sole design contract is `DESIGN.md`; every UI change must follow it and update it (with a changelog entry).** Essence:

- Concept: night (blue-black layered surfaces), fog (drifting atmosphere, fogline borders), lamp (amber accent �?CTA, active lamp line, ¥ on key numbers), ledger (serif titles, mono tabular amounts).
- Tokens (`@theme` in globals.css): night `#0a0e14`, ink `#e9e4d8`, lamp `#e3b341`, ember `#e2574c` (expense), jade `#6fbf8f` (income), mist `#111826`, veil `#1b2436`, fogline `#28324a`, dim `#8b93a7`.
- Typography: Noto Serif SC (display only), Noto Sans SC (body), Geist Mono (`tabular-nums`) for every amount via `.money`.
- Signature: `.lamp-line` (whitelisted positions only), fog layers on `body::before/::after`, `mist-in` route transition 380ms, `lamp-breathe` loading.
- Component classes in `@layer components`: `.panel .input .btn-primary .btn-ghost .link-subtle .chip .chip-active .eyebrow .money .skeleton`.
- Charts: ember/jade bars, lamp asset line, 8-color pie palette, fogline grid, veil tooltips.
- Copy tone: old bookkeeper �?verb-first buttons (保存/创建/确认导入), no 提交/确定, fixed vocabulary, counter word always �?

Taboo list (DESIGN.md §十一, 10 items): no new standard reds/greens/blues; no large lamp surfaces; �? lamp line per screen (nav exempt); no gradients/glow headlines; no `dark:` variants; no zinc/neutral/slate; no non-mono amounts; no animation >500ms (ambient fog/lamp/skeleton exempt but must go static under reduced-motion); no removed/non-lamp focus rings; no numbered decorations, emoji icons, or stacked skeuomorphic shadows.

## 5. Workflow & verification

1. Before touching Next.js conventions, read the relevant guide in `node_modules/next/dist/docs/` (this Next version may differ from training data).
2. Agents should delegate exploration/research to subagents; see `AGENTS.md` for the full workflow contract (commit discipline, message format, lint/build gates).
3. Verify: `npm run lint` before every commit; `npm run build` for build-affecting changes; UI changes additionally get a `DESIGN.md` changelog entry and the §十一 taboo self-check.
4. Accessibility acceptance: keyboard Tab pass (lamp focus rings visible), reduced-motion pass (no animation), 375px width pass (no horizontal scroll).
5. Commit message format: `<type>(<scope>): <summary>` �?types feat/fix/style/refactor/docs/chore; scopes design-system, dashboard, ledger, accounts, import, settings, login, charts, etc.
