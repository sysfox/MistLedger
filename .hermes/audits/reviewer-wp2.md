# WP-2 · dashboard（总览页）审核报告

- 审核基线：`2447d67` → 工作区未提交改动（HEAD 仍为 `a8b3d03`）
- 审核范围：`src/app/page.tsx` · `src/app/overview-client.tsx` · `src/app/api/overview/route.ts`
- 施工方自述：`.hermes/audits/wp2-implementation.md` · 设计增量 `.hermes/audits/wp2-design-fragment.md`
- 结论：**五维全部通过，准予提交**。一处非阻塞发现（越界但需登记）与一项文档裁定待办见文末。

---

## 0. 亲跑的门禁（真实输出）

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | `TSC_EXIT=0`（无输出） |
| `npx eslint src/app/overview-client.tsx src/app/page.tsx src/app/api/overview/route.ts` | 无输出，`WP2_LINT_CLEAN` |
| `npm test` | `tests 98 / pass 98 / fail 0`，`TEST_EXIT=0` |
| `npm run build`（`.hermes/.build-lock` 排队协议，`LOCK_ACQUIRED after 1 tries`） | `BUILD_EXIT=0`，`/` `/data` `/ledger` `/settings` `/login` 全 `○ (Static)`，`/api/*` 全 `ƒ` |
| `npm run test:taboo-guard` | 全部 12 项通过 |

> 全库 `npm run lint` 当前仍有 4–5 条 `mistledger/no-taboo-classnames` 错误，**全部落在其他包的文件**
> （`page-skeleton.tsx` / `layout.tsx` / `global-error.tsx` / `data/query-form-fallback.tsx` + WP-6 的临时探针文件）。
> WP-2 三个文件不在其中。详见 §6 关于并发 lint 规则的一次瞬时命中。

---

## 1. 设计契约 —— ✅ 通过

### §十一 禁忌 10 条

对三个文件逐条机扫（`grep -rEc` 汇总，注释行已逐条核对）：

| # | 禁忌 | 结论 | 证据 |
|---|---|---|---|
| 1 | 红/绿/蓝标准色 | ✅ | `(red\|green\|blue\|amber\|indigo\|violet\|purple\|pink\|cyan\|sky\|teal\|orange\|rose)-[0-9]` → **0** |
| 2 | 大面积灯色 | ✅ | `text-lamp` 仅 **1** 处（`overview-client.tsx:206` 的 `¥`），未新增 |
| 3 | 常亮灯线 ≤1（导航除外） | ✅ | 见下方专项 |
| 4 | 渐变按钮/进度条/发光大标题 | ✅ | 未引入渐变；预算条仍是 `bg-ember` / `bg-ink/70` 纯色 |
| 5 | `dark:` 变体 | ✅ | **0** 命中 |
| 6 | zinc/neutral/slate 灰阶 | ✅ | `(zinc\|neutral\|stone\|slate\|gray)-[0-9]` → **0** |
| 7 | 非 mono 字体金额 | ✅ | 5 处金额全部带 `.money`（`:204` `:216` `:223` `:299` `:345`）；`aria-valuetext` 复用同一格式化结果 |
| 8 | 单次动效 >500ms | ✅ | `duration-\|animation\|transition` 仅命中 `:295` **注释行**；代码 0 |
| 9 | 焦点环被移除/非灯色 | ✅ | `outline-none` → **0**；重试按钮走 `.btn-ghost`，焦点环由契约提供 |
| 10 | 编号装饰/emoji/拟物阴影 | ✅ | emoji 正则 **0**；`>[0-9]{2}<` / `0[1-9]」` **0**；未新增 `box-shadow` |

**#3 专项核验**（`grep -o 'lamp-line' .next/server/app/index.html` → 8 处，逐条看上下文）：8 处全部在 `site-nav` 内（桌面 4 + 移动 4），其中仅「总览」不带 `invisible`，其余 3 项为 `w-full invisible`。内容区灯线 **0** 条 —— 符合 §七.2「骨架屏禁用 `.lamp-line`」（`overview-client.tsx:114` 用的是 `bg-fogline` 而非 `lamp-line`，正确）。有数据态下 hero 一条（`:209`）= §四 白名单 #2。

