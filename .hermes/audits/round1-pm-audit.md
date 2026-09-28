# 雾夜账 MistLedger · 前端全面审查报告（Round 1 · PM/前端架构）

- 审查基线：`2447d67`（工作区仅 `.vscode/settings.json` 脏，未纳入审查）
- 审查方式：全量通读 `src/**`（61 个源文件，~7.1k 行）、`public/sw.js`、`scripts/bench.mjs`、全部配置文件与三份文档；构建产物 `prerender-manifest.json` 核验路由形态
- 已加载并遵循：`frontend-design` · `get-context` · `make-interfaces-feel-better` · `web-design-guidelines`（拉取最新 `command.md`）· `accessibility-a11y`（WCAG 2.2 AA）· `vercel-react-best-practices` · `react-and-nextjs-data-visualization` · `popular-web-designs` · `nextjs`（并以 `node_modules/next/dist/docs/` 为准）
- 本报告**不修改任何业务代码**。

---

## 总体评分

| 维度 | 分数 | 一句话理由 |
|---|---|---|
| 设计契约 | **7 / 10** | 令牌纪律近乎完美（无 zinc/标准色/渐变按钮/编号装饰/emoji、灯线白名单守住、动效全部 ≤400ms、文案零违规词），但金额铁律的负号前缀在 4 处调用点被违反、CJK 字体实际未生效使「宋体骨相」落空、且存在一条明文禁止的假 affordance hover。 |
| 可用性 | **6 / 10** | 空/加载/错误态齐全且文案考究，但错误态是 6 个一模一样的面板且无重试入口、记账「修改」与「调整余额」成功后永久锁死、`/data` 静态壳产出空白 HTML、图表 `role="img"` 把数据摘要吞掉、`SectionError` 不播报。 |
| 工程质量 | **5 / 10** | 「静态壳 + /api 鉴权边界 + useSyncExternalStore」架构方向正确且文档化充分，但客户端模块级 store 在同一标签页内跨账号残留数据、`reload()` 制造并发竞态、生成的 `database.types.ts` 从未接入导致 4 处 `as unknown as` 逃逸、`xlsx@0.18.5` 解析用户上传文件、确认弹窗逻辑 6 份复制、骨架屏每页写两遍、零测试。 |
| 性能 | **6 / 10** | recharts/xlsx 均已按需加载、四页确为 `○` 静态（已核验 manifest），但 `@mui/material` + emotion 因 `MuiProvider` 挂在根 layout 而全站发货、`filter: blur` 全页 380ms 转场非合成层、三次 `next/dynamic` 指向同一模块等于没拆包、`staleTimes` 配置已失效、SW `skipWaiting` 强更。 |

**总评：7.2 / 10。** 视觉与契约层是同类项目里少见的成熟度；短板集中在「静态化改造之后遗留的死代码与竞态」和「类型/安全/测试三件套缺席」。最高优先的三条（P0）都指向同一类根因：静态壳与 API 客户端层之间的边界没有被完整收口。

---

## 问题清单

### [D-01] P0 · 客户端数据 store 跨账号残留，登出后换号可看到上一个用户的账

- 文件: `src/lib/api/use-api-data.ts:14`（模块级 `entries` Map）、`src/lib/api/use-api-data.ts:17-36`（`getEntry` 只在 `data===null && error===null` 时才发起取数）、`src/components/site-nav.tsx:46-57`（`signOut` 只做 `router.push("/login")`，不清 store）
- 现状: `entries` 是模块级 `Map<string, Entry>`，随 SPA 生命周期常驻。`useApiData` 在 `subscribe` 时判定「已有 data 就不取数」（`use-api-data.ts:75`）。登出走的是客户端路由跳转，不做整页刷新（`site-nav.tsx:51`），Map 存活。
- 问题: 用户 A 登出 → 用户 B 登入 → `OverviewClient` 挂载命中 `/api/overview` 的旧 entry，`snap.data !== null`，**一次网络请求都不发**，直接把 A 的账户、总资产、预算、流水渲染给 B。四个页面全部受影响。`notifyDataChanged()`（`src/lib/api/client.ts:37-41`）只在写操作后触发，登出不触发。
- 违反: React 19 / Next 16 App Router 静态壳架构的数据边界约定；`STRUCTURE.md:169`「RLS scopes every query」的前提在客户端缓存层被绕过；WCAG 无关，属隐私/数据泄露。
- 期望: 登出与 401 两条路径都清空 store（`entries.clear()`）；或给 entry 加 `ownerSessionId` 标记，订阅时与当前 Supabase session 的 `user.id` 比对，不一致即丢弃重取。`apiGet` 的 401 分支（`client.ts:23-28`）也应清空。
- 修复范围: small（`use-api-data.ts` 导出一个 `resetApiCache()`，`site-nav.tsx` 与 `client.ts` 各调一次）
- 所属域: api
- 验收标准: 登出后再登入，四个页面在 1 次网络请求内重新拉取（DevTools Network 面板可见 `/api/*`），且 A 的任何字段（账户名/金额/分类）在 DOM 中不出现；单测/脚本断言 `entries.size === 0`。

### [D-02] P0 · CJK 字体根本没加载，全站中文回落系统字体

- 文件: `src/app/layout.tsx:8-23`（三处 `subsets: ["latin"]`）
- 现状: `Noto_Serif_SC` / `Noto_Sans_SC` 均声明 `subsets: ["latin"]`，`Geist_Mono` 为拉丁等宽。
- 问题: next/font/google 通过 `subset` 参数向 Google Fonts 请求 CSS；只请求 `latin` 时返回的 `unicode-range` 不含 CJK 区间，浏览器对每一个汉字都匹配不到 `Noto Serif SC` / `Noto Sans SC`，回落到 `var(--font-sans)` 里的 `ui-sans-serif, system-ui`（Windows → 微软雅黑，macOS → 苹方）。**「宋体标题骨相 = 老账簿」这条设计宣言在真实设备上一行都没生效**，且首屏会因 CJK 字体缺失/替换产生 FOUT 与行高抖动。
- 违反: DESIGN.md §三（展示/正文字体的用途定义）、§一「账——宋体的标题骨相」；web-design-guidelines「Critical fonts: preload as font」。
- 期望: 中文必须由 Noto 承担。要么去掉 `subsets` 让 loader 取完整 CJK（体积大，需配合 `display: "swap"` + 只保留必要字重），要么用 `next/font/local` 自托管裁剪子集（推荐：按 DESIGN.md 实际用到的字形子集化），`Geist_Mono` 保留 latin。
- 修复范围: medium（layout.tsx + 可能的 `public/fonts/` 子集文件与构建脚本）
- 所属域: design-system
- 验收标准: `document.fonts.check('700 20px "Noto Serif SC"', '雾夜账')` 返回 `true`；DevTools Computed 中 `h1` 的 `font-family` 解析首项命中已加载字体；中文字形与改前截图有可见差异（雅黑 → 宋体）。

### [D-03] P0 · `xlsx@0.18.5` 解析用户上传文件，且 npm 上的该包已停更

- 文件: `package.json:23`、`src/lib/ledger/import-parse.ts:238-270`（`parseBillFile` 接收 `File` → `arrayBuffer()` → `XLSX.read`）
- 现状: 依赖 `xlsx: ^0.18.5`；`parseBillFile` 解析用户拖入的支付宝/微信/建行账单，走 `XLSX.read(text)` 与 `XLSX.read(buf)`。
- 问题: npm 上的 `xlsx` 停留在 0.18.5（SheetJS 已迁往自建 CDN，0.19.3+ 的修复未回流 npm），该版本带未修复的原型污染与 ReDoS 公告，且无法通过升级 npm 包修复。攻击面是**用户上传的任意字节**。仓库里已存在 `origin/xlsx-replacement` 分支，说明团队已知。
- 违反: 前端工程质量基线（处理不可信输入的第三方解析器）；非 DESIGN/DESIGN.md 范畴。
- 期望: 迁到自建 CDN 的 SheetJS（`xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`）或换 `exceljs`/`@e965/xlsx` 替代；并对上传文件加大小上限（当前无 `file.size` 校验，2000 笔上限只在解析后才生效）。
- 修复范围: medium（package.json + `import-parse.ts` 的入口校验 + 锁文件）
- 所属域: config
- 验收标准: `npm ls xlsx` 指向 0.20.x 或替代包；`parseBillFile` 在 `file.size > 20MB` 时抛出中文错误「文件太大，请按月份拆分后再导」；`npm run lint` 与 `npm run build` 通过。

### [D-04] P1 · 记账「修改」与「调整余额」成功后永久锁死，同一条目无法再次编辑

- 文件: `src/app/ledger/edit-transaction-button.tsx:100`（`{open && !state?.ok ? …}`）、`src/app/settings/adjust-balance-button.tsx:62`（`{open && !(state.ok && state.message) ? …}`）
- 现状: 面板的渲染条件里带了「尚未成功」的判断。`useActionState` 的 `state` 成功返回后永不复位（无 reset API），数据刷新后组件实例因 key 不变而复用。
- 问题: 成功保存一次后 `state.ok===true`，`open` 按钮仍能切换 `aria-expanded`，但面板永不渲染 —— 按钮变成**点不动的死控件**。用户改错一笔就只能刷新整页。`adjust-balance-button` 同样：一个账户一生只能调一次余额。
- 违反: React 19 `useActionState` 约定（返回的 state 只增不减，需显式 key 重置）；DESIGN.md §十「动作前后同名」隐含的可恢复性。
- 期望: 用 `key={state}` 或把成功态存进独立的 `useState` 并在面板关闭时 `reset`，让「改完还能再改」成立。
- 修复范围: small（两个文件各改条件表达式 + 一个 reset）
- 所属域: ledger / settings
- 验收标准: 连续两次修改同一笔流水、连续两次调整同一账户余额均成功，第二次点「修改」/「调整余额」能展开面板；`npm run lint` 通过。

### [D-05] P1 · `/data` 的静态壳产出空白 HTML，`<Suspense fallback={null}>` 让整页首屏无内容

