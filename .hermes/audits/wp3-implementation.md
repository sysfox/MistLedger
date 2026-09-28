# WP-3 实施报告 —— data 页 / 过滤注入防护

范围：`/data` 数据查询页 + `/api/data`。基线 `2447d67`。

---

## 1. 完成状态

| ID | 优先级 | 状态 | 一句话 |
|---|---|---|---|
| [D-05] | P1 | ✅ | `fallback={null}` → 真骨架；日期改为访问日入参，静态 HTML 零日期 |
| [D-11] | P0 | ✅ | acc/cat UUID 校验抽成共用纯函数，不匹配即丢弃 |
| [D-35] | P0 | ✅ | LIKE 元字符两层转义，`?q=%` 不再返回全量 |
| [D-15]§data | P1 | ✅ | `as unknown as` 清零；RPC 载荷加运行时收窄，删掉全部 `Number()` 兜底 |
| [D-44]§data | P2 | ✅ | 笔数改 `tabular-nums`（非 mono）；`.num` 统一列入接线项 |
| [D-47] | P2 | ✅ | 内联 IIFE 提取 + useMemo；qs 构造收敛为一个函数 |
| [D-43]§data | P2 | ✅ | 停止自写 scroll-mt，统一交给 globals.css 单一来源 |
| [D-17]§data | P2 | ✅ | 骨架补 `role="status" aria-busy` + sr-only「掌灯中…」，与 loading.tsx 同源 |
| [D-33]§协同 | P1 | ✅（依赖 WP-6 已完成） | 路由侧保留精确中文文案，客户端 `readServerError` 已能透出 |
| `<main id="main">` | — | ✅ | |
| stats.ts 死代码 | — | ✅ 确认使用 | 无死代码，全部导出已被引用或已被测试覆盖 |

---

## 2. 改动文件

| 文件 | 变更 | 说明 |
|---|---|---|
| `src/app/data/query-params.ts` | **新增** 209 行 | [D-11][D-35][D-47] 共用纯函数：UUID 校验、LIKE 转义、URL 串构造、`snapDays` |
| `src/app/data/payload.ts` | **新增** 109 行 | [D-15]§data：`FilteredTxStats` / `Snapshot` 类型 + 运行时收窄 |
| `src/app/data/presets.ts` | **新增** 53 行 | [D-05]：常用查询预设，**日期是入参** |
| `src/app/data/data-shell.tsx` | **新增** 102 行 | [D-05][D-17]§data：静态壳 / loading / client 三处共用的骨架 |
| `src/app/data/query-params.test.ts` | **新增** 383 行 | 41 条断言，覆盖上面 5 个 ID |
| `src/app/data/data-client.tsx` | 改动 ±589 | 主体重写，见下 |
| `src/app/data/page.tsx` | 改动 +23/−8 | `fallback={null}` → `<DataShell />` |
| `src/app/data/loading.tsx` | 改动 −75/+6 | 75 行 inline 骨架 → `export { default } from "./data-shell"` |
| `src/app/api/data/route.ts` | 改动 ±120 | 改用共用校验；LIKE 转义；载荷收窄 |
| `src/lib/ledger/stats.ts` | 新增 +84 | 日期算术（`shanghaiDate` / `shiftDays` / `lastDayKeys` / `monthEnd` / `prevMonthKey`） |

净计：**+896 / −137**。

---

## 3. 逐条说明

### [D-05] P1 · 静态壳空白 + 构建时日期

**两个独立缺陷，一次修掉。**

**缺陷 A：`<Suspense fallback={null}>` 产出空白 HTML。**
`DataClient` 调用 `useSearchParams()`，Next.js 在静态预渲染时把到最近 Suspense 边界为止的客户端子树改为客户端渲染（`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` 明确记载这一 bailout）。fallback 为 null ⇒ 产出的 HTML 里这棵子树**完全是空的**，`loading.tsx` 成为永不生效的死代码。

修法：`fallback={<DataShell />}` —— 复用 `src/components/page-skeleton.tsx` 的现成零件（`SkeletonStatus` / `SectionSkeleton` / `SkeletonChart` / `SkeletonChip` / `SkeletonLine` / `SkeletonRow`）+ 既有 `QueryFormFallback`，不新造零件。

**验收（实测 `.next` 产物）**：

```
Route (app)
├ ○ /          ← Static
├ ƒ /api/data
├ ○ /data      ← ✅ 仍在静态路由表
```

**缺陷 B：「构建时日期」。**
原代码在 `DataClient` 渲染时算 `shanghaiToday()`，预设 chips 的 href 形如 `?type=expense&from=2026-09-22&to=2026-09-28`。它本身在客户端求值，但没有任何机制阻止后来者把它挪到模块作用域 —— 一旦挪了，就会在**构建机**上求值一次并冻进产物，「近 7 天」永远指向构建日，而且因为它是 `<a href>`，点下去得到一个看起来合理、实则过期的结果集。