**禁忌守卫的有效性（反向对照）**：临时写入 `src/app/__taboo_probe.tsx` 含 `text-zinc-500 hover:bg-red-600`，eslint 报出 2 条 error 并指名 §十一#6/#1 —— 证明该守卫会真失败，不是装饰。探针已删。

### 金额铁律 —— 实跑验证，非人工比对

用 `node --experimental-strip-types` 直接执行 `src/lib/ledger/format.ts` 的真实实现，并**按 `overview-client.tsx:205-207` 的三段拼接方式**复刻 hero：

```
{"v":-12.5,   "hero":"−¥12.50",  "balance":"−¥12.50",  "expense":"−¥12.50",  "income":"+¥12.50",  "budget":"¥12.50 / ¥3,000.00"}
{"v":-1234,   "hero":"−¥1,234.00", ...}
{"v":-0.004,  "hero":"−¥0.00", ...}
{"v":0,       "hero":"¥0.00", ...}
{"v":12345.67,"hero":"¥12,345.67", ...}

hero(-12.5)    cp: 2212 a5 31 32 2e 35 30
balance(-12.5) cp: 2212 a5 32 ...
ASCII-hyphen hits: 0 []
double-MINUS hits: 0
```

`2212` = U+2212（真减号），`a5` = `¥`，**符号在前、¥ 紧跟其后**，无 ASCII hyphen-minus，无双符号 —— §三 铁律成立。

### 文案语气（§十）

- 「数据没取回来」「多半是网络断了，或登录已过期。」「点下面的「重试」再取一次，不会重复记账。」—— 动词开头、不寒暄、不道歉、说清发生了什么 + 怎么办，且明确「重试是 GET、不会重复记账」消解用户真正的犹豫点。符合 §十。
- 空状态三处（「还没有账户，先去设置页建一个」「本月还没有支出，记一笔就有了」「本月还没设预算…」）均为邀请句式。
- 界面词汇一致：本月账 / 账户 / 分类 / 笔。

---

## 2. 代码质量 —— ✅ 通过

### 2.1 `firstCategory()` 是真收窄，不是把类型断言换了个地方（本次审核的核心问题）

审核要求判定「新抽象是否真消除 `as unknown as`」。我用**编译期反向探针**证明契约是真的承重的，而不是被放宽到「什么都能过」：

```ts
// 探针 1：accounts 少一个 name → 契约必须拒绝
const bad: OverviewRelations = { accounts: [{ id: "a" }], ... };
// → error TS2741: Property 'name' is missing in type '{ id: string; }'

// 探针 2：budgets.category 若退化为 {id}[]（丢了 name）→ 必须拒绝
const b: OverviewBudget[] = [{ id, limit_amount, category: { id: string }[] }];
// → error TS2322: Type '{ id: string; }[]' is not assignable to type 'OverviewBudget[]'
```

两次探针都如期报错，随后删除。这说明 `OverviewRelations` 不是「万能容器」，改名/改列会真的在编译期炸。

再逐行审 `firstCategory` 本体（`overview-client.tsx:46-49`）：

```ts
function firstCategory(rel: OverviewBudget["category"]): OverviewRelations["categories"][number] | null {
  if (rel == null) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}
```

- `Array.isArray` 是**类型守卫**（TS 内建 type predicate），不是断言；函数体内**零 `as`**。
- 那个并集 `OverviewCategoryRef[] | OverviewCategoryRef | null`（`route.ts:34`）是**诚实的类型**：它如实记录了一个真实存在的运行时二义性 —— `database.types.ts` 里 `budgets→categories` 是 `isOneToOne: false`，supabase-js 据此把返回定型为**数组**，而 PostgREST 对 to-one 内嵌运行时返回**对象**。两者都是事实，注释（`route.ts:22-30`）把来龙去脉写清楚了。审计第 185 行给的处方正是「抽一个 `firstName(relation)` 工具函数消掉全部 `as unknown as`」，施工方照此执行且做得更完整（并集 + 守卫 + 原因注释）。
- `grep 'as unknown as'` 在两个文件命中 3 处，**全部在注释里**（`overview-client.tsx:43` `:328`、`route.ts:28` 提及），代码 0。`: any` / `@ts-ignore` 代码 0。

