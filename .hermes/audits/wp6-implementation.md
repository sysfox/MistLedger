# WP-6 施工报告 · 平台 / 数据层包（platform）

- 审查基线：`2447d67`
- 承接：上一任 agent 中途断电，本轮只做收尾（补 tsc 回归、清 lint、补齐未落地的验证脚本、完成 [D-39] 文档），已合格部分只做核对不重做
- 硬约束遵守：无任何 git 写操作（无 add / commit / checkout / stash）；未执行 `next build`；`DESIGN.md` 未改（changelog 由 WP-1 提供 fragment）
- 文件所有权：仅动 `src/lib/api/**` · `src/lib/supabase/{client,server}.ts` · `public/sw.js` · `src/components/{service-worker-register,dashboard-charts}.tsx` · `src/lib/ledger/import-parse.ts` · `src/lib/ledger/stats.test.ts` · `scripts/**` · `eslint.config.mjs` · `package.json` · `STRUCTURE.md` · `README.md` · `src/app/api/data/route.ts`（仅 tsc 回归） · `.hermes/audits/**`

---

## 1. 逐条状态表

| ID | 状态 | 落点 | 核对方式 |
|---|---|---|---|
| [D-01] 跨账号清缓存 | **部分完成，缺一处接线** | `src/lib/api/api-cache.ts`（每条 entry 带 `owner`、`setOwner()` 丢弃他账号条目、`reset()` 全清）、`src/lib/api/use-api-data.ts:19`（`setSessionLostHandler(() => cache.reset())`）、`client.ts:67`（401 分支先 `onSessionLost?.()` 再跳转） | `npm run test:api-cache` 全绿；**但 `site-nav.tsx` 的 `signOut` 仍未调用 `resetApiCache()`**，见 §3 |
| [D-03] xlsx 升级 + 20MB 上限 | ✅ 完成 | `package.json:27`（`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`）、`import-parse.ts:220`（`MAX_BILL_FILE_BYTES = 20 * 1024 * 1024`）、`:256`（读字节**之前**按 `file.size` 拒绝）、`:223`（`assertFileSize` 二次兜底） | `npm ls xlsx` → `xlsx@0.20.3`；上限检查在 `arrayBuffer()` 之前 |
| [D-09] 图表摘要移出 `role=img` | ✅ 完成 | `dashboard-charts.tsx:73-105` 新增 `ChartFigure`：`role="img"` 只包图，`<figcaption class="sr-only">` 移出并用 `aria-describedby` 关联；无数据时退回无 role 的 `<figure>` | 三处调用点（`TrendChart` / `AssetChart` / `ShareChart`）均已改用；DOM 中 `figcaption` 不在 `[role=img]` 子树内 |
| [D-12] 401/503 分流 | ✅ 完成 | `session.ts:47-58`（`createSupabaseForRequest` 抛 → 503；`getClaims` 抛 → 503；无/过期 claims → 401）、`client.ts:75-78`（503 抛可重试 `ApiError`，不跳 `/login`）、`client.ts:19-23`（`ApiError` 带 `retryable`） | 代码走查；`ApiError.retryable = status === 0 \|\| status >= 500` |
| [D-14] requestId 竞态 | ✅ 完成 | `api-cache.ts:168-199` `startFetch`（单调 `seq` + `AbortController`）、`:135-142` `commit`（`entry.seq !== seq` 直接丢弃）、`:108`（`dropEntry` 也 `seq += 1` 作废在途提交） | `npm run test:api-cache` 的 [D-14] 段 4 项全绿，含「忽略 abort 信号的旧请求也不覆盖新数据」 |
| [D-25] eslint 禁忌守卫 + stats 覆盖 | ✅ 完成（超出原要求） | `eslint.config.mjs:49-156`（本地 `mistledger/no-taboo-classnames` 扫 Literal/TemplateElement + `no-restricted-imports` + `no-restricted-syntax`）、`scripts/check-taboo-guard.mjs`、`src/lib/ledger/stats.test.ts`（250 行 / 8 个 describe） | `npm run test:taboo-guard` 12/12 通过；`npm test` 44/44 通过 |
| [D-28] 图表轴线对比度 | ✅ 完成 | `dashboard-charts.tsx:31-37`：`AXIS_LINE` 从 `var(--color-fogline)`（在 mist 上 1.39:1）改为 `var(--color-dim)`（≥3:1），装饰性 `GRID` 保持雾线；tooltip 边框同步提亮 | 常量已改，网格线设计意图未破坏 |
| [D-31] render 纯度 | ✅ 完成 | `use-api-data.ts:63`（`getSnapshot` 只调 `cache.peek`，不建 entry）、`api-cache.ts:227-233`（`peek` 对未知 path 返回冻结的 `EMPTY_SNAPSHOT`，只更新 `lastAccess`）、entry 创建收敛到 `subscribe()`（commit 期）与显式 `reload()` | `npm test` 的 [D-31] 段 3 项：`peek` 不分配 entry、快照 identity 稳定、重复读不增长 |
| [D-32] LRU+TTL | ✅ 完成 | `api-cache.ts:34-36`（`API_CACHE_MAX_ENTRIES = 100`、`API_CACHE_TTL_MS = 5min` 导出为常量）、`:144-153` `evictIfNeeded`（按 `lastAccess` 排序、**跳过有订阅者的 path**）、`:155-166` `sweep`、`:121-125` 在 insert 时就执行上限而非惰性 | `npm run test:api-cache` 的 [D-32] 段：200 组合后 `size=100`、TTL 到期 `swept=100 size=0`、在用 path 不被淘汰 |
| [D-33] 服务端错误文案透传 | ✅ 完成 | `client.ts:45-58` `readServerError`（解析 `{error}` 且要求含中文，避免把 `"unauthenticated"` 之类机器码当文案）、`:79-81` | 502 时四个 route 的精确文案可达用户 |
| [D-36] 删除失效的 set-cookie 守卫 | ✅ 完成 | `sw.js:91-116`：`isCacheableResponse(response, request)` 删掉 `headers.get("set-cookie")`，改为 `/login` 导航显式排除 + `cache-control` no-store/private；注释写明「`Set-Cookie` 是 forbidden response header，SW 里恒为 null」以及为何**不**用 `request.credentials`（导航恒为 `include`） | `grep -n "set-cookie" public/sw.js` 仅剩注释 |
| [D-37] 去掉 install 期 skipWaiting + updatefound 提示 | ✅ 完成 | `sw.js:13-19`（install 不再 `skipWaiting`，保留 `:49-51` 的 `SKIP_WAITING` 消息通道）、`sw.js:1`（缓存名 `v2`→`v3`）、`service-worker-register.tsx` 全量重写（`updatefound` / `registration.waiting` / `controllerchange` 三路检测 → 底部 `role="status"` 的「有新版本，刷新」条，刷新按钮 post `SKIP_WAITING` 后 `location.reload()`，「稍后」本会话内收起） | 组件 cleanup 完整移除三个监听器 |
| [D-38] bench 401 标注 / warmup / `--json` | ✅ 完成 | `bench.mjs:93-101`（每目标丢弃式 warmup，默认 2）、`:83-84`（`authOnly`）、`:145`（状态列渲染 `401(auth)`）、`:155-160`（匿名时提示加 `--cookie`/`BENCH_COOKIE`）、`:42-53` + `:113-117`（p95 阈值断言，超阈退出 1）、`:119-134`（`--json`）、`--no-threshold` | 未实跑（需 `next start`，见 §3） |
| [D-39] 文档 | ✅ 完成 | `STRUCTURE.md` 全量核对（48 条路径逐条存在性验证，0 失效）+ 按新架构重写；`README.md` 功能列表按 5 条路由重写 | 见 §4 |
| [D-15]（半条，WP-2/3/4/5 共担） | ✅ 本包部分完成 | `supabase/client.ts:11`、`supabase/server.ts:12`、`api/session.ts:14` 接入 `Database` 泛型 | 触发的 tsc 回归由本包修掉（见 §2）；4 个页面的 `as unknown as` 归各包 |

