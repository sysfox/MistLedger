# WP-2 · dashboard（总览页）实现报告

- 审查基线：`2447d67`
- 归属问题：[D-06]§overview · [D-07]§overview · [D-08]§overview 调用点 · [D-15]§overview · [D-49] · [D-34]§api/overview
- 改动文件（全部在 WP-2 所有权内，未触碰 `database.types.ts` 与 DESIGN.md）：

| 文件 | 改前行数 | 改后行数 | 净增 |
|---|---|---|---|
| `src/app/overview-client.tsx` | 360 | 419 | +59 |
| `src/app/api/overview/route.ts` | 30 | 81 | +51 |
| `src/app/page.tsx` | 5 | 5 | 0（仅确认，无需改动） |

`git diff --stat`：`overview-client.tsx` 127 行变更（+103/−24 另计注释），`api/overview/route.ts` 55 行变更。

---

## 逐条：改了什么 / 在哪行 / 怎么验证 / 未完成原因

### [D-06] 错误态收敛为 1 个整页面板 + 可点「重试」，并补 h1 — ✅ 完成

**改了什么**

1. `overview-client.tsx:396-404`：`error || !data` 分支从 6 个 `<SectionError />`（含一个双列网格里的 2 个）改为 **1 个** `<SectionError onRetry={reload} label="本月账" />`。
   理由写在代码注释里：一次 `/api/overview` 请求失败就是整页失败，六块一模一样的文案既让用户分不清网络/鉴权/服务端，也把同一个 `role="alert"` 播报六遍。
2. `overview-client.tsx:376`：`const { data, error, loading, reload } = useApiData(...)` —— 接上 `reload`（`use-api-data.ts:80-82`，签名 `() => void`，与 `SectionError` 的 `onRetry?: () => void` 匹配）。这是该 API 在总览页的第一个调用点。
3. `overview-client.tsx:402`：错误分支补 `<PageTitle />`（h1）——**此前整个错误态没有任何 h1**。
4. `overview-client.tsx:386`：加载分支补 `<PageTitle srOnly />`。骨架必须镜像真实布局（DESIGN §七.2），所以视觉上标题位仍是一条 `SkeletonLine`；但文档结构不该随数据消失。**刻意不带月份**：该分支会被静态预渲染（`curl` 实测 SSR HTML 里就是这个分支），取「今天」会造成构建日 ≠ 访问日的 hydration mismatch（[D-05] 同类坑）。
5. `overview-client.tsx:380`：`<main id="main">`（[D-26] 的接线点，根 layout 的 skip link 指向 `#main`）。

**怎么验证**

- 实跑 dev server（`npx next dev -p 3117`）后 `curl http://localhost:3117/`：HTTP 200，46 KB HTML。
  - `grep '<main id="main"'` → 命中（页面分支 `...flex-col gap-6...`；另一处是 `loading.tsx` 的 Suspense fallback，非本包文件）。
  - `grep -o '<h1[^>]*>[^<]*'` → 加载态输出 `<h1 class="sr-only">总览`（不含日期，无 hydration 风险）。
  - `grep -c 'hover:bg-veil'` → 0。
- 错误分支的三态切换无法用 curl 覆盖（错误态只在客户端 fetch 失败后出现，而 `/api/overview` 未登录会 401 → `apiGet` 跳 `/login`；浏览器工具在本机 Chrome 启动失败）。因此该分支的验证是**静态**的：`tsc --noEmit` 通过 + `SectionError` 契约逐字核对（`section-error.tsx:53-63`：`onRetry` 有值才渲染 `.btn-ghost`「重试」按钮，原生 `<button>` 自带 Enter/Space 与 `.btn-ghost` 的灯色 `:focus-visible` 环）。

**未完成原因**：无（功能全部落地）。仅「浏览器端点一次重试」未能端到端点按，缺可登录会话。

---

### [D-07] 账户余额行假 hover — ✅ 完成

**改了什么**：`overview-client.tsx:293-300`

- 删除 `hover:bg-veil` 与冗余的 `transition-colors duration-150`（全局已是 150ms，DESIGN §七.3）。
- 同时删除 `rounded-md`：圆角只服务于 hover 底色的形状，没有背景就没有意义。
- 该 `<li>` 不可点 → 违反 DESIGN §七.3「行本身不可点则**不加** hover（避免假 affordance）」。

**怎么验证**：`rg -n 'hover:bg-veil' src/app/overview-client.tsx` → 仅命中注释行（`overview-client.tsx:294`），类名 0 命中；SSR HTML `grep -c 'hover:bg-veil'` → 0。

> ⚠️ 同一问题的 settings 侧（`settings-client.tsx:256` 最近导入行）属 WP-5，本包未动。