**判定：真消除，非转移。**

### 2.2 `firstCategory` 运行时是否可能抛 —— 六种输入实跑

| 输入 | 输出 |
|---|---|
| `null` / `undefined` | `null` |
| `[]`（to-many 无行） | `null` |
| `[{id,name}]` | 对象 |
| `{id,name}`（PostgREST to-one 真实返回） | 对象 |
| 多元素数组 | 取第一个 |

`rel[0] ?? null` 兜住空数组；`rel == null` 兜住 nullish；守卫前无任何属性访问。**任何输入都不抛**。消费端 `cat` 为 null 时 `used=0`、名称回落「未知分类」（`:330` `:342`）—— 有降级，不是白屏。

### 2.3 错误态收敛是否丢信息 —— 没有，反而净增

对比基线（`git show 2447d67:src/components/section-error.tsx`）与现状：

| | 基线（6 个面板） | 现状（1 个面板） |
|---|---|---|
| h1 | **完全没有** | `PageTitle` |
| role="alert" | 无 | 有 |
| 可点补救 | 无（只能手动 F5） | `.btn-ghost`「重试」 |
| 文案 | 「这一栏暂时加载失败，刷新后再试」×6 | label=「本月账」+ 标题「数据没取回来」+ 原因 + 补救 + 「不会重复记账」 |
| 屏读播报次数 | 同一句话播 6 遍（若加 alert） | 1 遍 |

一次 `/api/overview` 失败就是整页失败，6 块一模一样的面板是**信息冗余**而非分区定位。收敛为 1 是正确取舍，且**没有丢弃任何原本存在的信息**。

### 2.4 `formatMoney` / `formatSignedMoney` 每一处用法

| 位置 | 用法 | 判定 |
|---|---|---|
| `:205-207` hero | `amountSign(total)` + `YUAN` + `formatMoney(Math.abs(total))` | ✅ 三段拼接，`¥` 单独染灯色，无前缀重复路径 |
| `:217` 本月支出 | `formatSignedMoney(cur.expense, "expense")` | ✅ |
| `:224` 本月收入 | `formatSignedMoney(cur.income, "income")` | ✅ |
| `:299` 账户余额 | `formatSignedMoney(bal)`（neutral） | ✅ |
| `:336-337` 预算 | `usedText`/`limitText`，可见文本与 `aria-valuetext` **共用同一常量** | ✅ 这是本次最有价值的一处收敛 |

`rg '¥\{formatMoney' src/app/overview-client.tsx` → 0 命中。

### 2.5 行数与体量

360 → 419（+59），其中注释行 **32**（基线 0 行块注释），纯逻辑增量约 27 行。逐项拆解新增内容：模块级 `SHANGHAI_DATE`（-6/+6，净 0）、`firstCategory`（4）、`PageTitle`（7，含三态 h1）、`reload` 接线（1）、`id="main"`（1）、错误态收敛（-8）。无一处是投机性抽象。Fowler 气味扫描：**无** Duplicated Code（`usedText/limitText` 正是消除重复）、**无** Repeated Switches、**无** Middle Man。

---

## 3. 可访问性 —— ✅ 通过

### 3.1 错误态 h1 三态齐全

| 状态 | 代码位置 | 产出 |
|---|---|---|
| 加载 | `:386` `<PageTitle srOnly />` | `<h1 class="sr-only">总览</h1>` |
| 错误 | `:402` `<PageTitle />` | `<h1 class="eyebrow">总览</h1>` |
| 有数据 | `:201` `<PageTitle month={curMonth} />` | `<h1 class="eyebrow">总览 · 二零二六年九月 本月账</h1>` |

**预渲染产物实证**（`grep -o '<h1[^>]*>[^<]*' .next/server/app/index.html`）：
```
<h1 class="sr-only">总览
```
另有一条 `<h1 class="mt-2 font-display text-xl...">需要开启 JavaScript</h1>` —— 位于 `<noscript>` 内，仅在禁用 JS 时进入无障碍树，不构成同页双 h1。