修法不是加注释，是**改结构**：日期成为 `buildPresets(today)` 的入参。`presets.ts` 是纯函数，没有任何 `new Date()`，因此「构建日」这个状态在类型层面就不可表达。

**验收（实测预渲染 HTML，`.next/server/app/data.html`）**：

```
DATES in whole data.html: 0        ← 正则 20\d\d-\d\d-\d\d 全文件零命中
近 7 天支出 in data.html: 0         ← 预设链接根本没进静态 HTML
```

外加一条可执行断言（`query-params.test.ts`）：

```ts
it("构建后第 2 天访问，「近 7 天」指向访问日而非构建日", () => {
  const onBuild = buildPresets("2026-09-28").find(p => p.label === "近 7 天支出")!;
  const onVisit = buildPresets("2026-09-29").find(p => p.label === "近 7 天支出")!;
  assert.equal(onVisit.filter.to, "2026-09-29");
  assert.notEqual(onVisit.filter.to, onBuild.filter.to);
  assert.equal(onVisit.filter.from, shiftDays("2026-09-29", -6));
});
```

**这条断言在修复前写不出来** —— 旧代码里「今天」不是任何函数的入参，测试无法注入一个「第二天的时钟」。日期变成入参这件事本身就是修复。

### [D-11] P0 · 过滤注入

`acc` / `cat` 直接进 PostgREST `.or()` 过滤器表达式：

```ts
listQuery.or(`account_id.eq.${filter.account},to_account_id.eq.${filter.account}`)
```

`.or()` 是一条逗号分隔的过滤器 DSL，`?acc=1,or(id.not.is.null)` 能注入额外的 or 分支 —— 用户自己决定查询形状。`cat` 走 `.eq()`，危害小但同样未校验。

**修法**：`query-params.ts` 导出 `normalizeAccount` / `normalizeCategory`，用 UUID 正则卡死；`cat` 额外放行 `"none"`。**不匹配即丢弃该条件而非报错** —— 与客户端行为对齐，且地址栏参数本就允许被手工编辑，报错是最差选择。

同一个函数被 `route.ts` 与 `data-client.tsx` 共用，所以「与服务端同一份规则」这句话现在成立了（STRUCTURE.md 此前声称成立、实际不成立）。

> **为什么共用文件放在 `src/app/data/` 而不是 `src/lib/`**：`/api/data/route.ts` 与 `data-client.tsx` 分属两棵目录树。放在数据页目录里两边都从 `@/app/data/query-params` 导入，依赖方向是单向的（app → app），不会形成 `lib ↔ app` 循环。

`cat` 的 `"none"` 有专门断言（`normalizeCategory("None") === undefined`）—— 大小写不能被 UUID 分支吞掉，也不能掉进 else。

### [D-35] P0 · LIKE 注入

```ts
const value = escapeOrValue(`%${filter.q}%`);   // 修复前
```

未转义时 `?q=%25`（即 `%`）构造出 `%\%%` —— **匹配全部行**，绕过关键词语义并把结果顶到 200 笔。`_` 同理（LIKE 里是单字符通配符）。

**修法：两层转义，顺序固定。**

1. `escapeLikePattern`：`\` `%` `_` 加反斜杠（先转 `\` 再转 `%`/`_`，否则会被二次处理）
2. `escapeOrValue`：给 `.or()` 参数加引号并转义 `\` 与 `"`（否则一个引号就能把 or 参数列表拆开）

```ts
// 断言
escapeLikePattern("%")            === "\\%"
escapeOrValue(`%${escapeLikePattern("%")}%`) === '"%\\\\%%"'
```

### [D-15]§data · 类型逃逸

**先说事实：`data-client.tsx` 里 `as unknown as` 本来就是 0 个。** 审计第 372-373 行记录的是 `DashboardSnapshot` 那处（属 WP-2）。我的范围内真正的问题是**上一行的病因**：

`filtered_tx_stats` 与 `dashboard_snapshot` 在 `database.types.ts` 里声明为 `Returns: Json`，所以旧代码在**每个使用点**写 `Number(stats?.count ?? 0)` —— 那是手写断言，不是类型检查。Postgres `numeric` 经 PostgREST 回来可能是字符串 `"3210.00"`，`Number()` 恰好能救；换成别的字段顺序就静默显示 0。

**修法**：`payload.ts` 提供 `toFilteredTxStats` / `toSnapshot` 运行时收窄：

- 字符串数字 → `number`（含 NaN/Infinity 归零，绝不让 NaN 上屏）
- 形状不符 → `null`，而不是让 undefined 流进 JSX
- 缺失的可选数组 → `[]`，不炸