---

### [D-08] `¥{formatMoney(x)}` → `formatSignedMoney`，负数渲染 `−¥12.50` — ✅ 完成（overview 侧）

**改了什么**（三处逐个核过）

| 位置 | 改前 | 改后 |
|---|---|---|
| hero 总额 `overview-client.tsx:200-208` | `<span class="text-lamp">¥</span>{formatMoney(total)}` | `{amountSign(total)}`（dim）+ `<span class="text-lamp">{YUAN}</span>` + `formatMoney(Math.abs(total))` |
| 本月支出 / 收入 `:212-225` | `−¥{formatMoney(cur.expense)}` / `+¥{formatMoney(cur.income)}` | `formatSignedMoney(cur.expense, "expense")` / `formatSignedMoney(cur.income, "income")` |
| 账户余额 `:299` | `¥{formatMoney(balances.get(a.id) ?? 0)}` | `formatSignedMoney(balances.get(a.id) ?? 0)` |
| 预算 `:336-337, 346, 355` | `¥{formatMoney(used)} / ¥{formatMoney(limit)}`（可见文本与 `aria-valuetext` 各写一遍） | `usedText` / `limitText` 两个常量，可见文本与 `aria-valuetext` 共用同一结果 |

**双符号核验**：hero 的 `¥` 需要单独染灯色（§二 用色规则 1），因此用 `amountSign()` 只取符号、`YUAN` 常量取币种、数字取 `formatMoney(Math.abs())`——三者拼接，无前缀重复路径。支出/收入两处**传 kind** 给 `formatSignedMoney`：正数出 `−¥` / `+¥`；若 RPC 意外返回负数，`formatSignedMoney` 走 `n < 0` 分支吞掉 kind 前缀只留一个 U+2212，不会出 `−−¥`。

**怎么验证**：抽出 `format.ts` 的真实实现（`MINUS`/`YUAN`/`AMOUNT_PREFIX`/`formatMoney`/`formatSignedMoney`/`amountSign`）在 Node 里按 `overview-client.tsx` 的拼接方式实跑：

```
v=-12.5   hero=−¥12.50   balance=−¥12.50   expense=−¥12.50   income=+¥12.50   expense_neg=−¥12.50
v=-1234   hero=−¥1,234.00 balance=−¥1,234.00 expense=−¥1,234.00 income=+¥1,234.00
v=0       hero=¥0.00
v=12345.67 hero=¥12,345.67
codepoints hero(-12.5): 2212 a5 31 32 2e 35 30
```

`2212` = U+2212（真减号），`a5` = `¥`，**符号在前、¥ 紧跟其后**，无 ASCII hyphen。

`rg '¥\{formatMoney' src/app/overview-client.tsx` → 0 命中（其余 `¥{formatMoney}` 命中项在 `data-client.tsx` / `ledger-client.tsx` / `adjust-balance-button.tsx`，分别属 WP-3 / WP-4 / WP-5）。

---

### [D-15] 消除 `as unknown as` — ✅ 完成（overview 侧）

**改了什么**

1. `api/overview/route.ts:21-45` 新增导出的契约类型 `OverviewCategoryRef` / `OverviewBudget` / `OverviewRelations`，并在 `route.ts:69-73` 把关系数据**显式标注**为 `OverviewRelations`。
2. `overview-client.tsx:13` 用 `import type { OverviewBudget, OverviewRelations } from "./api/overview/route"` 引入同一份声明；`overview-client.tsx:25-27` 的 `OverviewPayload` 改为 `OverviewRelations & { snapshot: Partial<Snapshot> }`——删掉了原先手写的 `accounts`/`categories`/`budgets` 三份本地副本。
3. `overview-client.tsx:46-49` 新增 `firstCategory()`：用 `Array.isArray`（类型守卫）做**真收窄**替换原来的 `as unknown as`；`overview-client.tsx:328-330` 改为 `const cat = firstCategory(b.category)`。

**为什么不是「直接照抄生成类型」**：`database.types.ts` 里 `budgets → categories` 的关系是 `isOneToOne: false`，supabase-js 据此把 `select("..., category:categories(id, name)")` 的返回类型定为**数组**；而 PostgREST 对 to-one 内嵌在运行时返回**对象**。两者都是事实，且 `database.types.ts` 是本包的只读文件。契约类型如实写成并集 `CategoryRef[] | CategoryRef | null`，消费端用守卫处理——这正是审计第 185 行给的方案（「抽一个 `firstName(relation)` 工具函数消掉全部 `as unknown as`」）。

**怎么验证**