标题层级 h1 → h2 无跳级；加载态骨架为 `aria-hidden` 装饰元素，不污染标题树。

### 3.2 `SectionError` 的 `onRetry` 接 `reload` —— 实跑状态机

本机 Chrome 无法启动（exit 3），故**不假装做过端到端点按**。改为直接驱动 `onRetry` 背后那个真模块 `src/lib/api/api-cache.ts`，并把 `useApiData` 的派生逻辑（`use-api-data.ts:84-89`）逐字搬过来：

```
state=loading  ✓ (骨架 + <h1 class="sr-only">总览</h1>)
state=error    ✓ (msg="网络连接失败，请稍后重试" → SectionError onRetry=reload)
onRetry → reload ✓ (请求数 1 → 2)
state=data     ✓ (error=null → HeroSection 渲染，SectionError 卸载)
retry-also-fails ✓ (error 保持，不会出现无解释的空白)
```

即：**点重试确实发出第 2 次请求、成功后 error 被清空、面板被真实数据替换**；且反向验证了「重试也失败」时 `error` 不会被 `silent` 吞掉（`api-cache.ts:191` 的 `if (!silent || entry.snap.data === null)` 分支），不会出现按了没反应的白屏。

### 3.3 `id="main"`

`:380` `<main id="main" className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">` —— 预渲染产物中命中 `<main id="main" ...>`，根 layout 的 skip link（`跳到主内容`，实测存在于 index.html）有落点。SC 2.4.1 成立。

### 3.4 `aria-busy` 数量

加载态 6 个 `role="status" aria-busy="true"`（HeroFallback 1 + ChartPanelFallback 3 + BalanceFallback 1 + BudgetFallback 1），预渲染实测 `role="status"` 计数 = 6，与结构一致。骨架本身 `aria-hidden`，不会逐块播报；6 个 status 区域承载的是同一「掌灯中」语义。

> ⚠️ **非阻塞发现（越界但需登记）**：overview 的 client fallback **没有** sr-only「掌灯中…」—— 预渲染实测 `掌灯中` 计数 = **0**，而 `/data`=4、`/ledger`=1、`/settings`=2、`/login`=1。这正是审计 [D-17] 记录的现象（`round1-pm-audit.md:205`：client fallback 里一个 sr-only「掌灯中…」都没有）。**但 [D-17] 不在 WP-2 的问题 ID 清单内**（WP-2 只领 [D-06]§overview / [D-07]§overview / [D-08]§调用点 / [D-15]§overview / [D-49] / [D-34]§api/overview），且这 6 个 `role="status"` 结构在基线中已存在、非本次引入。故**不作为阻塞项**，移交见文末待接线清单。

---

## 4. 安全 —— ✅ 通过

`src/app/api/overview/route.ts`（81 行，全文审读）：

- **鉴权**：`requireApiSession(request)` → `isApiSession(auth)` 守卫（`:52-53`），未通过直接返回其 401/503 响应，handler 后续代码不执行。
- **错误语义**：
  - 无/过期 claims → 401 `{error:"unauthenticated"}`（`session.ts:67-68`）
  - Supabase 不可达 → 503 `{error:"service-unavailable"}`（`session.ts:61-63`）—— D-12 的瞬时故障不再被当 401 踢登录
  - 任一查询出错 → 502 `{error:"数据加载失败，请稍后重试"}`（`:63-67`），**不向客户端泄露任何内部错误细节**；`console.error` 只进服务端日志
  - 四个查询用 `Promise.all` 并发，任一失败即整体 502，不会出现「半个页面」
- **`sessionResponse`** 把 Supabase 刷新的 cookie 回写到响应（`:77-80`），鉴权链完整。
- **`firstCategory` 不可能抛**（§2.2 六种输入实跑）。
- **注入面**：该路由**不读取任何 `searchParams` / 用户输入**，无 SQL 拼接、无路径处理、无 `eval`、无硬编码密钥。RLS 由 `auth.supabase` 客户端天然承载。
- 静态扫描（added lines）：无 `api_key/secret/password/token = "..."`、无 `os.system`、无 `eval/exec`、无 `pickle`、无 SQL 模板拼接。