---

## 2. 本轮新补 / 修的内容

### 2.1 tsc 回归（8 errors → 0）

接入 `Database` 泛型后，`supabase.rpc("filtered_tx_stats", …)` 的参数类型来自 `database.types.ts:279-291`，八个参数全部声明为 `p_x?: string | undefined`（可选 + 不接受 `null`），而 `src/app/api/data/route.ts:67-74` 传的是 `filter.x ?? null` → 8 个 TS2322。

**修法**：`src/app/api/data/route.ts:66-84` 在构造 RPC 参数时把「无值」直接表达为 `undefined`（即省略该 key），不再用 `?? null` 兜成 null。生成签名是唯一真相来源，**没有用 `as any` / `@ts-ignore` / 改 `database.types.ts`**。

行为等价性依据：PostgREST 把「缺失的 key」映射到 SQL 函数自身的 `DEFAULT`（这八个参数全是 `DEFAULT NULL`），因此 `undefined` 与 `null` 在 wire 上等价。

### 2.2 eslint warning（1 → 0）

`src/lib/api/api-cache.ts:148` 的 `for (const [path, entry] of byAge)` 里 `entry` 从未使用（`evictIfNeeded` 只用 `path` 与 `subs`）→ 改为 `for (const [path] of byAge)`。

### 2.3 三个验证脚本从「跑不起来」修到真通过（这是断电时最大的坑）