- 文件: `src/app/data/page.tsx:6`（`<Suspense fallback={null}>`）、`src/app/data/data-client.tsx:262`（`useSearchParams`）、`src/app/data/loading.tsx`（存在但永不生效）
- 现状: `DataClient` 内用 `useSearchParams`，被一个 `fallback={null}` 的 Suspense 包住。`/data` 是静态预渲染（`prerender-manifest.json` 中 `/data` 在 `routes` 内），预渲染时该边界直接 bail out，产出的 HTML 里这个子树是**空的**。
- 问题: 三件事叠加：① 用户打开 `/data` 得到一个没有任何内容的页面，直到 JS 拉起；② `loading.tsx` 是死代码（静态页首屏不会渲染它），它的结构骨架白写了；③ `data-client.tsx:265` 的 `shanghaiToday()` 与 `:328-336` 的 presets 用**构建时日期**生成 `/data?from=…&to=…` 链接，且 `:405-420` 这段在 loading 分支之外会进静态 HTML —— 一旦有人把 `fallback` 换成骨架「修好」空白问题，就会立刻变成 hydration mismatch（构建日 ≠ 访问日）。两个 bug 目前互相掩盖。
- 违反: Next.js 16 App Router `useSearchParams` + CSR bailout 约定；DESIGN.md §七.2（结构骨架屏契约）与 §十二（验收走 375px/无跳动）。
- 期望: 二选一并写进 DESIGN.md：把「常用查询」的日期改为服务端注入的 `buildDate`/客户端 `useEffect` 后再渲染（消灭 mismatch），同时把 `fallback` 换成真实骨架或删掉 `data/loading.tsx` 并在 changelog 说明。
- 修复范围: medium（`page.tsx` + `data-client.tsx` 的日期来源）
- 所属域: data
- 验收标准: 禁用 JS 打开 `/data` 能看到骨架而非空白；`next build` 无 hydration 警告；presets 链接在构建后第 2 天仍指向「近 7 天」而非构建日；`prerender-manifest.json` 中 `/data` 仍在 `routes`。

### [D-06] P1 · 错误态是 6 个一模一样的面板、丢失 h1、且没有任何重试入口

- 文件: `src/app/overview-client.tsx:335-345`、`src/app/ledger/ledger-client.tsx:194-206`、`src/app/settings/settings-client.tsx:347-351`、`src/components/section-error.tsx:13-18`、`src/lib/api/use-api-data.ts:66`（`reload` 已实现但**全站无任何调用点**）
- 现状: 任一分区失败就渲染 `<SectionError />`；overview 一次渲染 6 个。`useApiData` 返回的 `reload` 无人使用。
- 问题: ① overview 失败时首屏是六块一模一样的「这一栏暂时加载失败，刷新后再试」，用户无法判断是网络、鉴权还是服务端，且没有任何按钮 —— 唯一出路是手动 F5；② overview 错误态**完全没有 `h1`**，页面标题消失；③ `SectionError` 没有 `role="alert"` / `aria-live`，分区失败对读屏用户是完全静默的；④ `useApiData` 的 `reload` 是死 API。
- 违反: WCAG 2.2 SC 4.1.3（Status Messages）；DESIGN.md §十「错误文案说清发生了什么 + 怎么办」（现在只说了「刷新后再试」，没有可点的「怎么办」）。
- 期望: `SectionError` 接受 `onRetry` 并渲染一个 `.btn-ghost`「重试」→ 调 `reload()`；加 `role="alert"`；overview 错误态补 `h1` 并把 6 个面板收敛成 1 个整页错误 + 1 个「重试」。
- 修复范围: small（`section-error.tsx` 加 props + 4 个调用点传 `reload`）
- 所属域: api / design-system
- 验收标准: 断开网络后打开任一页面，出现带可点「重试」的错误面板；恢复网络点「重试」在 1 次请求内出数据；读屏能听到错误播报；`grep -rn "reload" src/app | grep useApiData` 无孤立导出。

### [D-07] P1 · 违反「不可点的行不加 hover」明文规则，且执行不一致

- 文件: `src/app/overview-client.tsx:246`（账户余额行 `hover:bg-veil`）、`src/app/settings/settings-client.tsx:256`（最近导入行 `hover:bg-veil`）
- 现状: 这两处 `<li>` 不可点击，却加了 hover 背景反馈。反观 `data-client.tsx:195` 的结果行已按规则去掉 hover。
- 问题: 用户看到行会亮 → 预期可点 → 点了没反应（假 affordance）。同一产品内两种做法并存，本身也是设计系统执行不一致的证据。
- 违反: DESIGN.md §七.3「行本身不可点则**不加** hover（避免假 affordance）」。
- 期望: 删除这两处的 `hover:bg-veil` 与冗余的 `transition-colors duration-150`（全局已统一 150ms）。
- 修复范围: small（2 行删除）
- 所属域: dashboard / settings
- 验收标准: `grep -rn "hover:bg-veil" src/app` 返回 0；DESIGN.md §七.3 不需改（是回归到规则）。

### [D-08] P1 · 负数金额违反「金额书写铁律」：`¥-1,234.00`

- 文件: `src/lib/ledger/format.ts:1-3`（`formatMoney` 对负数产出 ASCII `-`）、`src/app/overview-client.tsx:166-169`（hero）、`:248`（账户余额）、`src/app/settings/settings-client.tsx:78`（总资产）、`:96`（账户余额）
- 现状: 调用点一律写成 `¥{formatMoney(v)}`。
- 问题: 账户透支 / 总资产为负时渲染成 `¥-1,234.00`：前缀位置错（负号在 `¥` 之后而非之前）、且用的是 ASCII hyphen-minus 而非规定的 U+2212 `−`。支出/收入行因为有显式前缀常量（`AMOUNT_PREFIX`）所以正确 —— 也就是说**同一页内两种负数写法**。合计、余额、总资产这三个是用户最常看的数字。
- 违反: DESIGN.md §三「金额书写铁律」（`−` U+2212 前缀，`¥` 紧跟其后）、§二用色规则 5。
- 期望: 把符号逻辑下沉到 `format.ts`（如 `formatSignedMoney(n, kind)` 或让 `formatMoney` 自行前置 `−`），调用点不再手写 `¥`。
- 修复范围: small（`format.ts` 改 1 个函数 + 4 个调用点改写法）
- 所属域: design-system / dashboard / settings
- 验收标准: 造一笔使账户余额为 −12.5 的数据，overview hero 与 settings 总资产渲染为 `−¥12.50`（U+2212）；`grep -rn '¥{formatMoney' src` 返回 0。

### [D-09] P1 · 图表 `role="img"` 把为读屏精心写的 sr-only 数据摘要整段隐藏

- 文件: `src/components/dashboard-charts.tsx:79-84`、`:110-115`、`:171-176`（`<figure role="img" aria-label>` 内含 `<figcaption class="sr-only">`）
- 现状: 三个图表都把「数据摘要：最近一月支出 ¥X，收入 ¥Y。」放进 `role="img"` 元素**内部**的 `figcaption`。
- 问题: `role="img"` 会让整棵子树对辅助技术变成 presentational。figcaption 的文字**不会被播报**，用户只听到一句静态的 `aria-label`（如「近 6 个月每月支出与收入柱状趋势图」）—— 写摘要的功夫全部作废，图表实际退化为「一张没有数据替代的图」。
- 违反: WCAG 2.2 SC 1.1.1（Non-text Content）—— 复杂图表需要等价文本；`react-and-nextjs-data-visualization` 的「chart 需给出可读的数据摘要/标注层」要求。
- 期望: 把摘要移到 `role="img"` 元素**外部**，用 `aria-describedby` 指向它；或去掉 `role="img"`，改为 `<figure>` + `<figcaption class="sr-only">`（figure/figcaption 本身就是正确的语义对）。
- 修复范围: small（3 处 JSX 结构）
- 所属域: charts
- 验收标准: 用 NVDA/VoiceOver 聚焦任一图表，能听到「近 6 个月收支柱状图，图表，最近一月支出 ¥3,210.00，收入 ¥8,000.00」；DOM 中 `figcaption` 不在 `[role="img"]` 子树内。

### [D-10] P1 · MUI + emotion 因根 layout 包裹而全站发货，`/data`、`/` 零 MUI 组件却背 ~100KB+

- 文件: `src/components/mui-provider.tsx:20-28` + `src/app/layout.tsx:51-54`（`MuiProvider` 包裹 `SiteNav` 与 `children`）、`src/components/mui-theme.tsx:27-243`（245 行主题对象）
- 现状: provider 挂在根 layout，四个页面共享该 chunk。`mui-provider.tsx:5-9` 的注释只论证了「不产生 MUI **组件样式**」，未论证 **JS 体积**。
- 问题: `AppRouterCacheProvider` + `ThemeProvider` + `CssBaseline` + emotion + 整个主题对象进入共享 layout chunk。`/`（overview-client）与 `/data`（data-client）渲染 0 个 MUI 组件，却要为它们付出 emotion runtime 与主题的下载/解析/执行成本，直接拖累 LCP 与 INP。
- 违反: vercel-react-best-practices `bundle-dynamic-imports` / `bundle-conditional`（按功能激活才加载）；DESIGN.md §十三.6 的注入顺序（只约束 provider 结构，未约束其作用域）。
- 期望: 把 `MuiProvider` 下沉到 `(ledger)/`、`(settings)/`、`(login)/` 三个 route group 的 layout，或用 `next/dynamic` + 条件渲染；`/data`、`/` 不再拉取 emotion。
- 修复范围: medium（新增三个 group layout + 迁移 provider + 复核 hydration）
- 所属域: perf
- 验收标准: `next build` 后 `/` 与 `/data` 的 First Load JS 比修复前下降，且其 client chunk 清单中不含 `emotion` / `@mui`；三页渲染无样式回归（`npm run build` + 人工比对）。

### [D-11] P1 · PostgREST `or()` 过滤器接受未校验的 `acc` 参数（过滤注入）

- 文件: `src/app/api/data/route.ts:87`（`listQuery.or(\`account_id.eq.${filter.account},to_account_id.eq.${filter.account}\`)`）、`:56`（`account: sp.get("acc") ?? undefined` 无任何校验）、`:54`（`cat` 同样未校验但走 `.eq()` 安全）
- 现状: `from/to/type/min/max/q` 都有正则或 `Number.isFinite` 校验，`cat`/`acc` 完全没有。`acc` 被原样拼进 `.or()` 字符串。
- 问题: `?acc=<任意字符串>` 可注入额外的 or 分支，改变查询形状。RLS 仍会兜住行级越权，所以不是数据泄露，但能让用户构造出与 UI 不一致的查询、放大结果集、给 DB 施加非预期负载，且 `/api/data` 的 `filtered_tx_stats` RPC 收到的 `p_account` 同样未校验。
- 违反: Next.js 16 Route Handler 参数校验约定；`STRUCTURE.md:166` 声称「params validated server-side (same rules the page used)」—— 实际未做到。
- 期望: `cat`/`acc` 加 UUID 正则（`/^[0-9a-f]{8}-…$/i`，`cat` 额外放行 `"none"`）；不匹配即丢弃该条件而非报错，与客户端 `data-client.tsx` 的行为对齐。
- 修复范围: small（`route.ts` 加 2 个校验 + 与客户端共用一个 `parseFilters` 纯函数）
- 所属域: api
- 验收标准: `curl "/api/data?acc=1,or(id.not.is.null)"` 返回的结果与不传该参数一致；`curl "/api/data?acc=not-a-uuid"` 与不带 `acc` 结果一致；`grep -n "UUID_RE" src/app/api/data/route.ts` 命中。