---

## 5. 测试与验证 —— ✅ 通过（含「测试是否有效」的审查）

### 5.1 门禁

见 §0。`tsc` / `eslint` / `test` / `build` 四项全绿。

### 5.2 测试有效性审查 —— 会不会假通过

| 测试 | 有效性判定 | 依据 |
|---|---|---|
| `format.test.ts` | ✅ **测的是被测实现本身** | `import { ... } from "./format.js"` 经 `ts-resolve-hooks.mjs` 重映射到真实 `format.ts`。该文件头注释（`:7-11`）明确记录了旧 `format-check.mjs` 的失效模式——「把 format.ts 的实现原样抄了一份再断言那份抄本」，并断言了真实字形码位（`codePointAt(0) === 0x2212`）。**不会假通过。** |
| `api-cache.test.ts` | ✅ | 驱动真实 `createApiCache`，含 D-01/D-14/D-31/D-32 用例 |
| `stats.test.ts` / `query-params.test.ts` | ✅ | 真实模块 + 真实断言 |
| `check-taboo-guard.mjs` | ✅ **已做反向对照** | 故意写入 `text-zinc-500` / `red-600` 文件，守卫如期报 2 条 error |

### 5.3 覆盖缺口（非阻塞）

`format.test.ts` 逐个测了 `amountSign` / `formatSignedMoney`，但**没有**测 hero 的三段拼接顺序（`amountSign + YUAN + formatMoney`）。若有人调换 `:205-207` 三行的顺序，双符号不会被任何测试捕获。本次我以实跑补上了这个验证（§1），但它未固化为回归测试。考虑到仓库当前无组件测试基建（[D-25] 立的 `node:test` 不含 DOM），列为待办而非阻塞。

---

## 6. 一次并发 lint 瞬时命中的说明（据实记录）

审核过程中某一轮 `npm run lint` 曾报：
```
src\app\overview-client.tsx
  358:53  error  DESIGN.md §十一 禁忌类名无法静态解析（over ? "bg-ember" : "bg-ink/70"）。  mistledger/no-taboo-classnames
```

核实结论：**非 WP-2 引入，不予追究**。
1. 该规则在 HEAD（`a8b3d03`）中**不存在**（`git show a8b3d03:eslint.config.mjs | grep -c "无法静态解析"` → 0），它是 WP-6 正在改写的 `eslint.config.mjs`（+336 行未提交）中途落地的版本。
2. 被标记的代码与基线**逐字相同**：`git show 2447d67:src/app/overview-client.tsx` 第 304 行 == 现行第 358 行，均为 `className={\`h-full rounded-full ${over ? "bg-ember" : "bg-ink/70"}\`}`。WP-2 未触碰该行。
3. 该规则后续被 WP-6 调整，现行 `npx eslint` 对 WP-2 三文件**零输出**。

---

## 7. [D-49] 契约矛盾裁定（审核任务指定的必答项）

### 矛盾双方

- **DESIGN.md:147（§六）**：「区块头部统一结构：**eyebrow 小标（雾气里的字）+ serif 标题**，标题下不再加线。」
- **DESIGN.md:150-164（§六 总览页线框图）**：hero = `eyebrow（月份用汉字数字）` / `¥ 12,345.67` / 灯线 / 本月支出·本月收入，**没有 serif 标题行**。

施工方按「线框图更具体、优先」执行，落地为单一可见 `<h1 class="eyebrow">`。

### 裁定：**线框图优先。施工方执行正确，不需改代码。**

给出一条比「更具体」更硬的理由 —— **这两条规则治理的对象根本不同，不构成真矛盾**：

- 「区块头部统一结构」治理的是**区块（section）头部**。核对 `overview-client.tsx` 的五个区块 —— 趋势 `:240-241`、构成 `:257-258`、资产 `:279-280`、余额 `:290-291`、预算 `:319-320` —— **无一例外都是 `eyebrow` + serif `h2`**。该规则在它该管的地方**已被完全满足**。
- 总览 hero **不是区块头部**，它是页面 hero，由线框图单独治理。线框图对 hero 的构成写得很明确，且自带注记「← eyebrow（月份用汉字数字）」。
- 因此不存在「一处规则被违反」，只有一处**文档没把适用范围说清**，导致读者误以为冲突。