客户端因此删掉了全部 `Number()` 兜底与手写类型别名。`any` / `@ts-ignore` / `as unknown as` 三者均为 0。

### [D-44]§data · 计数不该用 .money

`.money` = mono 字体 + tabular-nums。笔数要的是**数字等宽**（多行列表逐行对齐），不是**字族等宽**。旧代码给「共 128 笔」套 `.money`，设置页的同一概念却是正文体 —— 同一产品里「N 笔」两种排版。

**修法**：改用 Tailwind 内置 `tabular-nums`，并给 `LIST_LIMIT` 补千分位（`200` → `200`，`1200` → `1,200`）。

**为什么没抽 `.num` 类**：那要动 `globals.css`（WP-1 所有）。跨包改设计系统类的收益不抵交接成本，且 `tabular-nums` 当下就能正确工作。接线项见 §5。

### [D-47] · 内联 IIFE + qs 双份逻辑

**两处**，不是一个：

1. 天数 chips 的 href 在 JSX 里用内联 IIFE 拼，每次渲染为 3 个 chip 各构造一次 `URLSearchParams`
2. 更要紧的是 qs 有**三份**实现：天数 chip 一份、预设 chip 一份（`daysQs` 手拼）、`/apiQs` 一份。预设里那个 `daysQs` 与 `apiQs` 的差别（`days === 90` 时省略）纯属历史偶然，却让「链接上的 qs」与「发给 API 的 qs」可能不一致

**修法**：`buildQueryString(filter, { days, alwaysDays })` 一个函数服务三处，参数顺序固定。断言：

```ts
it("同一天数下，链接 qs 与 API qs 逐字符一致", () => {
  const forChip = buildQueryString(filter, { days: 30 });
  const forApi  = buildQueryString(filter, { days: 30, alwaysDays: true });
  assert.equal(forChip, forApi);
  assert.equal(forChip, "from=2026-09-01&to=2026-09-28&type=expense&cat=none&min=10&days=30");
});
```

### [D-43]§data · 锚点偏移

**修法是「停止自写值」而不是「再写一个值」。** globals.css 已有统一规则：

```css
:target, section[id] { scroll-margin-top: var(--nav-scroll-offset); }
```

`#results` 是 `<section id="results">`，已被覆盖。旧代码里的 `scroll-mt-20`（80px）反而**覆盖**了统一变量，且不足以避开 iPhone 上约 99px 的移动端顶栏（`env(safe-area-inset-top)` + 52px）—— 点「重置」跳 `#results` 会被压在栏下。现已删除，改为注释说明为什么刻意不写。

### [D-17]§data · 骨架播报

`SkeletonStatus` 已带 `role="status" aria-busy="true"` + sr-only「掌灯中…」，但 `data-client.tsx` 的 loading 分支**一个都没用**（4 个裸 `div`），`loading.tsx` 是另一套写法且区块顺序已漂移。

**修法**：三条路径（静态壳 fallback / `loading.tsx` / client loading 分支）全部渲染同一个 `DataShellBody`。区块顺序严格镜像真实布局（趋势 → 资产曲线 → 常用查询 → 自定义查询 → 查询结果）。

> 拆分 `DataShell`（含 `<main>`）与 `DataShellBody`（不含）的原因：client 分支要把骨架塞进自己的 `<main>` 里，嵌套 `<main>` 是非法 HTML。

### 顺带：loading 与 error 从「每区块一份」收敛为「整页两态」

整页只有一次 `/api/data` 请求（`useApiData` 单路径），所以四个区块的 loading/error 在旧代码里是**同一个布尔值渲染四遍** —— 这正是审计抱怨的「N 个一模一样的错误面板」在数据页的成因。收敛后是一张带「重试」的整页错误面板（`<SectionError onRetry={reload} label="数据" />`），既去重复也接上了 WP-6 新加的重试能力（此前全站零调用点）。

### stats.ts 死代码核查

先看 WP-6 的 `stats.test.ts` 引用了哪些导出：`monthKey` `lastMonths` `accountBalances` `assetCurve` `categoryShare` `filterTxs` `summarizeTxs` `monthlyTrend` `TxLike` —— **除 `monthKey` 外全部仅被测试引用**。

结论：**没有可删的死代码。** 那些函数是刻意保留的纯函数（单测覆盖 23 个 suite），删掉会同时删掉测试。改为让它们**被真正用上**：[D-05] 的日期算术直接复用了 `monthKey` 的兄弟函数（`shiftDays` / `lastDayKeys` / `monthEnd` / `prevMonthKey`），并在文件头记录了逐个导出的使用状态。

修 `monthEnd` 一处真实 bug：原实现 `shiftDays(\`${key}-01\`, m)` 把「下月 1 号减一天」写成了「本月第 m 天」，2 月会返回 2 月 2 日。改用 `new Date(Date.UTC(y, m, 0)).getUTCDate()` 读天数，闰年交给 `Date` 判断。