**问题**：`npm test` 与 `npm run test:api-cache` 上一任**从未成功运行过**。Node 的内置 TS 支持（`--experimental-strip-types`）只做类型擦除，**不做 TypeScript 的扩展名替换**，而测试文件按 bundler 世界的正确写法 import `./api-cache.js`，Node 直接抛 `ERR_MODULE_NOT_FOUND: ...\src\lib\api\api-cache.js`。两个测试文件同时失败，`pass 0 / fail 2`。

**修法**（新增两个文件，都在 `scripts/**` 所有权内）：

- `scripts/ts-resolve-hooks.mjs` —— 解析期把相对路径的 `./x.js` 重映射到 `./x.ts`；**只在 `.ts` 目标真实存在时才改写**，写错的路径照常报真错。导出同步 `hooks()`（`module.registerHooks`）与异步 `resolve()`（`module.register` 旧版回退）两份实现，共用同一段逻辑。
- `scripts/register-ts-resolve.mjs` —— `--import` 入口，优先 `registerHooks`，否则回退 loader 线程。
- `package.json:11,13` —— `test` 与 `test:api-cache` 加 `--import ./scripts/register-ts-resolve.mjs`。

**为什么不给测试文件改写成 `./api-cache.ts`**：那需要 tsconfig 开 `allowImportingTsExtensions`，而 tsconfig 不在本包所有权内，且会把测试运行器的关注点泄漏进应用的编译配置；用 `new URL()` + 动态 `import()` 能跑但丢掉测试依赖的静态类型。放在解析层最干净，且 `src/` 其余代码保持与 Next/webpack/tsc 一致的 `.js` 写法。

### 2.4 [D-39] 文档

见 §4。

---

## 3. 未完成项与原因

| 项 | 原因 |
|---|---|
| **`site-nav.tsx` 的 `signOut` 未接 `resetApiCache()`** | 文件不属于本包（WP-1 拥有 `src/components/site-nav.tsx`）。这是 [D-01] 唯一剩下的缺口：**401 路径已完全闭合（任何 `/api/*` 返回 401 都会 `cache.reset()`），但用户主动点「退出」走的是 `supabase.auth.signOut()` + `router.push("/login")` 的纯客户端跳转，不发 401，Map 会存活**。A 登出后 B 登入仍可能命中 A 的 `/api/overview` 缓存。请 WP-1 在 `signOut` 里 `await supabase.auth.signOut()` 之后加一行 `resetApiCache()`（从 `@/lib/api/use-api-data` 导入）。`setApiCacheOwner(userId)` 是可选的第二道防线，同样尚未接线。 |
| **`npm run bench` 未实跑** | 需要一个运行中的 `next start`，而本轮明确禁止 `next build`，起不了被测服务。脚本本身已按 [D-38] 改完并通过 `npx eslint` 与 tsc；`--json` / `--warmup` / 401 标注 / 阈值断言均为代码走查确认，未产生运行输出。 |
| **四个页面的 `as unknown as` 未清零** | [D-15] 是跨包项，4 个消费点分别属 WP-2/4/5。本包只交付了 `Database` 泛型接入 + 修掉它引发的回归。 |
| **`catchSection` / `formatBudget` 死代码未删** | 分别在 `src/components/section-error.tsx`（WP-1）与 `src/lib/ledger/format.ts`（WP-1），不属本包。[D-25] 的验收标准里点名了它们，请 WP-1 一并删除。 |
| **`src/lib/ledger/stats.ts` 仍无生产调用点** | [D-25] 要求「删死代码或补测试」，本包选了补测试（`stats.test.ts` 覆盖 `accountBalances` 的转账分支与非空断言分支等 8 组）。文件属 WP-3，是否删由其决定。 |
| **[D-05] `/data` 的 `Suspense fallback={null}` 空白首屏** | 属 WP-3。本包在 `STRUCTURE.md:48-56` 如实记录了该边界的现状与后果，并注明分区 Suspense 流式已被 `useApiData` 取代。 |