### 同时确认 [D-49] 原始缺陷已修

原缺陷是「`sr-only` h1 + `aria-hidden` eyebrow = 读屏与视觉两套文本，且 overview 是四页里唯一视觉上无标题的页」。改为单一可见 h1 后：屏读与视觉同一串文本、页名用与其余三页一致的词汇（「总览」）、h1 在三态齐全（§3.1）。审计第 554 行给的第一个方案（「让 eyebrow 可见且作为 h1 的可见文本」）已落地。

### 需要 DESIGN.md 补的（文档裁定待办，我无权改文档）

1. §六 加一句明确 hero 与「区块头部」的分工，例如：「总览 hero 遵循本页线框图（eyebrow + 灯下大数字），不适用『区块头部统一结构』」。
2. **如实记录一个未达成的目标**：总览 h1 为 11px `eyebrow` 层级（`text-dim`，对 night 6.29:1，对比度达标、非 WCAG 问题），而其余三页 h1 为 serif 20–22px。**四页 h1 的视觉层级并未统一** —— 这是 [D-49] 验收标准「四个页面的 h1 在视觉上有一致的层级处理」未达成的事实。取舍已由施工方写入 `wp2-design-fragment.md`，需文档包在 §六 明确认下，否则每次 review 都要重判。

---

## 8. 非阻塞发现与待接线清单

**发现（在本包所有权文件内，但越出 WP-2 问题 ID，不阻塞）**

| # | 内容 | 归属建议 |
|---|---|---|
| N-1 | overview client fallback 缺 sr-only「掌灯中…」（预渲染实测 0，其余四页 1–4）。[D-17] 现象，基线已存在，非本次引入 | 随 [D-17] 收口；`page-skeleton.tsx` 已有 `SkeletonStatus` 成品，overview 的 6 处 `PanelFallback`/`HeroFallback` 包一层即可 |

**待接线（施工方已列，我复核确认）**

1. `api/settings/route.ts:11`（WP-5）—— handler 内仍有 `new Intl.DateTimeFormat`，[D-34] 的「`src/app/api` 为 0」因此未达成。
2. `settings-client.tsx:326-330`（WP-5）—— 组件体内构造 formatter。
3. `settings-client.tsx:256`（WP-5）—— [D-07] settings 侧假 hover。
4. `ledger-client.tsx` / `data-client.tsx`（WP-4 / WP-3）/ `adjust-balance-button.tsx`（WP-5）—— `{AMOUNT_PREFIX[t.type]}¥{formatMoney(...)}` 形式的调用点仍可迁 `formatSignedMoney`。
5. **WP-6 / DB 侧**：`database.types.ts:275-278` 把 `dashboard_snapshot` 的 `Returns` 声明为 `Json`，导致 `snapshot` 内部形状无法共享契约。**若**该 RPC 改为 `RETURNS TABLE(...)` 并重新生成类型，可把 `Snapshot` 移进 `route.ts`，`OverviewPayload` 即成为完全共享的单一声明。
6. **文档包**：`wp2-design-fragment.md` 的 [D-49] 取舍需在 DESIGN.md §六 裁定（见 §7）。

**未运行时验证清单（诚实声明）**

- 本机 Chrome 启动失败（exit code 3），**「点重试 → 出数据」未做浏览器端到端点按**。已用驱动真实 `api-cache.ts` 的方式验证同一状态机（§3.2），但**不能替代真实浏览器点击**。
- **375px / 1280px 未实测**。DESIGN.md §十二 要求这两个断点走一遍，本次未做（无浏览器）。骨架与内容均为 `flex-col` + `sm:grid-cols-2`，静态上无溢出风险，但**未经实测**。
- `prefers-reduced-motion` 下的实际观感未实测（本包未新增任何动效，风险低）。
- 读屏软件（NVDA/VoiceOver）实听未做；ARIA 属性经代码与预渲染产物核对，**未经真实读屏验证**。

以上四项属环境限制，非本次改动引入；WP-1 审核员已登记同一限制。
