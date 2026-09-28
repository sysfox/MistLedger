# MistLedger �?Project Structure & Architecture

> Single source of truth for the codebase layout, architecture, design system, and conventions. **Any agent may (and must) update this file** when it changes routes, data model, libs, components, or conventions �?keep it in the same commit as the code it describes.

MistLedger (雾夜�? is a Chinese-language personal bookkeeping PWA: "a lamp lit in fog at night to read the ledger." Track where every yuan goes and how much remains. Forced permanent night theme.

- Stack: Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 (`@theme` tokens) · Supabase (Postgres + Auth via `@supabase/ssr`) · Recharts · SheetJS (xlsx `0.20.3`, installed from the vendor CDN tarball `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` — [D-03] the npm `xlsx` line is frozen at 0.18.5 and will not receive the prototype-pollution / ReDoS fixes) · MUI (`@mui/material` + `@emotion/react` + `@emotion/styled` + `@mui/material-nextjs`，`/ledger` `/settings` `/login` 使用，详�?DESIGN.md §十三)
- Runtime notes: path alias `@/*` → `./src/*`; no `middleware.ts` — Next 16 uses `src/proxy.ts` instead. npm scripts: `dev`, `build`, `start`, `lint` (`eslint`), `typecheck` (`tsc --noEmit`), `test` (`node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs --test "src/**/*.test.ts"`), `test:taboo-guard`, `test:api-cache`, `bench`. Tests use Node's built-in runner only — no test framework dependency. `--import ./scripts/register-ts-resolve.mjs` installs the `.js` → `.ts` resolver remap in scripts/ts-resolve-hooks.mjs, needed because Node's type stripping does not perform TypeScript's extension substitution.

## 1. Directory layout

```
src/
  app/                  # Routes (all pages are server components unless noted)
    layout.tsx          # Fonts (Noto Serif SC / Noto Sans SC / Geist Mono via next/font),
                        # metadata, viewport (themeColor #0a0e14, viewportFit=cover),
                        # mounts ServiceWorkerRegister + SiteNav, safe-area bottom padding
    template.tsx        # Per-navigation remount wrapper: .page-enter "fog-develops" transition
    loading.tsx         # DELETED 2026-09-28 (contract close-out). A root-level
                        # loading.tsx wraps the whole `children` tree, so it sits
                        # OUTSIDE every route-level loading.tsx and wins the visible
                        # slot in the prerendered output. Measured on
                        # .next/server/app/*.html: the <main> of "/", "/data" and
                        # "/settings" had an identical SHA-256 (340ad480728c) — /data
                        # and /settings shipped the OVERVIEW skeleton (with
                        # "各账户余额 / 本月预算进度" sections neither page has), and
                        # /data additionally carried
                        # BAILOUT_TO_CLIENT_SIDE_RENDERING. After removal all five
                        # routes hash differently and each renders its own h1. The
                        # four pages have different shapes, so a root skeleton is
                        # necessarily a copy of one of them — wrong on the other
                        # three. See DESIGN.md §七.2 rule 1.
    error.tsx           # Route error boundary (client, retry button)
    global-error.tsx    # Root error boundary (renders its own html/body with bg-night)
    manifest.ts         # Web App Manifest (雾夜�? standalone, portrait, zh-CN,
                        # theme/background #0a0e14, icons 192/512 + maskable)
    page.tsx            # "/" Overview: static shell (no data fetch) rendering
                        # overview-client.tsx — client fetches GET /api/overview via
                        # useApiData and renders hero / trend / share / asset / balance /
                        # budget from the payload with the same page-skeleton fallbacks
                        # (3 lazy charts; month/day keys use Asia/Shanghai)
    login/page.tsx      # Client page; email/password sign-in + sign-up via browser
                        # Supabase client; MUI TextField/Button; friendly Chinese error
                        # mapping; surfaces the "confirm email" path instead of bouncing
    login/loading.tsx   # Centered card skeleton (wordmark + divider + tagline lines,
                        # 2 input blocks + button block) mirroring the login layout
    ledger/             # Manual bookkeeping: type-picker.tsx (the one TX_TYPES
                        # vocabulary + the APG radiogroup keyboard contract, see
                        # below), page.tsx (static shell) +
                        # ledger-client.tsx (client: GET /api/ledger via useApiData,
                        # intro subtitle + transaction form + recent-100 list with the
                        # same skeleton fallbacks / SectionError),
                        # loading.tsx (header/form-card/8-row list skeleton),
                        # transaction-form.tsx (client, useActionState, MUI: TextField/
                        # Select/Chip/Button), delete-transaction-button.tsx (MUI Dialog
                        # confirm), edit-transaction-button.tsx (inline edit panel, MUI,
                        # Dialog confirm), actions.ts (createTransaction /
                        # updateTransaction / deleteTransaction; all validate
                        # account/category ownership before writing; successes fire
                        # notifyDataChanged() so the client refetches)
                        # type-picker.tsx: the ONE TX_TYPES vocabulary (previously
                        # duplicated in transaction-form and the edit panel) and the
                        # WAI-ARIA radiogroup keyboard contract — roving tabindex
                        # (Tab enters the group once, lands on the selected item),
                        # arrows move AND select (per APG for single-select groups),
                        # Home/End. The old markup declared role="radiogroup" but
                        # gave every chip tabIndex=0 and no onKeyDown, i.e. announced
                        # a contract it did not honour. Focus rings are untouched:
                        # :focus-visible also matches programmatic .focus(), so the
                        # lamp ring still appears on arrow-key navigation
    data/               # Query & analytics. page.tsx is the static shell; [D-05]
                        # RESOLVED — it wraps <DataClient/> in
                        # <Suspense fallback={<DataShell/>}>. DataClient calls
                        # useSearchParams, so a static prerender must bail out of
                        # that boundary; the fallback used to be null, which left the
                        # prerendered subtree empty (the page showed only the nav
                        # until JS arrived). The boundary itself must stay: removing
                        # it fails the production build with "Missing Suspense
                        # boundary with useSearchParams". The per-section streaming
                        # this boundary was written for has been superseded by
                        # useApiData: all four pages fetch client-side through the
                        # shared api-cache, and the stream carries no payload
                        # data-client.tsx (client): parses URL searchParams (days snap
                        # 30/90/180 default 90, date/type/min/max/q validation, Shanghai
                        # dates for today/presets), fetches /api/data via useApiData —
                        # path changes with filters/presets trigger refetch; skeleton
                        # fallbacks while loading, SectionError per section on error;
                        # trend + asset curve (30/90/180 chips) + preset chips +
                        # QueryForm + results summary/body render from the API payload;
                        # list capped at 200 rows
        data-shell.tsx   # [D-05][D-17] THE single /data skeleton. Exports
                        # DataShell (wraps <main>) + DataShellBody (no <main>, for
                        # the client component's own <main> — nesting <main> is
                        # invalid HTML). Referenced by page.tsx's Suspense fallback,
                        # loading.tsx (a bare re-export) and data-client.tsx's
                        # loading branch, so the three can no longer drift. Contains
                        # no date: anything time-varying would freeze at build time
        query-params.ts  # [D-11][D-35] Pure URL-searchParams parse/validate/serialize,
                        # imported by BOTH src/app/api/data/route.ts and
                        # data-client.tsx — the server and the page must agree on
                        # what a filter means. Invalid values are dropped, not
                        # rejected (a hand-edited address bar must not break the
                        # page); key order is fixed so the query string is
                        # byte-stable. Exposes escapeLikePattern + escapeOrValue for
                        # the two real injection surfaces: PostgREST's .or() DSL and
                        # LIKE patterns
        query-params.test.ts # node:test suite for the above + the date-arithmetic
                        # cases (month end incl. leap years, cross-year, and the
                        # "visited the day after the build" preset assertion)
        payload.ts       # [D-15] Response payload types for /api/data, with the
                        # embedded-relation shape collapsed to one named `Relation`
                        # type so the three FK fields stop re-nesting {name}[]|{name}|null
        presets.ts       # buildPresets(today) — pure function taking "today" as an
                        # ARGUMENT rather than calling new Date() inside. That makes
                        # "the build day" inexpressible at the type level, where a
                        # comment would only survive until someone moved the code
        query-form.tsx   # Custom-query form; all conditions live in the URL
                        # searchParams (shareable, and back/forward work)
        query-form-fallback.tsx # Skeleton mirroring query-form.tsx (same skeleton
                        # one-source rule as data-shell)
    settings/           # Accounts + categories + budgets + bill import unified: static
                        # shell page.tsx + settings-client.tsx (client: GET /api/settings
                        # via useApiData; accounts / categories / budgets / import render
                        # from the payload with the same skeleton fallbacks / SectionError;
                        # the no-data create-category form stays in the shell) (anchors
                        # #accounts / #import; account-actions.ts, import-actions.ts);
                        # loading.tsx (header/accounts/categories/budgets/import skeletons);
                        # controls on MUI: forms use TextField/Select/Button,
                        # delete/adjust/confirm flows use MUI Dialog;
                        # import-client.tsx parses files in the browser (preview table
                        # stays native); adjust-balance-button.tsx adjusts account
                        # balance inline via initial_balance rewrite + Dialog confirm;
                        # every mutating child fires notifyDataChanged() on success.
                        # Row/form children: create-account-form, create-category-form,
                        # create-budget-form, delete-account-button,
                        # delete-category-button, delete-budget-button,
                        # toggle-account-button, ensure-default-categories-button —
                        # each is a client component owning exactly one MUI confirm
                        # dialog and one notifyDataChanged() call. delete-category-button
                        # [D-41] pairs its 44px touch target with margin: "-6px -14px":
                        # touch size governs reachability, visual size governs density,
                        # and they are allowed to disagree
    api/                # JSON data layer for the static shells (all force-dynamic, nodejs):
        overview/route.ts   # GET /api/overview — dashboard_snapshot(6mo/30d) + active
                            # accounts + categories + current-month budgets (Promise.all)
        ledger/route.ts     # GET /api/ledger — active accounts + categories + last 100 txs
        data/route.ts       # GET /api/data?days&from&to&type&cat&acc&min&max&q —
                            # dashboard_snapshot(12mo/days) + accounts + categories +
                            # filtered_tx_stats + filtered list (≤200); params validated
                            # server-side (same rules the page used)
        settings/route.ts   # GET /api/settings — accounts + account_balances RPC +
                            # categories + month budgets + last 10 batches + rules
    globals.css         # Design tokens (@theme) + component classes + fog/lamp effects
  proxy.ts              # Edge auth gate (Next 16 replacement for middleware.ts), now
                        # only for /login (bounce authenticated users back) — app pages
                        # are static shells with no data, so the proxy's Supabase
                        # getUser roundtrip no longer blocks their first byte; the API
                        # layer is the auth boundary (401 → client redirects to /login)
  components/
    site-nav.tsx        # Desktop top bar; mobile sticky top bar (wordmark + sign-out,
                        # safe-area-inset-top for notch) + fixed bottom tab bar (4 links),
                        # active lamp-line, sign-out via browser Supabase, hidden on /login.
                        # All three bars are `.material-bar` fog surfaces (backdrop-blur)
                        # with a soft drop shadow instead of a hairline border; the mobile
                        # top bar (sticky) adds a scroll-triggered `.scroll-edge` fog fade
                        # (rAF-throttled scrollY>4 -> data-scrolled, no border)
    dashboard-charts.tsx        # Recharts: TrendChart (bar, ember/jade), AssetChart
                        # (line, lamp), ShareChart (pie, 8-color palette); reduced-motion
                        # aware. [D-09] ChartFigure keeps the sr-only <figcaption>
                        # data summary OUTSIDE the role="img" element and links it
                        # with aria-describedby — role="img" makes its whole subtree
                        # presentational, so a nested figcaption was never announced.
                        # [D-28] the axis line uses --color-dim (>=3:1 on mist, the only
                        # clue that anchors a point to a tick); the decorative
                        # horizontal grid keeps the faint fogline treatment
    dashboard-charts-lazy.tsx   # next/dynamic (ssr:false) wrappers + skeleton
    page-skeleton.tsx   # Server-component skeleton parts for route loading.tsx:
                        # SkeletonLine/Panel/Chart/Row/Bar/Chip, all built on the
                        # .skeleton class (veil block + skeleton-pulse, reduced-motion
                        # static); used by root + 4 route loading.tsx to mirror real
                        # page layouts (no lamp dot, no visible text)
    confirm-submit-button.tsx # [D-04] The ONE second-confirmation submit. Six
                        # verbatim copies of "intercept submit -> Dialog ->
                        # requestSubmit() -> reset armedRef" (~300 lines) collapsed
                        # into one; the P1 bug had been copied six times. Three
                        # non-obvious points: (1) the confirm button carries
                        # data-confirm-submit="1" on the submitter, so "was this the
                        # user's confirm click" is a property OF THE EVENT rather than
                        # a flag the component must remember to reset — which also
                        # means no submit path can bypass confirmation (Enter's
                        # implicit submit has submitter === null and is still caught,
                        # since the confirm button lives in a Portal and is never the
                        # form's default button); (2) the trigger is type="button"
                        # so it calls reportValidity() itself, restoring the exact
                        # validation timing of the old type="submit"; (3) the confirm
                        # button associates via form={formId} (native) rather than
                        # requestSubmit() (an imperative bypass). Props expose only
                        # decisions (action, label, confirmColor, extra validation),
                        # never mechanism; confirmColor?: "primary" | "error" makes
                        # "reversible actions must not be error" a compile error
    section-error.tsx   # [D-06] role="alert" panel for a failed section. Props are
                        # deliberately load-bearing: onRetry renders a button ONLY
                        # when there is something to retry (a button with no action
                        # is decoration, not a control), and label is required so N
                        # identical "this section failed to load" panels stay
                        # distinguishable — and so the same role="alert" is not
                        # announced N times
    service-worker-register.tsx # Registers /sw.js on window load (silent failure).
                        # [D-37] Watches updatefound / registration.waiting /
                        # controllerchange and renders a bottom "有新版本，刷新" bar
                        # (role="status", .panel + .btn-primary/.btn-ghost) whose
                        # 刷新 button posts SKIP_WAITING and reloads once; 稍后
                        # dismisses it for this session
    mui-theme.tsx       # MUI 主题 ("use client")：palette/typography/components
                        # 全量映射 DESIGN tokens（灯/余烬/夜空/雾面/纱面/雾线/远雾），
                        # 复刻 .input/.btn 观感；warning/info 指回灯色/远雾；
                        # Backdrop 雾化（夜空 70% + blur(6px)，reduced-transparency 下降级）
    mui-gate.tsx        # "use client"：[D-10] 按 pathname 条件挂载 MuiProvider 并用
                        # next/dynamic 拆包，使 / 与 /data 不再为 emotion + 主题付费；
                        # 不移动任何路由目录（避免跨包 import 破坏）
    mui-provider.tsx    # "use client"：AppRouterCacheProvider
                        # (@mui/material-nextjs/v16-appRouter) + ThemeProvider +
                        # CssBaseline；layout 用其包裹 SiteNav/children
  lib/
    supabase/client.ts  # Browser client (createBrowserClient<Database>, publishable
                        # key) — [D-15] the generated Database generic is wired in,
                        # so from()/rpc() return concrete row/RPC shapes instead of Json
    supabase/server.ts  # Server client with cookie getAll/setAll adapters, also
                        # createServerClient<Database>
    supabase/database.types.ts  # Generated Database type, incl. the Functions (RPCs)
                        # below; the single source of truth for every .rpc() argument
    api/client.ts       # apiGet (same-origin GET with cookies) + notifyDataChanged
                        # (fires the "mistledger:reload" event) + setSessionLostHandler.
                        # Status contract [D-12]: 401 -> wipe the cache via the
                        # registered handler, then location.replace("/login"); 503 ->
                        # retryable ApiError and stay on the page (an upstream Supabase
                        # blip must not throw away a half-filled form). [D-33] other
                        # !ok responses surface the route's own Chinese {error} copy
                        # (readServerError), falling back to a generic message.
                        # ApiError carries {status, retryable}
    api/session.ts      # requireApiSession (Route Handler auth guard: getClaims;
                        # collects Supabase token refreshes), isApiSession (type guard),
                        # sessionResponse (JSON + refreshed cookies). [D-12] 401
                        # {error:"unauthenticated"} for an absent/expired session vs
                        # 503 {error:"service-unavailable"} when Supabase is
                        # unreachable — a transient fault is not a logout
    api/api-cache.ts    # Path-keyed client cache behind useApiData. Dependency-free
                        # (no React, no window, no relative imports) so node --test can
                        # drive it directly. Owns [D-01] per-entry Supabase owner tag +
                        # reset(), [D-14] monotonic seq + AbortController so a superseded
                        # response can never overwrite a newer one, [D-31] peek() never
                        # creates an entry (no writes during render), [D-32] LRU by
                        # lastAccess + a TTL, both limits exported as constants.
                        # Subscriptions live outside the LRU: a mounted component keeps
                        # being notified even after its payload is evicted, so it
                        # refetches instead of rendering a ghost
    api/session-outcome.ts   # [D-12][WP6-02] The 401-vs-503 decision as a PURE
                        # function, in its own dependency-free module. It is separate
                        # from session.ts because session.ts imports next/server,
                        # which node --test cannot load — so the one branch that
                        # actually matters was untestable. Key fact it encodes:
                        # @supabase/auth-js does NOT throw on an upstream fault.
                        # getClaims (and _refreshAccessToken beneath it) catch their
                        # own errors and return {data:null, error}, and
                        # AuthRetryableFetchError extends AuthError, so isAuthError()
                        # is true for it. A naive `if (error || !claims) return 401`
                        # therefore misreads "expired token + Supabase blip" as a
                        # logout and discards the form the user was filling in
    api/session-outcome.test.ts  # Builds the REAL auth-js error classes (not
                        # stand-ins) because the bug is a property of that class
                        # hierarchy — a fake error would not reproduce it
    api/client.test.ts     # [WP6-01] apiGet's 401 branch and its seam with the
                        # cache's session-lost handler. client.ts has no React/DOM
                        # import, so node --test can drive it with fetch/window
                        # stubbed — and that seam is exactly what a cache-only
                        # suite cannot reach
    api/api-cache.test.ts   # [D-01]/[D-14]/[D-31]/[D-32] unit suite (node:test)
    api/use-api-data.ts # useApiData<T>(path) built on useSyncExternalStore over
                        # api-cache: data/error/loading/reload. Pure during render —
                        # entry creation and fetching happen in subscribe() (commit
                        # phase). Refetches on path change and on "mistledger:reload"
                        # (silent refresh, no skeleton flash). Also exports
                        # resetApiCache() (sign-out) and setApiCacheOwner(userId)
                        # (defence in depth: drop entries fetched under another id)
    ledger/constants.ts # ACCOUNT_TYPES, CHANNELS, accountTypeLabel/channelLabel,
                        # DEFAULT_CATEGORIES seed (expense: 餐饮/交�?购物/学习/宿舍/娱乐;
                        # income: 生活�?兼职/红包)
    ledger/format.ts    # [D-08] formatMoney (zh-CN, 2dp) + formatSignedMoney(n, kind)
                        # + amountSign(n, kind) + the MINUS / YUAN / AMOUNT_PREFIX
                        # constants. The sign lives HERE, not at the call sites:
                        # hand-assembling "sign + ¥ + digits" at each call site is
                        # what produced "¥−12.50" (sign after ¥, ASCII hyphen), and
                        # formatSignedMoney swallows the kind prefix on n < 0 so a
                        # stray negative from an RPC can never render "−−¥"
    ledger/format.test.ts   # node:test suite for the above, incl. the migration
                        # equivalence check ("old call sites produced byte-identical
                        # output") and a "no ASCII hyphen inside an amount" assertion.
                        # It imports the real implementation — the previous
                        # .hermes/audits/format-check.mjs asserted against its own
                        # COPY of format.ts, so it could never fail
    ledger/stats.test.ts   # [D-25] coverage for the pure stats library (node:test):
                        # accountBalances (incl. the transfer branch and the
                        # map.get(...)! guard), filterTxs, summarizeTxs, monthlyTrend,
                        # categoryShare, assetCurve, monthKey/lastMonths
    ledger/stats.ts     # Pure-function library: monthlyTrend, categoryShare, assetCurve,
                        # filterTxs, summarizeTxs, accountBalances (single-pass; TxLike.type
                        # is a closed union). Retained for reuse/tests �?pages now aggregate
                        # via the RPCs instead
    ledger/import-parse.ts  # Parsers: parseAlipay (CSV GBK/UTF-8-BOM/xlsx), parseWechat
                        # (xlsx), parseCCB (建行 hqmx xls); parseBillFile entrypoint lazily
                        # imports xlsx (code-split) and decodes CSV with TextDecoder.
                        # [D-03] MAX_BILL_FILE_BYTES = 20MB, checked against
                        # file.size *before* the bytes are read, so an oversized upload
                        # is rejected with「文件太大，请按月份拆分后再导」before any
                        # decode work reaches the third-party parser
public/
  sw.js                 # Service worker (cache "mistledger-v3"): install-time precache of
                        # manifest + icons; static assets cache-first; icons/manifest
                        # stale-while-revalidate (background refresh kept alive via
                        # event.waitUntil); navigations network-first + built-in offline
                        # fallback page; authenticated (login-walled) pages are NOT
                        # precached — offline fallback is the built-in page by design.
                        # [D-36] isCacheableResponse drops the old
                        # response.headers.get("set-cookie") branch: Set-Cookie is a
                        # FORBIDDEN response header name, so it is always filtered out
                        # of Headers inside a SW and the guard never fired once. The real
                        # contract is cache-control (no-store/private are never
                        # persisted) plus an explicit /login navigation exclusion —
                        # request.credentials is deliberately NOT used as the signal,
                        # since a navigation request is always credentials:"include".
                        # [D-37] install does NOT call skipWaiting(): a new worker parks
                        # in registration.waiting until the page sends the
                        # "SKIP_WAITING" message (the update prompt in
                        # service-worker-register.tsx), so a deploy can never pair a
                        # cached old HTML shell with new chunks mid-session
  icons/                # PWA icons 192/512 (+ maskable)
data/                   # Personal bank statements �?gitignored, never commit
```

Config: `next.config.ts` sets `experimental.staleTimes.dynamic: 30` (dynamic routes stay fresh in the client router cache for 30 s after navigation, avoiding refetch flashes on back/forward; `static` left at the Next default), `eslint.config.mjs` (flat config, core-web-vitals + TS), `tsconfig.json` (strict, bundler resolution), `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only �?never service_role).

## 2. Routes

| Route | Purpose | Notes |
|---|---|---|
| `/` | Overview (总览) | Static prerendered shell + `overview-client.tsx`; data via `GET /api/overview` (useApiData); hero/trend/share/asset/balance/budget from the payload; budget bars; 3 lazy charts |
| `/ledger` | Record (记账) | Static shell + `ledger-client.tsx`; data via `GET /api/ledger`; intro + form + recent 100 rows; edit/delete with MUI Dialog confirm; controls on MUI; writes validate owner |
| `/data` | Query (数据) | Static shell + `data-client.tsx`; URL-searchParams filters parsed client-side, data via `GET /api/data` (useApiData refetch on param change); snapshot/stats/transactions from the API; list ≤ 200 |
| `/settings` | Settings (设置) | Static shell + `settings-client.tsx`; data via `GET /api/settings`; Accounts (#accounts) · categories · budgets · bill import (#import); anchors for in-page sections; controls on MUI with Dialog confirmations; balances via `account_balances` RPC + inline balance adjustment (adjusts `initial_balance` by the delta), imports via atomic `import_transactions` RPC |
| `/login` | Auth | Client page; the only route the proxy still gates (bounces authenticated users back to `/`); controls on MUI |

| API route | Purpose | Notes |
|---|---|---|
| `GET /api/overview` | Overview payload | `dashboard_snapshot(6mo/30d)` + active accounts + categories + current-month budgets, one `Promise.all`; cookie-session auth (`getClaims`, 401) |
| `GET /api/ledger` | Ledger payload | Active accounts + categories + last 100 transactions |
| `GET /api/data` | Query payload | days snapped to 30/90/180 (default 90) + validated from/to/type/cat/acc/min/max/q; `dashboard_snapshot(12mo)` + `filtered_tx_stats` + filtered list ≤ 200 |
| `GET /api/settings` | Settings payload | Accounts + `account_balances` + categories + month budgets + last 10 batches + rules |

Auth gating: `src/proxy.ts` now gates only `/login` (redirects authenticated users to `/`); the matcher additionally excludes `_next/static`, `_next/image`, `favicon.ico`, `sw.js`, `manifest.webmanifest`, image assets, `/api/*`, and the four app pages. App pages (`/`, `/ledger`, `/data`, `/settings`) are statically prerendered skeletons with no data — the `proxy`'s Supabase `getUser` roundtrip no longer blocks their first byte. The API layer is the auth boundary: `requireApiSession` validates the cookie session per request (`getClaims`) and distinguishes **401 `{error:"unauthenticated"}`** (session absent or expired) from **503 `{error:"service-unavailable"}`** (Supabase unreachable) — [D-12] a transient upstream fault must not read as a logout. The browser client (`apiGet`) bounces 401s to `/login` *after* wiping the client cache, stays put and throws a retryable `ApiError` on 503, and RLS scopes every query. Server actions keep their `getUser()` + ownership checks and `revalidatePath` calls; client components additionally refetch via `notifyDataChanged()`. Token refreshes performed in API routes ride back on the JSON response (`sessionResponse`).

Client cache boundary [D-01]: `src/lib/api/api-cache.ts` is a module-level store that outlives every component, which is exactly why it needs the two reset hooks. `useApiData` wires `setSessionLostHandler(cache.reset)` so any 401 wipes it; `resetApiCache()` is exported for the sign-out path in `components/site-nav.tsx` and `setApiCacheOwner(userId)` tags entries with the signed-in user id and drops any fetched under a different one. Sign-out wiring **is** live: `components/site-nav.tsx` calls `resetApiCache()` in its sign-out path, alongside the 401 handler `useApiData` registers via `setSessionLostHandler(cache.reset)`. Both entry points clear the cache, so no cross-account bleed on either.

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
- Typography: Noto Serif SC (display only), Noto Sans SC (body), Geist Mono (`tabular-nums`) for every amount via `.money`; headings and `.money` carry size-specific tracking/leading (`@layer base` in globals.css, tighter as type grows).
- Signature: `.lamp-line` (whitelisted positions only), fog layers on `body::before/::after`, `mist-in` route transition 380ms, `lamp-breathe` loading.
- Component classes in `@layer components`: `.panel .input .btn-primary .btn-ghost .link-subtle .chip .chip-active .eyebrow .money .num .tag .skeleton .lamp-line .lamp-dot .material-bar .material-bar-top .material-bar-bottom .scroll-edge .page-enter`.
- **Three mutually exclusive numeric/label classes** — this is the rule most easily got wrong, so it is repeated here: `.money` = amounts ONLY (mono + tabular + tight tracking); `.num` = counts ONLY (tabular-nums, same body font — a count needs digit-width alignment, not a monospace *family*, and "共 1,280 笔" in mono misreads as a balance); `.tag` = read-only labels ONLY (`.chip`'s shape with zero hover/active/focus, because a hover on something you cannot click is a promise the UI does not keep).
- Charts: ember/jade bars, lamp asset line, 8-color pie palette, fogline grid, veil tooltips. The palette's 8th slot is `var(--color-dim)`, not a hardcoded hex — a baked hex bypasses both the `prefers-contrast: more` override and the §十一 #6 "no slate ramp" rule (the old `#94A3B8` was literally `slate-400`).
- **Pending wiring (contract close-out 2026-09-28)**: `.num` and `.tag` are defined in `globals.css` and registered here, but their call sites are owned by the in-flight page packages, so they were deliberately left alone — `data-client.tsx` (counts, currently `tabular-nums`), `settings-client.tsx` (3 counts still on `.money`, plus the keyword→category `<li>` still on hand-written static utility classes), `import-client.tsx` (4 counts still on `.money`), and `dashboard-charts.tsx` (`PALETTE[7]`). Full table in `.hermes/audits/integration-report.md` §7.
- Copy tone: old bookkeeper �?verb-first buttons (保存/创建/确认导入), no 提交/确定, fixed vocabulary, counter word always �?

Taboo list (DESIGN.md §十一, 10 items): no new standard reds/greens/blues; no large lamp surfaces; �? lamp line per screen (nav exempt); no gradients/glow headlines; no `dark:` variants; no zinc/neutral/slate; no non-mono amounts; no animation >500ms (ambient fog/lamp/skeleton exempt but must go static under reduced-motion); no removed/non-lamp focus rings; no numbered decorations, emoji icons, or stacked skeuomorphic shadows.
All ten are machine-enforced by `eslint.config.mjs` (`mistledger/design-taboos`): a local `no-taboo-classnames` rule scans string literals and template elements for the banned ramps, the standard palette and `dark:` variants, plus `no-restricted-imports` on the external palettes and `no-restricted-syntax` on `window.confirm` / `alert()`. `npm run test:taboo-guard` lints a throwaway violating file per guard and asserts it actually fires, so a rule that silently stops working fails the suite instead of passing review.

## 5. Workflow & verification

1. Before touching Next.js conventions, read the relevant guide in `node_modules/next/dist/docs/` (this Next version may differ from training data).
2. Agents should delegate exploration/research to subagents; see `AGENTS.md` for the full workflow contract (commit discipline, message format, lint/build gates).
3. Verify: `npm run lint` + `npm run typecheck` before every commit; `npm run build` for build-affecting changes; `npm test` (pure-logic unit tests) plus `npm run test:taboo-guard` and `npm run test:api-cache` before committing anything that touches `src/lib/**`, the eslint config or the client cache; UI changes additionally get a `DESIGN.md` changelog entry and the §十一 taboo self-check.
4. Performance: `npm run bench` (= `node scripts/bench.mjs [--base URL] [--runs N] [--warmup N] [--cookie "..."] [--json] [--no-threshold]`) measures page TTFB/total and API latency against a running `next start` (default port 3000). [D-38] it now runs a discarded warmup pass per target, labels anonymous `/api/*` rows as `401(auth)` (a bare run measures the cost of *constructing* a 401, not the data path) and tells you to pass `--cookie` / `BENCH_COOKIE`, emits machine-readable JSON under `--json`, and asserts per-target p95 budgets (exit 1 on breach unless `--no-threshold`). The build output route table (○ static vs ƒ dynamic) is the architectural check: the four app pages must stay ○.
5. Accessibility acceptance: keyboard Tab pass (lamp focus rings visible), reduced-motion pass (no animation), 375px width pass (no horizontal scroll).
6. Commit message format: `<type>(<scope>): <summary>` — types feat/fix/style/refactor/docs/chore; scopes design-system, dashboard, ledger, accounts, import, settings, login, charts, api, bench, etc.