### [D-12] P1 · `requireApiSession` 把瞬时故障当 401，用户被硬踢到 `/login`

- 文件: `src/lib/api/session.ts:47-49`（`catch { return NextResponse.json({error:"unauthenticated"}, {status:401}) }`）、`src/lib/api/client.ts:23-28`（401 → `window.location.replace("/login")`）
- 现状: `getClaims()` 的任何抛出（网络抖动、Supabase 5xx、DNS）都被 catch 成 401。
- 问题: 一次上游抖动 = 全站 `location.replace` 整页刷新 + 落到登录页，用户正在填的表单（记账页、设置页、导入预览）**全部丢失**，且没有任何解释。语义上 401 = 未认证，服务端故障应该是 503。
- 违反: HTTP 语义 / WCAG 无关；Next.js 16 Route Handler 错误响应约定；DESIGN.md §十「错误文案说清发生了什么 + 怎么办」。
- 期望: 区分「无/过期 claims → 401」与「上游异常 → 503 `{error:"service-unavailable"}`」；`apiGet` 对 503 抛可重试错误而非跳转；`location.replace` 前先 `resetApiCache()`（呼应 [D-01]）。
- 修复范围: small（`session.ts` 分支 + `client.ts` 加 503 分支）
- 所属域: api
- 验收标准: 断网后打开 `/`，停留在原页并显示可重试错误，不跳 `/login`；无会话时仍正常跳 `/login`。

### [D-13] P1 · `/api/*` 无任何安全响应头

- 文件: `next.config.ts:1-11`（仅有 `experimental.staleTimes`）
- 现状: 无 `headers()` 配置。
- 问题: 一个存放个人账务数据、且已登录的应用，默认缺少 `X-Frame-Options`/`frame-ancestors`、`Referrer-Policy`、`X-Content-Type-Options`、`Permissions-Policy`。`frame-ancestors` 缺失时页面可被任意站点 iframe 嵌入做点击劫持 —— 记账页的「删除」按钮在 Dialog 里，点下去就是真删。
- 违反: Web 部署安全基线。
- 期望: `next.config.ts` 加 `async headers()`，至少 `X-Frame-Options: DENY`、`Referrer-Policy: same-origin`、`X-Content-Type-Options: nosniff`、`Permissions-Policy: geolocation=(), camera=(), microphone=()`。
- 修复范围: small（`next.config.ts` 一个函数）
- 所属域: config
- 验收标准: `curl -I http://localhost:3000/ledger` 返回上述 4 个头；`npm run build` 通过。

### [D-14] P2 · `reload()` 主动作废 in-flight 请求，制造 out-of-order 覆盖

- 文件: `src/lib/api/use-api-data.ts:90-94`
- 现状: `reload()` 先 `current.fetching = null`，再 `fetchEntry(path, true)`。
- 问题: 被遗弃的那次请求仍持有 `entry` 引用，resolve 时照样 `commit()`。两次「重试」连点，后发先至、先发后至，就会用**旧数据覆盖新数据**。没有 `AbortController`，没有请求序号。全程无异常表现，只是数字偶尔回退。
- 违反: React 19 并发渲染 / 数据层竞态约定。
- 期望: 引入自增 `requestId`，`commit` 前比对；或用 `AbortController` 真正取消上一次请求。
- 修复范围: small（`use-api-data.ts` 加 ~8 行）
- 所属域: api
- 验收标准: 连续触发 5 次 reload（人为让第 1 次慢 500ms），最终 `snap.data` 始终等于最后一次响应；无 `AbortError` 泄漏到 console。

### [D-15] P2 · `generated database.types.ts` 从未接入，导致 4 处类型逃逸与全量 RPC 走 `Json`

- 文件: `src/lib/supabase/database.types.ts`（436 行，全库无 import）、`src/lib/supabase/server.ts:7`、`src/lib/supabase/client.ts:6`（`createServerClient`/`createBrowserClient` **未传 `Database` 泛型**）、`src/app/overview-client.tsx:277-279`、`src/app/ledger/ledger-client.tsx:56-63`、`src/app/settings/settings-client.tsx:198-200` 与 `:278`、`src/app/data/data-client.tsx`（RPC 返回 `Json` → 全部 `any` 流进客户端）
- 现状: 类型文件生成了，但 `createClient` 没接上，于是 `supabase.rpc(...)` 返回 `Json`，页面只能手写 `Partial<Snapshot>`/`DataPayload` 之类的本地类型，并对 PostgREST 的「一对多返回数组还是对象」用 `as unknown as` 硬转。
- 问题: 4 个文件里 7 处 `as unknown as`；RLS/列名改动不会有任何编译期报错；`DashboardPayload` 与 `api/overview` 的实际返回形状之间没有任何静态保证。
- 违反: TypeScript strict 的实际价值、`STRUCTURE.md:115` 声称的 Generated Database type。
- 期望: `createServerClient<Database>` / `createBrowserClient<Database>`；PostgREST 嵌套返回用 `as const` 关系查询或抽一个 `firstName(relation)` 工具函数消掉全部 `as unknown as`。
- 修复范围: medium（3 个 lib/client + 4 个页面消费点）
- 所属域: api / dashboard / ledger / settings / data
- 验收标准: `grep -rn "as unknown as" src` 返回 0；`npm run typecheck` 通过；把 `database.types.ts` 里某个列名改错，`tsc --noEmit` 报错。

### [D-16] P2 · 六份逐字复制的「二次确认 + requestSubmit」组件

- 文件: `src/app/ledger/delete-transaction-button.tsx:28-35,62-67`、`src/app/ledger/edit-transaction-button.tsx:104-111,81-85`、`src/app/settings/delete-account-button.tsx:29-36,70-74`、`src/app/settings/delete-budget-button.tsx:29-36,69-73`、`src/app/settings/delete-category-button.tsx:29-36,69-73`、`src/app/settings/adjust-balance-button.tsx:66-73,43-47`
- 现状: 六个文件各自实现 `armedRef` + `formRef` + 「首次 submit 拦截并弹 Dialog，Dialog 确认后 `requestSubmit()`」的同一套逻辑，加上重复的 `<Dialog>` 结构与 `useActionState` + `notifyDataChanged` 样板。
- 问题: ~300 行近乎逐字重复的代码。[D-04] 那个「成功后永久锁死」的 bug 就是在这份复制里被复制了 6 次 —— 修的时候也容易漏改。同时 `armedRef` 这种命令式旗标在 React 19 的并发渲染下是脆的。
- 违反: React 19「派生状态用派生而非 ref/flag」；DESIGN.md §十三.8 的可维护性意图。
- 期望: 抽 `useConfirmedSubmit()` hook 或 `<ConfirmSubmitButton>`（自带 Dialog + 确认/取消 + `aria-modal` 管理），六个调用点收敛到 ~20 行。
- 修复范围: medium（1 个新文件 + 6 个调用点）
- 所属域: ledger / settings
- 验收标准: 6 处确认流程行为一致（Esc 关闭、点遮罩关闭、确认后提交、pending 期间禁用）；总行数净减少 ≥ 200 行；`npm run lint` 通过。

### [D-17] P2 · 同一份骨架屏每页写两遍（`loading.tsx` + client fallback）

- 文件: `src/app/loading.tsx` vs `src/app/overview-client.tsx:78-145`（`PanelFallback`/`ChartPanelFallback`/`HeroFallback`/`BudgetFallback`/`BalanceFallback`）、`src/app/data/loading.tsx` vs `src/app/data/data-client.tsx:357-476`（散落的 inline 骨架）、`src/app/settings/loading.tsx` vs `src/app/settings/settings-client.tsx:122-321`（4 个 `*Fallback`）
- 现状: 每页都有 `loading.tsx`（路由级）和 client 内的 `*Fallback`（数据级）两套几乎相同的结构骨架。
- 问题: ① 四页已是静态预渲染，`loading.tsx` **只在后续客户端导航**时可能出现，实际使用率极低，四份近乎死代码；② 真正天天显示的是 client fallback，两套并行必然漂移 —— 已经漂了：`settings/loading.tsx:80` 用裸 `div.panel` 而其余用 `SkeletonPanel`，`data/loading.tsx` 的区块顺序与 `data-client.tsx:405` 起的结构也已不同步；③ `client` fallback 里**一个 sr-only 「掌灯中…」都没有**，读屏用户在等数据时得到的是完全静默的骨架（`loading.tsx` 里有，fallback 里没有）。
- 违反: DESIGN.md §七.2（结构骨架屏契约）；Next.js 16 `loading.tsx` 与静态预渲染的关系。
- 期望: 只保留 client fallback（真正生效的那个），补齐 `role="status" aria-busy` + sr-only 文案；`loading.tsx` 保留最小的 4 份但抽公共零件（`page-skeleton.tsx` 已有零件，缺一个 `<SectionSkeleton>` 组合件），并在 DESIGN.md changelog 记录取舍。
- 修复范围: medium（`page-skeleton.tsx` 加组合件 + 3 个页面收敛 + `page-skeleton` 复用）
- 所属域: design-system / dashboard / settings / data
- 验收标准: `grep -rn "SkeletonPanel" src/app | wc -l` 显著下降；任一页面 client 加载时读屏能听到「掌灯中…」；`loading.tsx` 与真实布局的区块顺序一一对应（人工比对通过）。

### [D-18] P2 · `role="radiogroup"` + `role="radio"` 但没有方向键与 roving tabindex

- 文件: `src/app/ledger/transaction-form.tsx:77-89`、`src/app/ledger/edit-transaction-button.tsx:117-130`
- 现状: `<Box role="radiogroup" aria-label="收支类型">` 内三个 MUI `<Chip role="radio" aria-checked>`，各自 `tabIndex=0`，无 `onKeyDown`。
- 问题: WAI-ARIA APG 的 radiogroup 模式要求：① 只有选中项在 tab 序列中（roving tabindex）；② ←/→/↑/↓/Home/End 在组内移动并切选择。当前实现两者都没有 —— 三个 chip 要 Tab 三次，方向键无响应。语义上宣告了 radiogroup 却没实现 radiogroup 的键盘契约。
- 违反: WCAG 2.2 SC 2.1.1（Keyboard）；WAI-ARIA Authoring Practices § radiogroup。
- 期望: 抽 `<TypePicker>`（或给 Box 加 `onKeyDown` + 受控 `tabIndex`），或降级为 `role="tablist"`/普通 toggle button 组（不宣告就不欠实现）。
- 修复范围: small（1 个新小组件 + 2 处调用点）
- 所属域: ledger
- 验收标准: Tab 进入类型组只需 1 次；焦点在组内时按 → 切到「收入」并同时更新 aria-checked；Tab 一次即离开该组。