### 需其他包接线的点（汇总）

1. **WP-1** → `site-nav.tsx` 的 `signOut` 调 `resetApiCache()`（[D-01] 收口，阻塞项）。
2. **WP-3** → `src/app/api/data/route.ts` 的 `acc`/`cat` UUID 校验（[D-11]）；`stats.ts` 死代码去留（[D-25]）。
3. **WP-2/4/5** → 各自页面清 `as unknown as`（[D-15]）。
4. **WP-1** → `section-error.tsx` 的 `catchSection`、`format.ts` 的 `formatBudget` 删除（[D-25]）。
5. **WP-1** → `DESIGN.md` changelog 需补本轮条目（静态化改造后续 + `useApiData` 取代分区流式 + 图表摘要/`role=img` + SW 更新提示）。本包按约束**未写 DESIGN.md**。

---

## 4. [D-39] 文档核对明细

### STRUCTURE.md

- **逐条存在性验证**：脚本解析 §1 目录树的缩进结构还原出 48 条路径，`os.path.exists` 全部命中，**0 失效**。
- **删除失效条目**：
  - `supabase/proxy.ts`（「session helper used by proxy.ts」）—— 文件不存在，条目已删。
  - `api/session.ts` 的 `apiErrorResponse helper` —— 该导出不存在，改为如实列出 `requireApiSession` / `isApiSession` / `sessionResponse`。
  - `sw.js` 的「Set-Cookie or cache-control」缓存守卫描述 —— 改写为 [D-36] 修正后的事实。
  - 缓存名 `mistledger-v2` → `v3`。
- **按新架构更新**：`api-cache.ts` / `api-cache.test.ts` / `stats.test.ts` / `mui-gate.tsx`（WP-1 新增）四个新文件入树；`useApiData` 取代分区 Suspense 流式（`data/` 条目 + §2 新增「Client cache boundary」段）；xlsx 0.20.3 CDN 版本与「npm 上的 xlsx 停在 0.18.5」写进 Stack 行；新 npm scripts（`test` / `test:taboo-guard` / `test:api-cache`）与 `--import` 解析器重映射的理由写进 Runtime notes；`Database` 泛型接入写进 `supabase/{client,server}.ts` 与 `session.ts`；[D-09] 图表摘要、`[D-28]` 轴线、`[D-37]` SW 更新提示、`[D-03]` 20MB 上限、`[D-12]` 401/503 全部落到对应文件条目；禁忌清单补一段说明十条已全部机器强制 + `test:taboo-guard` 自测；§5 验证流程补 `typecheck` / `npm test` / 三个测试脚本 / bench 的 warmup·401·json·阈值。
- **如实标注未解项**：`loading.tsx` 的 [D-17] 静态化后近乎失效 caveat、`data/` 的 [D-05] 空白首屏 caveat、以及 §2 明写「sign-out 接线仍未完成」。
- 交叉核验：与 HEAD 逐行对比，消失的 29 行**全部**是本轮有意重写的块，无意外丢失；无重复行；```` ``` ```` 围栏配平；文件仍为合法 UTF-8。

### README.md

- 功能列表按 **5 条实际路由** 重写：`/` 总览 · `/ledger` 记账 · `/data` **数据** · `/settings` 设置 · `/login` 登录，每条都标了路由路径。
- 删掉「账户」「导入」两个**已不存在的独立页面**，其内容合并进设置页条目并显式说明。
- 「查数」→「**数据**」，全库 `grep` 已无「查数」。
- 技术栈补 xlsx `0.20.3`（含「npm 上的 xlsx 停在 0.18.5」的取舍说明）与 SW 更新提示行为。
- 脚本段补 `npm test` / `test:taboo-guard` / `test:api-cache`，并注明 Node 22.18+ 要求。
- 末尾补 `STRUCTURE.md` 指引。

---

## 5. 真实执行输出

见父任务汇总的最终输出记录（四道门全绿）：

- `npx tsc --noEmit` → `TSC_EXIT=0`（此前 8 errors）
- `npx eslint` → `ESLINT_EXIT=0`，零 error 零 warning（此前 1 warning）
- `npm test` → `tests 44 / pass 44 / fail 0`
- `npm run test:api-cache` → 15 项全通过
- `npm run test:taboo-guard` → 12 项全通过