- `npx tsc --noEmit` → 退出码 0，**全项目零错误**。
- 反向验证静态保证真的存在：把 `route.ts:69` 的标注去掉并让 `accountsRes` 只 select `id`，客户端因 `OverviewRelations.accounts` 要求 `name` 而报错；标注在时，改列名/改形状会同时打到路由与客户端。
- `rg 'as unknown as|: any|@ts-ignore|@ts-expect-error' src/app/overview-client.tsx src/app/api/overview/route.ts` → 3 处命中，**全部在注释里**（`overview-client.tsx:43,44,328`），代码 0 命中。

**未完成原因（部分）**：`snapshot` 的内部形状（`dashboard_snapshot` RPC）仍由客户端本地声明，因为 `database.types.ts:275-278` 把该 RPC 的 `Returns` 声明为 `Json`，且该文件只读。要彻底解决需 WP-6 或 DB 侧重新生成类型（把 RPC 的 `Returns` 从 `Json` 换成 `RETURNS TABLE(...)` 的真实结构）——已列入下方「需其他包接线」。

---

### [D-49] h1 改为视觉可见的 eyebrow 层级标题 — ✅ 完成

**改了什么**：`overview-client.tsx:166-183` 新增 `PageTitle` 组件，替换原先的「`sr-only` h1 + `aria-hidden` 的 eyebrow `<p>`」两套文本：

- 有数据：`<h1 className="eyebrow">总览 · 二零二六年九月 本月账</h1>`（可见，eyebrow 层级 = sans 500 / 11px / `dim` / `letter-spacing .2em`）
- 错误态：`<h1 className="eyebrow">总览</h1>`（可见）
- 加载态：`<h1 className="sr-only">总览</h1>`（骨架镜像要求视觉位仍是骨架线，见 D-06 说明）

**取舍说明（重要）**：另外三页的 h1 是 serif 22px（`ledger-client.tsx:178` 记账 / `data-client.tsx:353` 曲线与查询 / `settings-client.tsx:336` 设置），本包**没有**改成 serif 22px，理由是 DESIGN §六 的总览页线框图明确规定 hero 是「eyebrow（月份用汉字数字）+ 灯下大数字」，没有 serif 标题行；§六 同时规定「区块头部统一结构：eyebrow + serif 标题」，两者对总览 hero 存在张力，**线框图更具体、优先**。落地后达到的是审计第 554 行的第一条方案（「让 eyebrow 可见且作为 h1 的可见文本」）：单一可见 h1、读屏与视觉同一串文本、页名「总览」与其余三页的 h1 用同一套词汇。DESIGN.md 不可改，该取舍已写进 `wp2-design-fragment.md` 供文档包裁定。

---

### [D-34] `new Intl.DateTimeFormat` 提到模块作用域 — ✅ 完成

**改了什么**

- `api/overview/route.ts:9-16`：新增模块级 `const SHANGHAI_MONTH = new Intl.DateTimeFormat("en-CA", {...})`；`route.ts:60` 改为 `${SHANGHAI_MONTH.format(new Date())}-01`。原先每个请求都重新构造一次 formatter。
- `overview-client.tsx:34-39` + `:65-67`：**审计点名了这一处**（第 388 行把 `overview-client.tsx:42-48` 列进 D-34）。本文件在**渲染路径**上调用它（`HeroSection` 的月份兜底、`AssetSection` 的 30 天窗口），每帧重付构造代价比 route handler 更贵，一并提到模块作用域。

**怎么验证**：`rg -n 'new Intl' src/app/api` → `overview/route.ts:13`（模块作用域常量，合规）+ `settings/route.ts:11`（**在 handler 内**，属 WP-5 的 `api/settings/route.ts`，本包无权改）。审计第 395 行的验收标准「`src/app/api` 中该构造为 0」因此**未完全达成**，缺口已列在「需其他包接线」。

---

## DESIGN.md §十一 禁忌清单自检（逐条，本包 3 个文件）