### [D-19] P2 · 导入预览表格不可键盘横向滚动

- 文件: `src/app/settings/import-client.tsx:268`（`<div className="overflow-x-auto rounded-xl border border-fogline">`，表格 `min-w-[720px]`）
- 现状: 375px 视口下表格必然横向溢出，靠 `:296-299` 的渐变遮罩提示可滑动。
- 问题: 溢出容器是 `div` 而非可聚焦元素，**键盘用户无法滚动它**，只能靠触摸/鼠标。第 4 列的「分类 / 转入」下拉是每行都要用的核心控件，键盘用户在这里直接卡死。
- 违反: WCAG 2.2 SC 2.1.1（Keyboard）；web-design-guidelines「Flex/grid over JS measurement」「overflow-x-hidden on containers, fix content overflow」。
- 期望: 容器加 `tabIndex={0}` + `role="region"` + `aria-label="导入预览表格，可横向滚动"`，并在两侧加真正的滚动按钮或在窄屏改卡片式布局。
- 修复范围: small（`import-client.tsx` 一处属性）
- 所属域: settings
- 验收标准: 375px 视口下，Tab 能聚焦到表格容器并用 ←/→ 滚动；屏幕阅读器播报 region 名称。

### [D-20] P2 · 登录页把成功提示渲染成错误色

- 文件: `src/app/login/page.tsx:34`（`setError("注册成功，请到邮箱确认后再登录")`）、`:78-82`（统一 `className="text-sm text-ember"`）
- 现状: 邮箱确认路径复用 `error` state，渲染成余烬红 + `role="alert"`。
- 问题: 「注册成功」用红色 +  assertive alert 呈现，视觉与语义双重错误。同时 `role="alert"` 本身已隐含 assertive，`:79` 的 `aria-live="assertive"` 冗余；提交失败后**焦点不移动到错误**，读屏用户在按钮上可能收不到播报。
- 违反: web-design-guidelines「Errors inline next to fields; focus first error on submit」；DESIGN.md §二（ember 只表示支出/危险）。
- 期望: 拆出 `notice` state（jade + `role="status"`），错误保留 ember + `role="alert"` + `ref.focus()`。
- 修复范围: small（`login/page.tsx`）
- 所属域: login
- 验收标准: 关闭邮箱确认时登录页出现玉绿「注册成功…」且 `role="status"`；登录失败仍为余烬 + `role="alert"` 且焦点移到错误文本。

### [D-21] P2 · `/ledger` 空态指向已不存在的「账户」页

- 文件: `src/app/ledger/ledger-client.tsx:186`（"先去「账户」页建一个账户，再回来记账"）
- 现状: `/accounts` 与 `/import` 早已并入 `/settings`（`app-path-routes-manifest.json` 中只有 `/`、`/ledger`、`/data`、`/settings`、`/login`）。
- 问题: 新用户按引导找不到页面。DESIGN.md §十 明确要求「界面词汇表全站一致」与「空状态是邀请」，一个指向不存在路由的邀请不是邀请。
- 违反: DESIGN.md §十；`STRUCTURE.md:159` 的路由表。
- 期望: 改为「还没有账户，先在设置页建一个（例如：银行卡 / 零钱通）再记账」，并带 `Link` 到 `/settings#accounts`（`overview-client.tsx:253` 已是正确写法，可直接对齐）。
- 修复范围: small（1 行 + 1 个 import）
- 所属域: ledger
- 验收标准: 文案改为设置页并可点击跳转，落点为 `#accounts`；`grep -rn "「账户」页" src` 返回 0。

### [D-22] P2 · `mist-in` 转场动画 `filter: blur` 是全页非合成层动画

- 文件: `src/app/globals.css:337-352`（`@keyframes mist-in` 含 `filter: blur(8px)`）、`src/app/template.tsx:2`（每次导航重挂载播放）
- 现状: 380ms 内每帧重绘整个页面（filter 不能交给合成器）。
- 问题: 低端安卓机上 380ms × 全页重绘，是可感知的掉帧来源；且四页静态壳 + SPA 导航意味着这个动画是**每次切换导航都播**。`web-design-guidelines` 明确「Animate `transform`/`opacity` only (compositor-friendly)」。同时 `blur` 半径 8px 在低端设备上 GPU 开销显著。
- 违反: web-design-guidelines 动画节；DESIGN.md §七.1 的规范本身需要修订（不是实现走样，是契约该改）。
- 期望: 降为 `opacity` + `translateY`，`filter: blur` 保留但缩到 4px 且仅在 `@media (min-resolution: 2dppx)` 或 `@media (prefers-reduced-transparency: no-preference)` 下启用；把决策写进 DESIGN.md changelog。
- 修复范围: small（`globals.css` keyframes + DESIGN.md changelog）
- 所属域: design-system
- 验收标准: Chrome Performance 录制一次导航，动画期间无 `Paint` 事件超出内容区；`prefers-reduced-motion` 下仍完全静止。

### [D-23] P2 · `transition-property` 通配到 `*, ::before, ::after`

- 文件: `src/app/globals.css:399-406`
- 现状: `* , ::before, ::after { transition-property: background-color, border-color, color; transition-duration: 150ms }`，位于 `@layer components` 之外。
- 问题: ① 无层级声明会赢过所有 Tailwind 工具类与 `@layer` 内规则（当前恰好没有同名冲突，但这是长期地雷：任何人写 `transition-transform` 都会被 `*` 的 `transition-property` 抢占 —— 实际不会，因为 `*` 特异性 0，但**任何页面级元素选择器**都能赢）；② `::before/::after` 也被加上 150ms 颜色过渡，`body::before/::after` 两层雾每帧都在跑 transition-property；③ 它是一颗隐形的全局样式地雷，与 make-interfaces-feel-better「Never use `transition: all` — list properties explicitly」的意图一致但实现方式过宽。
- 违反: DESIGN.md §八 CSS 优先级纪律（组件类只定义自身属性）。
- 期望: 收窄到 `.panel, .input, .btn-primary, .btn-ghost, .link-subtle, .chip, .chip-active, .btn-ghost, tr, li` 等实际需要颜色过渡的契约类；或保留通配但放进 `@layer base`。
- 修复范围: small（`globals.css`）
- 所属域: design-system
- 验收标准: `grep -c "transition-property" src/app/globals.css` ≤ 2（组件层内一处 + 新增的 base 层一处）；按钮/chip hover 视觉无变化。

### [D-24] P2 · `xlsx` 之外：单次导入把最多 2000 行 JSON 塞进 hidden input value

- 文件: `src/app/settings/import-client.tsx:165-180`（`rowsJson = JSON.stringify(rows.map(...))`）、`:250`（`<input type="hidden" name="rows" value={rowsJson} />`）
- 现状: 每次改任一行的分类/转入账户，`rowsJson` 重新序列化全量数组并写入一个 hidden input。
- 问题: 2000 行 ≈ 500KB–1MB 字符串，每次 keystroke/change 都在 JS 侧重算 + DOM 属性写入；表单提交时再整体编码进 FormData。移动端主线程明显卡顿。这也是 [D-03] 上传大小限制缺失的下游放大器。
- 违反: vercel-react-best-practices `rerender-defer-reads` / `js-combine-iterations`（避免整量重算）；`react-and-nextjs-data-visualization` 的「重数据不要走 DOM 传递」实践。
- 期望: 把 rows 放进 `useRef` + `requestSubmit` 时用 `formData.set()` 注入（或分批提交）；`rowsJson` 加 `useMemo` 依赖收敛到「仅在 rows 真正变化时」；预览表加 `content-visibility: auto`。
- 修复范围: medium（`import-client.tsx` 提交流程 + 记忆化）
- 所属域: settings
- 验收标准: 导入 2000 行时切换任一行分类，主线程长任务 < 50ms（Performance 面板验证）；hidden input 不再承载 >10KB 字符串。

### [D-25] P2 · 零测试 + 无可执行的设计契约护栏

- 文件: `package.json:5-11`（无 `test` 脚本、无测试框架）、`eslint.config.mjs:5-16`（无 a11y 规则、无禁忌清单守卫）、`src/lib/ledger/stats.ts`（`monthlyTrend`/`categoryShare`/`assetCurve`/`filterTxs`/`summarizeTxs`/`accountBalances` 全部无调用点）、`src/components/section-error.tsx:1-11`（`catchSection`/`SECTION_FAILED` 死代码）、`src/lib/ledger/format.ts:5-7`（`formatBudget` 死代码）
- 现状: 没有任何测试运行器；`stats.ts` 164 行纯函数一个都没被调用（只有 `monthKey` 被 `data-client.tsx:6` 引入），注释却写着「供服务端组件调用、可单测」；`catchSection` 是 Suspense 流式时代的遗留。
- 问题: ① §十一 禁忌清单（无 zinc/标准红绿蓝/非 mono 金额/>500ms/无焦点环/编号装饰）全靠人眼 review，一旦有人写 `text-zinc-500` 或漏 `money` 类，CI 不会拦；② `stats.ts` 里 `accountBalances` 的 `map.get(t.account_id)!`（`:150-155`）这类非空断言没有测试兜底；③ 死代码让「这个函数还有人在用吗」变成每次都要重新确认的成本。
- 违反: AGENTS.md 的验证流程（只到 lint/build）；web-design-guidelines 建议的自动化 a11y 检查。
- 期望: ① `eslint` 加两条 `no-restricted-syntax` / `no-restricted-imports` 规则封死 `zinc|neutral|slate|(red|green|blue|amber|gray)-\d+` 类名与 `dark:` 变体；② 引入 `vitest`，先给 `stats.ts` 补 `filterTxs`/`accountBalances` 的用例；③ 删除死代码。
- 修复范围: medium（eslint 规则 + 测试基建 + 删死代码）
- 所属域: config / docs
- 验收标准: 写一个含 `text-zinc-500` 的临时文件，`npm run lint` 报错；`npm test` 通过且覆盖 `accountBalances` 的转账分支；`grep -rn "formatBudget\|catchSection\|monthlyTrend" src` 返回 0。

### [D-26] P2 · 导航滚动监听在桌面端空转；无「跳到主内容」链接