---

## 4. 验收命令真实输出

**eslint（我改过的全部文件）**
```
$ npx eslint src/app/data src/app/api/data/route.ts src/lib/ledger/stats.ts
（无输出，exit 0）
```

**tsc**
```
$ npx tsc --noEmit
（无输出，exit 0）
```
全项目零错误，**不含属于我文件的任何错误**。

**单测**
```
$ npm test
ℹ tests 98
ℹ suites 23
ℹ pass 98
ℹ fail 0
```
（基线 57 → 98，新增 41 条全部属于 WP-3）

**next build**
```
✓ Generating static pages using 16 workers (11/11) in 534ms
Route (app)
┌ ○ /
├ ƒ /api/data
├ ○ /data        ← ✅ 静态路由表内
```

**静态 HTML 实测**
```
main id="main"                              ✅
role="status" + aria-busy="true" + 「掌灯中…」  ✅
panel 数量                                   5（与真实布局一致）
h1                                          曲线与查询
预渲染 HTML 内的日期                            0
预渲染 HTML 内的「近 7 天支出」                 0
```

---

## 5. 需其他包接线的点

### ① WP-1 · `.num` 计数类（[D-44] 完整版）

`globals.css` 是 WP-1 所有，我没动。当前数据页用 Tailwind 内置 `tabular-nums`，已正确。若要全站统一（推荐，但要改设计系统）：

```css
/* globals.css，紧邻 .money */
.num {
  font-variant-numeric: tabular-nums;
  /* 不改字体：计数要数字等宽，不要字族等宽 */
}
```

接线清单：
- `src/app/data/data-client.tsx` — `tabular-nums` → `num`（1 处，`ResultsSummary`）
- `src/app/settings/settings-client.tsx:263` — 补 `.num` + `toLocaleString("zh-CN")`（`12,345` 目前直接渲染 `12345`）
- DESIGN.md §八 排版表补一行

### ② WP-1 · 根级 `src/app/loading.tsx` 与 `/data` 静态壳的层级冲突

**这条需要 WP-1 决策，我无权处理。**

`src/app/loading.tsx`（12:22 由其他 WP 新增，overview 形状的骨架）比 `src/app/data/loading.tsx` **更外层**，因此在预渲染产物里它占据了可见槽位，`/data` 自己的 `DataShell` 落在内层 `S:0` 里（HTML 中 `data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"` 标记）。实测确认我的那份形状正确（5 个 panel、`role="status"`、零日期），但用户首屏看到的是**总览页的骨架**（各账户余额 / 本月预算进度）。

三个选项，请 WP-1 择一：
1. 删掉根级 `loading.tsx` —— 四页各自的 `loading.tsx` 已足够，根级那份是多余的
2. 把根级改成与路由无关的极简壳（不假设任何区块）
3. 接受现状（`/data` 首屏显示总览骨架，hydration 后才切换）

**我倾向 1**：它同时让 `/ledger` `/settings` 的首屏也各自正确。

### ③ WP-6 · 测试运行器的别名解析

`src/app/data/query-params.test.ts` 需要 import `presets.ts`，而后者用 `@/lib/ledger/stats`（Turbopack 与 `src/` 其余部分一致）。Node 的 `--experimental-strip-types` 不解析 `@/` 别名。

当前解法：在测试文件内注册一个 6 行 `registerHooks` 钩子 + 动态 import，自包含、不碰其他包。若 WP-6 愿意在 `scripts/ts-resolve-hooks.mjs` 里统一加 `@/` → `src/` 映射（该文件已有同类逻辑的先例与详细注释），我可以把那 12 行删掉。

### ④ WP-2 · `DashboardSnapshot` 的 `as unknown as`

审计 [D-15] 主体在 WP-2（`overview-client.tsx`）。若 WP-2 也希望复用收窄函数，`payload.ts` 里的 `toSnapshot` 已按 `/api/data` 的形状写好，但 `/api/overview` 的 `snapshot` 字段形状可能不同 —— **不要直接复用**，先确认字段一致。

---

## 6. 未做的事（及原因）

- **没跑浏览器端验证**：Chrome 在本机启动失败（`DevToolsActivePort` 写入前退出），hydration 行为与 chip 实际 href 未经真机点击验证。构建产物 + 41 条单测已覆盖静态侧与纯函数侧，交互侧留待人工点验。
- **没删 stats.ts 的聚合函数**：见 §3 末，测试已覆盖，删了会连带删测试。
- **没动 `globals.css` / `DESIGN.md` / `STRUCTURE.md`**：非本包所有权。
- **没做 git 写操作**（无 commit / stash / checkout）。