| # | 禁忌 | 结论 | 依据 |
|---|---|---|---|
| 1 | 新增红/绿/蓝标准色 | ✅ | `rg '(red|green|blue|amber|indigo|violet|purple|pink|cyan|sky|teal|orange|rose)-[0-9]'` 三个文件 0 命中；语义色只用 `text-lamp` / `text-ember` / `text-jade` / `text-dim` / `text-ink` |
| 2 | 大面积灯色 | ✅ | 灯色只出现在 hero 的 `¥`（`overview-client.tsx:206` 一处 `text-lamp`），未新增 |
| 3 | 常亮灯线每屏 ≤1（导航除外） | ✅ | 只保留 hero 下方原有的 1 条 `.lamp-line`（`:209`），未新增 |
| 4 | 渐变按钮/进度条/发光大标题 | ✅ | 未新增任何渐变；预算进度条仍是纯色 `bg-ember` / `bg-ink/70` |
| 5 | `dark:` 变体 | ✅ | `rg 'dark:'` 三个文件 0 命中 |
| 6 | zinc/neutral/slate 灰阶 | ✅ | `rg '(zinc\|neutral\|stone\|slate\|gray)-[0-9]'` 0 命中；边框/分隔仍是 `bg-fogline` |
| 7 | 非 mono 字体的金额 | ✅ | hero（`:204`）、支出/收入（`:216,223`）、账户余额（`:299`）、预算（`:345`）全部带 `.money`；预算 `aria-valuetext` 复用同一格式化结果 |
| 8 | 单次动效 >500ms | ✅ | 本包未新增任何 animation/transition（`rg 'duration-\|animation\|transition'` 仅命中注释）；重试按钮的过渡由 `.btn-ghost` 契约提供（150ms） |
| 9 | 焦点环被移除/非灯色 | ✅ | 未新增 `outline-none`；重试按钮用 `.btn-ghost`，其 `:focus-visible` 为 `ring-lamp/60`（`globals.css`） |
| 10 | 编号装饰 / emoji / 拟物阴影 | ✅ | emoji 正则 0 命中；未新增编号样式；未新增 `box-shadow` |

补充：仓库自带的禁忌守卫自测 `npm run test:taboo-guard` 由 WP-1 建立，本包未改动其覆盖范围；`npx eslint` 对本包三个文件实跑 0 问题（该守卫在 `src/**/*.{ts,tsx}` 上生效，等于对本包做了机器复核）。

---

## 验收命令真实输出

```
$ npx tsc --noEmit
（无输出，exit 0）—— 全项目零错误，无「别人文件的错误」需要单列

$ npx eslint src/app/overview-client.tsx src/app/page.tsx src/app/api/overview/route.ts
（无输出，exit 0）

$ npx next dev -p 3117 && curl -s http://localhost:3117/ -o home.html
status=200  bytes=46089
grep '<main id="main"'      → 命中
grep '<h1 class="sr-only">总览' → 命中（加载态 h1，无日期）
grep -c 'aria-busy="true"'  → 7（骨架 role=status aria-busy 保持）
grep -c 'hover:bg-veil'     → 0
```

未跑 `next build`（任务明令禁止）。未做任何 git 写操作。

---

## 需其他包接线

1. **WP-5 · `src/app/api/settings/route.ts:11`**：handler 内仍有 `new Intl.DateTimeFormat`，D-34 的验收标准「`rg 'new Intl.DateTimeFormat' src/app/api` 为 0」因此还差这一处。改法与 `api/overview/route.ts:9-16` 逐字相同（提到模块作用域的 `SHANGHAI_MONTH`）。
2. **WP-5 · `settings-client.tsx:326-330`**：组件体内构造 formatter，D-34 的 settings 部分。
3. **WP-4 · `ledger-client.tsx`、`data-client.tsx`（WP-3）、`adjust-balance-button.tsx`（WP-5）**：`{AMOUNT_PREFIX[t.type] ?? ""}¥{formatMoney(...)}` 形式的调用点仍可迁到 `formatSignedMoney(amount, t.type)`（语义等价、无双符号），迁移后 `formatMoney` 的手写 `¥` 前缀可全站清零。**不在本包所有权内，未改。**
4. **WP-5 · `settings-client.tsx:256`**：D-07 的 settings 侧（最近导入行假 hover）。
5. **WP-6 / DB 侧**：`database.types.ts:275-278` 把 `dashboard_snapshot` 的 `Returns` 声明为 `Json`，导致 `snapshot` 的内部形状无法共享契约。若把该 RPC 的 `Returns` 改为真实的 `RETURNS TABLE(...)` 结构并重新生成类型，可把 `Snapshot` 也移进 `api/overview/route.ts` 的契约，`OverviewPayload` 即成为完全共享的单一声明。本包因该文件只读而停在「客户端本地声明 + 注释标注原因」。
6. **WP-1 · `page.tsx`**：无需改动，已核对（仅 `import OverviewClient` + `return <OverviewClient />`）。`<main id="main">` 的接线在 `overview-client.tsx:380`（页面壳由 client 组件持有，不是 `page.tsx`）。
7. **文档包**：`wp2-design-fragment.md` 里的 [D-49] 取舍（总览 hero 的 h1 用 eyebrow 层级而非 serif 22px）需要有人在 DESIGN.md §六 明确裁定，否则 §六「区块头部统一结构」与总览线框图之间的张力仍然悬着。