- 文件: `src/components/site-nav.tsx:26-42`（scroll 监听无条件注册）、`src/app/layout.tsx:43-57`（`<body>` 后直接是 `<SiteNav/>`，无 skip link）
- 现状: `scrolled` 只驱动移动端 sticky 顶栏的 `.scroll-edge`，但 effect 在所有视口注册。
- 问题: ① 桌面端每次滚动都跑 rAF + 读 `window.scrollY` + 可能 `setState`，全站零收益；② **无 skip link** —— 键盘用户每次进页面都要 Tab 过 词标 + 4 个导航项 + 退出（共 6 次）才能到主内容，WCAG 2.2 SC 2.4.1（Bypass Blocks）不达标。
- 违反: WCAG 2.2 SC 2.4.1；vercel-react-best-practices `client-passive-event-listeners`（已用 passive，OK）/ `rerender-dependencies`。
- 期望: ① 用 `matchMedia("(max-width: 639px)")` 包住监听，或只在 `.scroll-edge` 元素存在时注册；② 在 layout 首位加 `<a href="#main" className="sr-only focus:not-sr-only …">跳到主内容</a>`，并给每个 `<main>` 加 `id="main"`。
- 修复范围: small（`site-nav.tsx` + 4 个页面 main + `layout.tsx`）
- 所属域: design-system
- 验收标准: 375px 与 1280px 下均可用键盘一次跳到主内容；桌面端滚动时 React DevTools 不出现 `SiteNav` 重渲染。

### [D-27] P2 · 表单边框 `fogline` 对比度 1.22:1，低于 WCAG 1.4.11 的 3:1

- 文件: `src/app/globals.css:121-130`（`.input` 边框 `--color-fogline` on `--color-veil`）、`:112-119`（`.panel`）、`:221-228`（`.chip`）、`src/components/mui-theme.tsx:123`（MUI `notchedOutline` 同色）
- 现状（实测 sRGB 相对亮度）: `fogline #28324A` vs `veil #1B2436` = **1.22:1**；vs `mist #111826` = 1.39:1；vs `night` = 1.52:1。`prefers-contrast: more` 提亮到 `#46516E` 后 vs night 也只有 2.45:1。
- 问题: WCAG 2.2 SC 1.4.11（Non-text Contrast）要求「识别 UI 组件所必需的视觉信息」≥ 3:1。输入框/下拉框的边框是它们**唯一**的边界线索（背景 veil 与面板 mist 差 1.09:1，几乎不可辨），键盘用户判断焦点在哪一格全靠这条 1.22:1 的线。
- 违反: WCAG 2.2 SC 1.4.11。
- 期望: 把 `fogline` 提到对 `veil` ≥ 3:1（≈ `#4A5674` 量级），或给 `.input` 单独一条更亮的边框令牌 `--color-fogline-strong`（保持 `.panel` 装饰边框不变，避免大面积变亮破坏「雾」）。`prefers-contrast: more` 覆盖同步调整。
- 修复范围: small（`globals.css` 令牌 + `mui-theme.tsx` 同步）
- 所属域: design-system
- 验收标准: 脚本断言 `fogline on veil ≥ 3.0` 且 `panel` 边框不高于当前亮度；`npm run build` 后四页视觉层级不变（人工比对）。

### [D-28] P2 · 图表网格/坐标轴线同为 1.39:1，绘图区边界不可见

- 文件: `src/components/dashboard-charts.tsx:31-33`（`GRID`/`AXIS_LINE` 全用 `var(--color-fogline)`）
- 现状: 网格线 `fogline` 虚线在 `mist` 面板上 1.39:1；坐标轴线同。
- 问题: 读者无法把数据点锚定到刻度，「近 12 个月趋势」这种需要跨月比较的图，网格线本就是功能性的。
- 违反: WCAG 2.2 SC 1.4.11；DESIGN.md §九（图表主题未规定对比度，但应继承同一标准）。
- 期望: 坐标轴线提到 3:1；装饰性横向网格线可保留低对比（属「非必要」），但至少一条轴线要能定位。
- 修复范围: small（`dashboard-charts.tsx` 两条常量）
- 所属域: charts
- 验收标准: 截图中坐标轴线在 `mist` 上可辨；网格线保持"极淡"的设计意图不喧宾夺主。

### [D-29] P2 · `CHANNELS` 有两个都叫「其他」的选项，词汇表冲突

- 文件: `src/lib/ledger/constants.ts:10-15`（`direct: "其他方式"`、`other: "其他"`）
- 现状: 两个枚举值在 `transaction-form.tsx:158-162` 与 `edit-transaction-button.tsx:217-221` 的下拉里并排出现。
- 问题: 用户看到「其他方式」和「其他」两个几乎一样的选项，无法区分，等于没得选。且 `transaction-form.tsx:156` 默认值是 `alipay` —— 银行转账/现金支出也会被默认记成支付宝。
- 违反: DESIGN.md §十「禁止同义漂移」与固定词汇表。
- 期望: 重命名为「现金 / 线下」与「其他」，或合并为一个并把 `defaultValue` 改为 `direct`。
- 修复范围: small（`constants.ts` + 2 处 `defaultValue`）
- 所属域: design-system / ledger
- 验收标准: 下拉中无两个语义重叠的选项；新建流水默认渠道改为 `direct`；历史数据中 `direct`/`other` 的展示文案随之更新。

### [D-30] P2 · 全站通配 `*, ::before, ::after` 过渡叠加 `prefers-reduced-motion` 用 `!important`，两者互为因果

- 文件: `src/app/globals.css:399-406` 与 `:409-417`
- 现状: 降级块用 `animation-duration: 0s !important; animation-iteration-count: 1 !important; transition-duration: 0s !important`。
- 问题: `animation-iteration-count: 1` 让 `fog-drift`（`alternate`，60–90s）在 reduced-motion 下**不是静止，而是跳到 `to` 态后停住** —— 雾会平移 48px/32px 后定住，与「雾静止」的字面意图有出入（视觉上无碍，但与 §七.4「雾静止」的实现承诺不一致）。另 `!important` 打在 `*` 上是唯一能压住 MUI emotion 的手段，说明 [D-23] 的通配过渡是当前降级方案的前提。
- 违反: DESIGN.md §七.4。
- 期望: `animation: none !important` 一步到位（`none` 同时清掉 iteration 与 fill），删掉三条 `!important`。
- 修复范围: small（`globals.css`）
- 所属域: design-system
- 验收标准: 开 `prefers-reduced-motion` 后 body 上雾层 `getComputedStyle(el).transform === "none"`；所有 150ms 过渡时长为 0s。

### [D-31] P3 · `useApiData` 在 render 阶段写模块级 Map

- 文件: `src/lib/api/use-api-data.ts:70`（`const entry = getEntry<T>(path)` 在组件体内）
- 现状: `getEntry` 会 `entries.set(...)` 并在超限时执行淘汰循环。
- 问题: React 19 并发渲染下，被丢弃的渲染同样执行了这次副作用；StrictMode 双渲染会跑两遍。当前逻辑幂等所以无害，但这是把「取数生命周期」写进 render 的典型反模式，叠加 [D-01] 的 Map 常驻后更难推理。
- 违反: React 19「render 必须是纯函数」。
- 期望: `entry` 改由 `useMemo`/`useRef` 惰性创建，或把 Map 操作收进 `subscribe`（`useSyncExternalStore` 官方推荐的取数时机）。
- 修复范围: small（`use-api-data.ts`）
- 所属域: api
- 验收标准: React DevTools 开启 StrictMode 双渲染时无警告；`entries` 变更只发生在 commit 后。

### [D-32] P3 · `useApiData` 的 entry 无 TTL，数据页每次改筛选都留一份全量 payload

- 文件: `src/lib/api/use-api-data.ts:15`（`MAX_ENTRIES = 100`）、`:20-27`（淘汰只看 `listeners.size === 0`）
- 现状: `/api/data` 的 path 含全部筛选条件，用户每改一个条件就是一个新 entry，最多留 100 份，每份最多 200 笔流水 + 12 个月快照。
- 问题: 极端使用下常驻内存可达数十 MB；淘汰条件是「没有订阅者」，而用户在同一页面停留时旧 entry 已无订阅者但**不会立刻被回收**（要等第 101 个 entry 触发）。
- 期望: 加 LRU + TTL（如 5 分钟未访问即删），或按 entry 体积设上限。
- 修复范围: small（`use-api-data.ts`）
- 所属域: api
- 验收标准: 连续切换 200 个筛选组合后 `entries.size ≤ 100` 且其中无 5 分钟前的条目（脚本断言）。

### [D-33] P3 · `apiGet` 丢弃服务端返回的具体错误文案

- 文件: `src/lib/api/client.ts:29-31`
- 现状: 四个 route 在 502 时返回了精确中文（`"数据加载失败，请稍后重试"` / `"流水加载失败，请稍后重试"` / `"账目读取失败，请稍后重试"` / `"设置数据加载失败，请稍后重试"`），客户端一律替换成 `"数据加载失败，请稍后重试"`。
- 问题: 服务端那四句更准确的文案永远到不了用户；且 401/503/502 无差别。DESIGN.md §十要求「说清发生了什么」。
- 期望: 解析 `res.json()` 的 `error` 字段并抛出，兜底才用通用文案。
- 修复范围: small（`client.ts`）
- 所属域: api
- 验收标准: 断开后端后 `/ledger` 显示「流水加载失败，请稍后重试」而非通用句。

### [D-34] P3 · `Intl.DateTimeFormat` 在请求/渲染路径上反复构造

- 文件: `src/app/api/overview/route.ts:15`、`src/app/api/settings/route.ts:11`（每次请求构造）、`src/app/settings/settings-client.tsx:326-330`（每次渲染构造）、`src/app/overview-client.tsx:42-48`、`src/app/data/data-client.tsx:26-31`（部分已提到模块级，正确）
- 现状: 前两处在 handler 内 `new Intl.DateTimeFormat(...)`；`settings-client.tsx` 在组件体内 `new Intl.DateTimeFormat(...)`。
- 问题: `Intl.DateTimeFormat` 构造是相对昂贵的（要解析 locale 与 options），放进 render 会在每次重渲染时重付；放进 route handler 则每个请求都付。
- 违反: vercel-react-best-practices `server-hoist-static-io` / `js-cache-function-results`。
- 期望: 提到模块作用域的常量（`overview-client.tsx`/`data-client.tsx` 已有正确范例，照抄即可）。
- 修复范围: small（3 个文件）
- 所属域: api / settings
- 验收标准: `grep -rn "new Intl.DateTimeFormat" src/app/api` 为 0；`settings-client.tsx` 中该构造移出组件体。

### [D-35] P3 · `escortOrValue` 只转义引号，`q` 的 LIKE 通配符未转义

- 文件: `src/app/api/data/route.ts:22-24`、`:88-91`
- 现状: `escapeOrValue` 处理 `\` 与 `"`，然后把 `%${q}%` 塞进 `counterparty.ilike.…,note.ilike.…`。
- 问题: 注释与代码意图是「用户关键词」匹配，但 `%`/`_` 原样透传，`?q=%` 会匹配全部行（绕过 UI 的关键词语义，构造出 200 笔的宽结果）。引号转义本身是对的（防止 `.or()` 被逗号拆开），这点没问题。
- 违反: 参数校验完整性（`STRUCTURE.md:166`）。
- 期望: 转义 LIKE 元字符（`%`→`\%`、`_`→`\_`）或改用 `ilike` 之外的 `contains` 语义。
- 修复范围: small（`route.ts`）
- 所属域: api
- 验收标准: `?q=%25`（即 `%`）返回 0 笔而非全量；`?q=alipay` 正常返回。

### [D-36] P3 · Service Worker 的 `Set-Cookie` 守卫是空操作

- 文件: `public/sw.js:86-90`（`response.headers.get("set-cookie")` → `return false`）
- 现状: `isCacheableResponse` 依赖读 `set-cookie` 头来判断「不要缓存带会话的响应」。
- 问题: **`Set-Cookie` 是 forbidden response header，Service Worker 里 `headers.get("set-cookie")` 永远返回 `null`** —— 这条守卫从未生效过。实际兜底的是 `cache-control` 判定。代码读起来像是做了防护，实际没有，属安全上的假安全感。
- 违反: Web 平台 API 语义；`STRUCTURE.md:140-143` 把这条写成设计要点。
- 期望: 删掉失效分支并在注释里说明只靠 `cache-control`；或改用 `request.credentials` / 路径白名单来判断。
- 修复范围: small（`sw.js`）
- 所属域: pwa
- 验收标准: `sw.js` 中不再出现 `get("set-cookie")`；注释说明真实依据。

### [D-37] P3 · SW `install` 里无条件 `skipWaiting()`，可能在用户使用中途换掉 SW

- 文件: `public/sw.js:13-14`（`self.skipWaiting()` 在 install 事件首行）
- 现状: 新 SW 一装完就 `skipWaiting()` + `activate` 里 `clients.claim()`。
- 问题: 用户正在 `/settings` 填表时新版发布，SW 立刻接管，缓存策略（cache-first 的 `/_next/static/`）随之切换，可能出现「旧 HTML + 新 chunk」混用或缓存条目被 `activate` 删除导致资源 404 → 页面白屏。
- 违反: PWA 更新最佳实践（应提示用户后由其决定）。
- 期望: 移除 install 期的 `skipWaiting()`，保留 `message: SKIP_WAITING`（`:44-46` 已有通道，但前端从未调用它 —— 需接一个「有新版本，刷新」提示）。
- 修复范围: small（`sw.js` + `service-worker-register.tsx` 加 `updatefound` 提示）
- 所属域: pwa
- 验收标准: 发布新版后不刷新页面不会发生 SW 切换；`registration.waiting` 出现时页面底部有可点的「有新版本，刷新」。

### [D-38] P3 · `bench.mjs` 默认跑匿名，等于测 401 延迟

- 文件: `scripts/bench.mjs:24-25`（`PAGE_TARGETS` + `API_TARGETS`）、`:11-12`（注释「follow redirects ("manual" fetch)」自相矛盾）、`:22`（`COOKIE` 默认空）
- 现状: 不传 `--cookie` 时，4 个 `/api/*` 目标全部返回 401，`/` 因为被 proxy matcher 排除而返回 200 静态壳。
- 问题: 默认输出里 API 的 TTFB 是「构造一个 401」的耗时，与真实数据路径无关，容易误导。且工具**没有 warmup、没有阈值断言、没有 JSON 输出**，无法进 CI。
- 违反: `STRUCTURE.md:219` 把它定位为架构校验手段。
- 期望: 无 cookie 时对 API 目标明确标注 `401(auth)` 并提示加 `--cookie`；加 warmup；支持 `--json` 供 CI 比对。
- 修复范围: small（`bench.mjs`）
- 所属域: perf
- 验收标准: 匿名跑时 API 行状态列显示 401 且有提示；带 cookie 跑时四页 TTFB 均低于阈值（阈值写进脚本）。

### [D-39] P3 · 文档与代码已脱节（三处硬伤）

- 文件: `STRUCTURE.md:114`（列出 `supabase/proxy.ts`「session helper used by proxy.ts」—— **该文件不存在**）、`STRUCTURE.md:121`（称 `api/session.ts` 提供 `apiErrorResponse helper` —— **该导出不存在**）、`STRUCTURE.md:212`（称禁忌清单 10 条，与 DESIGN.md §十一 实际 10 条一致，但任务简报按 11 条计）、`STRUCTURE.md:19-21`（把 `loading.tsx` 描述为「路由级结构骨架」，未记录静态化后它已近乎失效，见 [D-17]）、`README.md:9-12`（功能列表仍把「账户」「导入」列为独立条目，二者早已并入 `/settings`）、`README.md:11`（写作「查数」，路由与 UI 词汇是「数据」，违反 §十 词汇表）、`DESIGN.md:163` 与 `src/app/globals.css:276`（都写「第十二节材料」，但材料那段在 §六）、`DESIGN.md` 变更记录首条（记录了静态壳改造，但未记录 `/data` 的 `Suspense fallback={null}` 后果与 `useApiData` 取代分区 Suspense 流式）
- 问题: 新人/新 agent 按 `STRUCTURE.md` 找 `supabase/proxy.ts` 和 `apiErrorResponse` 都会扑空；README 描述的是一个已经不存在的信息架构。AGENTS.md 要求「keep STRUCTURE.md up to date」，这是明确的失守。
- 违反: AGENTS.md 项目知识契约；DESIGN.md §十二。
- 期望: 删除两处不存在的条目；README 功能列表按四页重写并统一用「数据」；修正 DESIGN.md 交叉引用；在 DESIGN.md 变更记录补一条静态化改造的后续说明。
- 修复范围: small（3 个 md 文件）
- 所属域: docs
- 验收标准: `STRUCTURE.md` 中每个 `路径` 都能在仓库找到（脚本逐条 `test -e`）；README 功能项数 = 实际路由数 + 登录。

### [D-40] P3 · 图标双源、manifest 缺 `display_override`、PWA 无 `<noscript>`

- 文件: `src/app/icon.png` + `src/app/apple-icon.png`（文件约定）与 `public/icons/*.png`（manifest 引用）并存；`src/app/manifest.ts:12`（`orientation: "portrait"`）、`src/app/layout.tsx:25-34`（`metadata` 无 `metadataBase`/`openGraph`）
- 现状: 同一套品牌图标有两处来源；manifest 强制竖屏；layout 没有 `metadataBase`，也没有 OG 标签。
- 问题: ① 图标改一处漏一处会不一致；② 桌面端安装 PWA 被强制竖屏不合理（这是个数据密度不低的工具）；③ 无 OG 标签，链接分享无预览；④ 四页全是 client-fetch 壳，禁用 JS 时得到四个空白页 + 无法工作的登录页，没有 `noscript` 提示。
- 违反: PWA/元数据基线。
- 期望: 统一到文件约定（`app/icon.png` + `icon.tsx` 生成多尺寸），删除 `public/icons` 重复件；`orientation` 改 `"any"`；补 `metadataBase` + `openGraph`；layout 加一段 `<noscript>`（中文说明需开启 JS）。
- 修复范围: small（`manifest.ts`、`layout.tsx`、删除冗余图标）
- 所属域: pwa / design-system
- 验收标准: Lighthouse PWA 项全绿；禁用 JS 打开任一页面显示中文提示而非空白；分享链接有 OG 预览图。

### [D-41] P3 · `delete-category-button` 触控目标 32px，与全站 44px 约定不一致

- 文件: `src/app/settings/delete-category-button.tsx:46`（`sx={{ minHeight: 32, minWidth: 32, … }}`）
- 现状: 其余所有行内按钮（`toggle-account-button.tsx:24`、`delete-account-button.tsx:45`、`delete-budget-button.tsx:46`、`edit-transaction-button.tsx:96`、`delete-transaction-button.tsx:44`）都是 `minHeight: 44`；DESIGN.md 变更记录里专门有条目把记账页按钮统一到 44px 触控。
- 问题: 分类 chip 内的 `×` 只有 32×32。它**通过** WCAG 2.2 SC 2.5.8（AA，最小 24×24），但违反项目自身的 44px 约定，且在 chip 内是高频点击目标。
- 违反: 项目既定约定（非 WCAG AA 失败）。
- 期望: 提到 44×44，或用伪元素扩展命中区（make-interfaces-feel-better §16）。
- 修复范围: small（1 行）
- 所属域: settings
- 验收标准: `grep -rn "minHeight: 32" src` 返回 0；触达实测 44×44。

### [D-42] P3 · 规则列表用 `.chip` 渲染只读数据，hover 变亮暗示可点

- 文件: `src/app/settings/settings-client.tsx:280`（`<li className="chip">{r.keyword} → {cat}</li>`）
- 现状: 归类规则是只读展示，却套了交互控件的 `.chip` 类（`:237-239` 的 `:hover` 会把它染成纸墨）。
- 问题: 与 [D-07] 同源的假 affordance。`chip` 在本项目语义里 = 「可点的选择器/标签」。
- 违反: DESIGN.md §七.3（反馈只给真正可点的元素）。
- 期望: 改用 `border border-fogline rounded-full px-3 py-1 text-sm text-dim` 的静态样式，或新增 `.tag` 类。
- 修复范围: small（1 行 + 可选 `globals.css` 一个类）
- 所属域: settings / design-system
- 验收标准: 规则 chip 无 hover 变化；`grep -rn 'className="chip"' src/app/settings/settings-client.tsx` 只剩真正可点的用例。

### [D-43] P3 · `.input` 上挂着 `scroll-margin: 96px`，与锚点策略割裂

- 文件: `src/app/globals.css:127`、`src/app/data/data-client.tsx:439`（`id="results"` 无 `scroll-mt`）、`src/app/settings/settings-client.tsx:73`（`scroll-mt-20` = 80px）、`:381`（`scroll-mt-20`）
- 现状: 滚动偏移策略散落三处、三个值；`#results` 干脆没有。
- 问题: 移动端顶栏 = `env(safe-area-inset-top)` + 52px（iPhone 上约 99px），`scroll-mt-20`（80px）**不足以避开顶栏**，点「重置」跳 `#results` 会被压在栏下。
- 违反: web-design-guidelines「`scroll-margin-top` on heading anchors」；`STRUCTURE.md` 未记录。
- 期望: 定义 `--nav-scroll-offset: calc(var(--nav-top-h-m) + 8px)`，统一挂到 `:target` / `section[id]`；`#results` 补上；删掉 `.input` 上那条无意义的 `scroll-margin`。
- 修复范围: small（`globals.css` + 1 处属性）
- 所属域: design-system / data
- 验收标准: iPhone 安全区模拟下点「重置」，`#results` 标题不被顶栏遮挡；`grep -n "scroll-margin" src/app/globals.css` 只剩 1 处（统一规则）。

### [D-44] P3 · `results` 列表用 `.money` 渲染「笔数」

- 文件: `src/app/data/data-client.tsx:132`（`<span className="money text-ink">{count.toLocaleString("zh-CN")}</span> 笔）、`src/app/settings/settings-client.tsx:263`（`共 {b.row_count} 笔 · 新增 {b.success_count} 笔`，未用 `.money` 也未 `toLocaleString`）
- 现状: 笔数在数据页套了等宽 tabular，在设置页既不是等宽也没做千分位。
- 问题: DESIGN.md §八定义 `.money` 为「一切金额」；笔数不是金额，两处处理又不一致 —— 同一产品里「128 笔」有两种排版。
- 违反: DESIGN.md §八 `.money` 语义边界；§十「数量一律用笔」的排版未统一。
- 期望: 抽出 `.num`（tabular-nums 但非 mono）供计数使用，或统一全部用正文字体 + 千分位。
- 修复范围: small（2 处 + 可选 `globals.css`）
- 所属域: data / settings
- 验收标准: 全站「N 笔」的数字排版一致；`.money` 类只出现在金额上（可 grep 逐个核对）。

### [D-45] P3 · 事务表单日期用 `useEffect` 直写 DOM，且时区口径与全站不一致

- 文件: `src/app/ledger/transaction-form.tsx:37-42`（`localToday()` 用浏览器本地时区）、`:58-64`（effect 里 `el.defaultValue`/`el.value` 赋值）
- 现状: 通过副作用写 DOM 节点来设默认值 —— 这是为了避开 hydration mismatch（服务端无此值）而采取的绕行。
- 问题: ① 直写 DOM 破坏 React 的受控/非受控不变量，且 `defaultValue` 被改后 React 若重渲染不会同步；② `localToday()` 用浏览器时区，而 `/data` 的 presets、overview 的资产曲线、`api/*` 的月界全部按 **Asia/Shanghai**（`data-client.tsx:26-31`、`api/overview/route.ts:15`）。跨时区用户在两端会看到不同的「今天」，记进错的一天。
- 违反: React 19（DOM 应由 React 拥有）；DESIGN.md 变更记录里「月份与日界统一按 Asia/Shanghai」的既定口径。
- 期望: 日期默认值改为 `defaultValue={shanghaiToday()}` + `suppressHydrationWarning`（或由 shell 注入一次 `buildDate`），删掉 effect；`localToday` 换 `Asia/Shanghai`。
- 修复范围: small（`transaction-form.tsx` + 抽一个共用的 `shanghaiToday()`）
- 所属域: ledger
- 验收标准: 把系统时区设为 `America/New_York`，`/ledger` 默认日期与 `/data` 的「近 7 天」起止一致；源码中无 `el.value =` 直写。

### [D-46] P3 · 渠道默认值与实际语义不符

- 文件: `src/app/ledger/transaction-form.tsx:156`（`defaultValue="alipay"`）
- 现状: 支出/收入/转账三种类型的渠道都默认支付宝。
- 问题: 银行转账、现金支出被默认记成支付宝渠道，污染统计口径。DESIGN.md §十「账户类型 / 渠道」是受控词汇表，默认值应是最中性的。
- 期望: 默认改为 `direct`（「现金 / 线下」），或按类型给出更贴切的默认。
- 修复范围: small（1 行）
- 所属域: ledger
- 验收标准: 新建流水未改渠道时提交，`channel === "direct"`；与 [D-29] 的重命名一并落地。

### [D-47] P3 · `data-client` 在 JSX 里用 IIFE 构造 URL

- 文件: `src/app/data/data-client.tsx:380-386`
- 现状: `<Link href={\`/data?${(() => {…})()}\`}>` 内联 IIFE，每次渲染为 3 个 chip 各构造一次 `URLSearchParams`。
- 问题: 可读性差 + 每次渲染重复构造（`apiQs` 已在 `:313` 做过一次同样的拼装，两处逻辑需手工保持同步）。
- 违反: vercel-react-best-practices `rendering-hoist-jsx` / `js-cache-function-results`。
- 期望: 提到组件体上方，用 `useMemo` 按 `queryQs` + `days` 缓存出 3 个 href 数组。
- 修复范围: small（`data-client.tsx`）
- 所属域: data
- 验收标准: 同一份 `queryQs` 的 chips 与 `apiQs` 参数集合一致（断言 `qsFromLink === qsFromApi`）；无内联 IIFE。

### [D-48] P3 · `ensure-default-categories-button` 命名与错误播报不一致

- 文件: `src/app/settings/ensure-default-categories-button.tsx:1`（PascalCase 文件名，同目录其余为 kebab-case）、`:20`（`const result = await …` 遮蔽了 `:10` 的 state 变量）、`:29`（错误走 `aria-live="polite"` 而非 `role="alert"`）
- 问题: ① 命名规范不一致；② 变量遮蔽虽合法但极易读错；③ 失败提示用 polite live region，用户不会被打断，且余烬色无 `role="alert"`。
- 违反: 组件命名一致性；WCAG 2.2 SC 4.1.3。
- 期望: 重命名为 `ensure-default-categories.tsx`；局部变量改名；`ok` 为 false 时输出改 `role="alert"`。
- 修复范围: small（重命名 + 3 行）
- 所属域: settings
- 验收标准: `npm run lint` 通过；`settings/` 下文件名全为 kebab-case；失败时读屏立即播报。

### [D-49] P3 · overview 空 `title` 归类（`<h1>` 视觉隐藏、eyebrow `aria-hidden`）

- 文件: `src/app/overview-client.tsx:164-165`
- 现状: `<h1 className="sr-only">总览 · {cnYearMonth(curMonth)} 本月账</h1>` + `<p className="eyebrow" aria-hidden="true">{…} 本月账</p>`。
- 问题: 读屏听到 h1，视觉用户看到的是被 `aria-hidden` 的 eyebrow。信息本身不丢（h1 复述了），但**四个页面里只有 overview 的标题对读屏与视觉是两套文本**，且 overview 视觉上没有任何标题样式的元素（hero 是 `<p>`），与其余三页（可见 serif `h1`）的层级语言不一致。
- 违反: DESIGN.md §六「区块头部统一结构：eyebrow + serif 标题」的延续性。
- 期望: 统一 —— 让 eyebrow 可见且作为 `h1` 的可见文本（`<h1 className="eyebrow">`），或保留现状但在 DESIGN.md 记录这是有意为之。
- 修复范围: small（`overview-client.tsx`）
- 所属域: dashboard
- 验收标准: 四个页面的 `h1` 在视觉上有一致的层级处理；`axe` 无 heading-order 违规。

### [D-50] P3 · `global-error` 丢失字体变量

- 文件: `src/app/global-error.tsx:18-19`（自渲染 `<html lang="zh-CN">`，未带 `layout.tsx:47` 的字体 class）
- 现状: 该文件替换了根 layout 的 `<html>`，三个 `next/font` 的 CSS 变量（`--font-noto-serif-sc` 等）随之消失。
- 问题: 错误页的 `font-display` 落到 `var(--font-noto-serif-sc), serif` → 变量未定义 → 回落浏览器默认 `serif`（Windows 上是宋体/兜底），与全站排版不一致；`antialiased` 也失效。
- 违反: DESIGN.md §三。
- 期望: 在 `global-error.tsx` 的 `<html>` 上重复那三个 `variable` class 与 `antialiased`。
- 修复范围: small（1 行）
- 所属域: design-system
- 验收标准: 触发 global error（改坏 layout）时标题字体与正常页一致。

---

## 派工建议（6 个互不冲突的修复包，按文件所有权切分）

> 规则：**同一文件只属于一个包**。`DESIGN.md` 是唯一有意的共享文件 —— 变更记录由各包在**各自 commit 内**追加，冲突按包序号串行合并（WP-1 先合，其余依次）。
> 跨包依赖：`formatMoney`（`src/lib/ledger/format.ts`）归 WP-1，[D-08] 的调用点改动分散在 WP-2/4/5 各自的文件里 —— **先合 WP-1**，再各自改调用点。
> 每个包结束前：`npm run lint` + `npm run build` 通过 + DESIGN.md changelog 追加。

### WP-1 · `design-system`（契约地基，先合）
- **文件所有权**: `src/app/globals.css` · `src/app/layout.tsx` · `src/app/template.tsx` · `src/app/error.tsx` · `src/app/global-error.tsx` · `src/app/loading.tsx` · `src/app/manifest.ts` · `src/components/site-nav.tsx` · `src/components/page-skeleton.tsx` · `src/components/section-error.tsx` · `src/components/mui-provider.tsx` · `src/components/mui-theme.tsx` · `src/lib/ledger/format.ts` · `src/lib/ledger/constants.ts` · `next.config.ts`
- **问题 ID**: [D-02] [D-06]§SectionError 部分 · [D-08]§formatMoney 部分 · [D-10] · [D-13] · [D-17]§page-skeleton 部分 · [D-22] [D-23] [D-26] [D-27] [D-29]§constants 部分 · [D-30] [D-40] [D-43]§globals 部分 · [D-50]
- **工作量**: 2.5–3 人日（D-02 字体子集化最重）
- **出口条件**: 令牌对比度达标、`mist-in` 只动合成层、通配过渡收窄、根 layout 不再带 MUI、DESIGN.md §三/§七/§八 有对应 changelog

### WP-2 · `dashboard`（总览页）
- **文件所有权**: `src/app/page.tsx` · `src/app/overview-client.tsx` · `src/app/api/overview/route.ts` · `src/lib/supabase/database.types.ts`（只做类型接入，不改内容）
- **问题 ID**: [D-06]§overview 部分 · [D-07]§overview 部分 · [D-08]§调用点 · [D-15]§overview 部分 · [D-49] · [D-34]§api/overview
- **工作量**: 1–1.5 人日
- **出口条件**: overview 错误态有 h1 + 可点重试；余额行无假 hover；负数显示 `−¥`；`supabase` 客户端接入 `Database` 泛型后 `as unknown as` 清零

### WP-3 · `data`（数据页 + 过滤注入）
- **文件所有权**: `src/app/data/**`（全部 5 个文件）· `src/app/api/data/route.ts` · `src/lib/ledger/stats.ts`（删死代码或补测试）
- **问题 ID**: [D-05] [D-11] [D-15]§data 部分 · [D-33]§协同 · [D-35] [D-43]§data 部分 · [D-44]§data 部分 · [D-47]
- **工作量**: 2–2.5 人日
- **出口条件**: `/data` 静态壳非空白、无 hydration mismatch、构建日与访问日的 presets 一致、`acc`/`cat` 校验生效

### WP-4 · `ledger`（记账页 + 确认组件收敛）
- **文件所有权**: `src/app/ledger/**`（全部 7 个文件）· `src/app/api/ledger/route.ts`
- **问题 ID**: [D-04]§ledger 部分 · [D-15]§ledger 部分 · [D-16]§ledger 部分（新建的 `ConfirmSubmitButton` 放在 `src/app/ledger/`，settings 侧 import 它 —— **需与 WP-5 约定：该文件由 WP-4 建，WP-5 引用**）· [D-18] · [D-21] · [D-45] [D-46]
- **工作量**: 2–2.5 人日
- **出口条件**: 「修改」可重复进入、radiogroup 方向键可用、空态指向 `/settings#accounts`、日期口径与全站一致

### WP-5 · `settings`（设置页 + 登录页）
- **文件所有权**: `src/app/settings/**`（全部 20 个文件）· `src/app/login/**`（全部 2 个文件）· `src/app/api/settings/route.ts`
- **问题 ID**: [D-04]§settings 部分 · [D-07]§settings 部分 · [D-08]§调用点 · [D-15]§settings 部分 · [D-16]§settings 部分 · [D-19] [D-20] [D-24] · [D-34]§settings-client · [D-41] [D-42] · [D-44]§settings 部分 · [D-48]
- **工作量**: 2.5–3 人日（子组件最多）
- **出口条件**: 调整余额可重复操作、导入预览表格键盘可滚、2000 行不卡主线程、错误播报为 `role="alert"`

### WP-6 · `platform`（数据层 + PWA + 性能 + 文档 + 工具链）
- **文件所有权**: `src/lib/api/**`（3 个文件）· `src/lib/supabase/client.ts` · `src/lib/supabase/server.ts` · `src/proxy.ts` · `public/sw.js` · `src/components/service-worker-register.tsx` · `src/components/dashboard-charts.tsx` · `src/components/dashboard-charts-lazy.tsx` · `src/lib/ledger/import-parse.ts` · `scripts/bench.mjs` · `eslint.config.mjs` · `package.json` · `DESIGN.md` · `STRUCTURE.md` · `README.md` · `AGENTS.md`
- **问题 ID**: [D-01] · [D-03] · [D-09] · [D-11]§协同 · [D-12] [D-14] [D-25] [D-28] [D-31] [D-32] [D-33] [D-36] [D-37] [D-38] [D-39]
- **工作量**: 3–3.5 人日（[D-03] 依赖 + [D-25] 含测试基建）
- **出口条件**: 跨账号不进旧数据、reload 无竞态、依赖升到可修复版本、图表摘要能被读屏听到、eslint 拦截禁忌清单、文档零失效路径

**合并顺序**: WP-6 的 `formatMoney` 无关但 `resetApiCache` 接口需先定 → 建议 **WP-1 → WP-6 → WP-2/3/4/5（后四个可并行）**。总预估 **13–16 人日**。

---

## 禁忌清单自检表（DESIGN.md §十一，逐条）

> 注：DESIGN.md §十一 实际为 **10 条**（编号 1–10）。`STRUCTURE.md:212` 记为 10 条（正确）；本次任务简报按 11 条计 —— 以 DESIGN.md 原文为准。

| # | 禁忌 | 结论 | 位置 / 说明 |
|---|---|---|---|
| 1 | 引入新的红/绿/蓝标准色 | ⚠️ **有条件违规** | 业务色全合规（`text-ember`/`text-jade`/`text-lamp`，`grep -rniE "(red\|green\|blue\|indigo\|amber\|gray)-[0-9]" src` = 0 命中）。但 `src/components/dashboard-charts.tsx:24-28` 饼图色板含 `#7EA2D6`（蓝）、`#B48BE0`（紫）、`#5CC8C0`（青）、`#D98A4B`（橙）、`#94A3B8`（**Tailwind slate-400**）—— 虽由 §九 明文白名单授权，但 `#94A3B8` 与 #6「禁 slate 灰阶」在契约内部自相矛盾，需在 DESIGN.md 中裁定。 |
| 2 | 大面积灯色 | ✅ **通过** | 灯色仅出现在：导航激活灯线、hero 的 `¥` 符号、主/次按钮底、进度条 hover 态、`.chip-active`。无整块 amber 卡片、无 amber 大标题。 |
| 3 | 常亮灯线超过每屏 1 条（导航除外） | ✅ **通过** | `site-nav.tsx:84`/`:139`（导航，白名单）+ `overview-client.tsx:170`（hero 下方，§四白名单 #2）+ `login/page.tsx:55`（词标下方，§四白名单 #3）。三处均在白名单内，无越位。 |
| 4 | 渐变按钮 / 渐变进度条 / 发光大标题 | ⚠️ **轻微违规** | 按钮与进度条全为纯色（`mui-theme.tsx:89,209-216` 显式 `backgroundImage: "none"`）。唯一残留：`src/app/settings/import-client.tsx:298` 的 `bg-gradient-to-l from-night to-transparent`（表格横向滚动提示）。它是滚动遮罩而非装饰边框，但**DESIGN.md §八「已批准的例外」清单里没有它** —— 需补一条例外或改用非渐变实现。 |
| 5 | `dark:` 变体 | ✅ **通过** | `grep -rn "dark:" src` = 0 命中；`:root` 已声明 `color-scheme: dark`，无 `prefers-color-scheme` 媒体查询。 |
| 6 | zinc/neutral/slate 灰阶 | ✅ **通过** | `grep -rniE "zinc\|neutral\|slate" src` = 0 命中。边框一律 `--color-fogline`。（唯一例外是 #1 中由 §九 白名单引入的 `#94A3B8`，已单列。） |
| 7 | 非 mono 字体的金额 | ✅ **通过**（附 [D-08] 反例） | 所有金额均带 `.money`（`overview-client.tsx:166,173,177,248,291`；`ledger-client.tsx:81,90`；`data-client.tsx:132,135,140,211`；`settings-client.tsx:78,92,96,205`；`import-client.tsx:55`；`dashboard-charts.tsx:53`），`adjust-balance-button.tsx:79-81,117` 同样合规，金额输入框按 §十三.1 刻意不加 mono。唯一不符的是**负数的符号形式**（`¥-1,234.00` 而非 `−¥1,234.00`），属 §三 铁律而非本条。 |
| 8 | 单次动效 > 500ms；reduced-motion 下仍会动的元素 | ✅ **通过**（附 [D-22]/[D-30]） | 全部单次动效 ≤ 400ms：`mist-in` 380ms（`globals.css:351`）、Recharts `animationDuration={400}`（`dashboard-charts.tsx:92,93,139,187`）、`.scroll-edge` 200ms、契约 150ms、MUI 全部 `transitions.duration.* = 150`（`mui-theme.tsx:46-56`）、TouchRipple 已全局禁用（`mui-theme.tsx:69`，默认 550ms 超限）。环境类 `fog-drift` 80/90s、`lamp-breathe` 2s、`skeleton-pulse` 2s 按 §十一#8 豁免，且均被 `prefers-reduced-motion` 块覆盖（`globals.css:409-417`）。**唯一实质风险是 [D-22]：`filter: blur` 属非合成层属性，虽不违规但违反 web-design-guidelines 的合成器友好原则。** |
| 9 | 焦点环被移除或换成非灯色 | ✅ **通过**（附 [D-18] 键盘契约） | 全站焦点环统一 `rgba(227,179,65,.6)`：`.input:focus-visible`（`globals.css:142-145`）、`.btn-primary`（`:172-174`）、`.btn-ghost`（`:195-198`）、`.link-subtle`（`:216-219`）、`.chip/.chip-active/.chip:focus-within`（`:254-259`）、导航 `FOCUS_RING`（`site-nav.tsx:15-16`）、MUI `MuiButton`/`MuiChip`（`mui-theme.tsx:82,187`）、`MuiOutlinedInput`（`:127-130`）。所有 `outline: none`（`globals.css:129,154,196,217,257` 与 `site-nav.tsx` 的 Tailwind `outline-none`）**均有配对的 `:focus-visible` 替代**，无裸奔。实测焦点环对 night 4.16:1 / mist 3.82:1，达 SC 1.4.11 的 3:1。 |
| 10 | 编号装饰 / emoji 图标 / 拟物阴影堆叠 | ✅ **通过** | emoji 正则扫描 0 命中；`grep -rnE ">[0-9]{2}<\|「0[1-9]」" src` 0 命中（无 01/02/03 装饰）。阴影全部为契约内的双层轻投影：`globals.css:116-118`（`.panel`）、`:287`/`:291`（`.material-bar-*`）、`mui-theme.tsx:215-216`（Dialog 复刻 panel）、`:162`（Menu），无多层堆叠。 |

**汇总**: 10 条中 **7 条完全通过**，**3 条有问题**（#1 契约内部矛盾待裁定、#4 未登记的渐变例外、#8 的合成层风险），**0 条业务色/zinc/dark:/焦点环/金额字体的硬违规**。§十一 的执行力是本项目最强的部分。

---

## 附：审查中实测的对比度数据（sRGB 相对亮度，WCAG 公式）

| 组合 | 比值 | 判定（正文 4.5:1 / 图形 3:1） |
|---|---|---|
| `ink` on `night` | 15.25 | ✅ |
| `ink` on `veil` | 12.24 | ✅ |
| `lamp` on `night` | 9.94 | ✅ |
| `jade` on `mist` | 8.06 | ✅ |
| `dim` on `night` | 6.29 | ✅ |
| `dim` on `mist` | 5.78 | ✅ |
| `dim` on `veil`（含 placeholder 70% 混色） | 5.05 | ✅ |
| `ember` on `mist` | 4.82 | ✅（余量偏小，`text-xs` 的「超支」标签 4.82 勉强过线） |
| `ember` on `night` | 5.25 | ✅ |
| 图表辅助色 on `mist`（#7EA2D6 ~6.79 / #B48BE0 ~6.52 / #5CC8C0 ~8.86 / #D98A4B ~6.50 / #94A3B8 ~6.93） | 6.5–8.9 | ✅ |
| 焦点环 `lamp@60%` on night / on mist | 4.16 / 3.82 | ✅（SC 1.4.11 需 3:1） |
| **`fogline` on `veil`（`.input` 边框）** | **1.22** | ❌ **不达标 → [D-27]** |
| **`fogline` on `mist`（`.panel`/`.chip` 边框、图表网格）** | **1.39** | ❌ **不达标 → [D-27]/[D-28]** |
| `fogline` on `night` | 1.52 | ❌（仅用于 hero 骨架分隔线等纯装饰，可接受） |
| `prefers-contrast: more` 下 `fogline #46516E` on night | 2.45 | ❌ 仍不达 3:1 |

**结论**：**文字层对比度全部达标**（§一 的「对比度 ≥ 4.5:1」承诺成立）；**失分全部集中在「非文字边界」层** —— 输入框、chip、面板、图表网格的边框全部落在 1.2–1.5:1，键盘与低视力用户难以辨识控件边界。这是本项目可用性维度最大的单点缺口。
