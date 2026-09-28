# WP-3 审核报告 —— data 数据查询页 + 过滤注入防护

- 审核员：专职审核员（只审查/验收/提交，不写业务代码）
- 审核范围：`src/app/data/**` · `src/app/api/data/route.ts` · `src/lib/ledger/stats.ts`
- 审核时基线：`a8b3d03`（WP-1 已入库）；工作区落盘未提交
- 结论：**不通过 —— 3 条缺陷（1 条阻塞提交，2 条须修正后复验）**

---

## 0. 判定摘要

| 维度 | 结论 | 一句话 |
|---|---|---|
| 1 安全 | **通过** | UUID 校验与 LIKE 转义均以**真实 HTTP 请求打到真实 PostgREST 查询串**验证，注入被丢弃、`?q=%` 不再匹配全表 |
| 2 正确性 | **不通过** | 静态壳/日期修复有效，但 `stats.ts` 头部注释含**两处指向不存在文件的事实错误**（D-1） |
| 3 可访问性 | **通过** | 骨架 `role=status` + `aria-busy` + sr-only、`id="main"`、标题层级、44px 触控目标均达标 |
| 4 代码质量 | **不通过** | 新测试存在 1 处**变异存活盲区**（D-2）；`stats.ts` 注释错误（D-1） |
| 5 测试与验证 | **不通过** | `npm test` 98/98 绿、`tsc`/`eslint` 在本包范围干净；但**全量 `next build` 因并行 agent 在途未取得干净结果**（D-3） |

> 施工方自报的 4 项待接线中，②（根级 `loading.tsx` 冲突）**已被并行 agent 解决**（文件已删除并 staged），③（测试别名 hook）仍然成立，④（`stats.ts:6` 注释过期）**成立且比自报更严重**（不止一处，且含事实错误）。

---

## 1. 安全（本包重点）—— 通过

### 1.1 [D-11] UUID 校验真的挡住了 PostgREST `or()` 注入 —— 实测

不接受「只看代码」。做法：起一个本地 mock PostgREST + auth 服务端，把 `NEXT_PUBLIC_SUPABASE_URL` 指过去，**原样 import 真实的 `src/app/api/data/route.ts`**（不改一行），用真实 `NextRequest` 打过去，记录**实际上线的 query string**。

| 输入 | 状态码 | 实际上线的 transactions 查询 | 判定 |
|---|---|---|---|
| （无参数，基线） | 200 | `?select=…&order=…&limit=200` | 基线 |
| `?acc=1,or(id.not.is.null)` | 200 | `?select=…&order=…&limit=200` | **丢弃，与基线逐字符相同** |
| `?acc=x).or(1.eq.1` | 200 | 同基线 | 丢弃 |
| `?acc=not-a-uuid` | 200 | 同基线 | 丢弃 |
| `?acc=11111111-2222-4333-8444-555555555555` | 200 | `&or=(account_id.eq.1111…,to_account_id.eq.1111…)` | 合法 UUID **保留** |
| `?acc=3F9C1D2E-…`（大写） | 200 | `&or=(account_id.eq.3F9C1D2E-…,…)` | 大写 UUID 保留 |
| `?cat=' or 1=1--` | 200 | 同基线 | 丢弃 |
| `?cat=none` | 200 | `&category_id=is.null` | 哨兵值正确落 `is.null` |
| `?cat=1111…5555` | 200 | `&category_id=eq.1111…5555` | 保留 |
| `?acc=1,or(id.not.is.null)&q=%` | 200 | 只剩 `q` 的 `or=(counterparty.ilike…,note.ilike…)` | acc 丢弃、q 生效 |

**关键证据**：恶意 `acc` 的上线查询串与「完全不传 `acc`」**逐字符一致**，且**没有出现任何 `or=(account_id…` 片段**。注入被真实挡在 `.or()` 之外。

### 1.2 [D-35] LIKE 转义真的让 `?q=%` 不匹配全表 —— 实测（两层证据）

**证据 A（线上 query string）**：`?q=%25` 实际上线的是
```
or=(counterparty.ilike."%\\%%",note.ilike."%\\%%")
```
即用户输入的 `%` 变成**字面量** `\%`，两端的 `%` 才是通配符。

**证据 B（真 SQL 引擎求值）**：用 `node:sqlite` 建 6 行 fixture，按 Postgres `ILIKE` 同样的「反斜杠为默认转义符」语义求值：

| `q` | 实际 SQL 模式 | 命中行数 | 判定 |
|---|---|---|---|
| `%` | `%\%%` | **1 / 6** | 定点匹配，不是全表 |
| `_` | `%\_%` | 1 / 6 | 定点 |
| `%_%` | `%\%\_\%%` | **0 / 6** | 零命中 |
| `咖啡` | `%咖啡%` | 1 / 6 | 正常 |
| `100% 折` | `%100\% 折%` | 1 / 6 | 正确转义 |
| `a_b` | `%a\_b%` | 1 / 6 | `_` 已转义 |
| **对照组：未转义（修复前的行为）** | `%%%` | **6 / 6** | **全表命中 —— 正是被守住的回归** |

对照组是本条最有力的证据：同一个 fixture，修复前 6/6，修复后 1/6。

### 1.3 校验失败是「丢弃条件」而非报错 —— 与客户端一致 —— 通过

- `parseQueryFilter` 每个分支都是「不匹配即 `undefined`」，不抛错、不返回错误标记（`query-params.ts:125-139`）。
- 实测：恶意 `acc` 的响应码是 **200**（不是 400/403），且其余条件照常生效 —— 丢的是这一个条件，不是整份查询（`query-params.test.ts:92-100` 断言同一行为）。
- 客户端与服务端共用同一份实现（`route.ts:37` 调 `parseQueryFilter`，`data-client.tsx:258` 调同一个函数），「与服务端同一份规则」这句话**现在成立了**。

---

## 2. 正确性 —— 不通过（D-1）

### 2.1 [D-05] 静态壳不再产出空白 HTML —— 通过

实测构建产物 `.next/server/app/data.html`（47730 字节）：`<main id="main">` 存在、`role="status"` + `aria-busy="true"` + sr-only「掌灯中…」齐备、骨架面板成组出现。`next build` 路由表 `/data` 仍为 `○ (Static)`。原 `fallback={null}` 导致的空子树已消除。

### 2.2 构建日已在类型层面不可表达 —— 通过

- `presets.ts:37` 的签名是 `buildPresets(today: string)`，文件内**零 `new Date()`**（已 grep 确认）。
- `stats.ts:198` 的 `shanghaiDate()` 是**函数**而非模块级常量（`stats.ts:191-197` 明确注释了这个区别）。
- 产物侧交叉验证：静态 HTML 全文正则 `20\d\d-\d\d-\d\d` **0 命中**；预设链接文案「近 7 天支出」在静态 HTML 中 **0 命中**（即预设根本没进静态 HTML，不可能带构建日）。
- 变异测试佐证：把 `buildPresets` 的 `today` 参数改写成硬编码常量 → 测试**立即失败 5 条**（`fail 5`），说明这条性质真被钉住了。

### 2.3 访问日变化时 preset 是否正确 —— 通过

`buildPresets(visitDay)` 的 `to` 恒等于访问日；`近 7 天` = `shiftDays(today,-6)..today`（含头含尾 7 天，测试用 `Date.parse` 差值独立复核 = 6 天 + 首尾 = 7）；`上月` 用真实月末（2026-08 → 08-31，2028 闰年 02 → 02-29）；跨年 `2027-01` → `2026-12`。变异测试：把窗口改成 `-7` → 失败 1 条，被钉住。

### 2.4 职责划分与过度设计 —— 通过

`query-params.ts`（纯参数契约，客户端/服务端共用）、`payload.ts`（载荷类型 + 运行时收窄）、`presets.ts`（预设数据，日期为入参）、`data-shell.tsx`（骨架单一来源）四者边界清晰，均为纯函数/单一职责，无冗余抽象。`DataShell`（含 `<main>`）与 `DataShellBody`（不含）的拆分有正当理由（避免嵌套 `<main>`）。

### 2.5 【缺陷 D-1】`stats.ts` 头部注释含两处事实错误 —— 阻塞提交

- **文件**：`src/lib/ledger/stats.ts`
- **位置**：`:6` 与 `:181`（同一处错误写了两遍），另 `:7` 一处

`:6`
```
//   shanghaiDate  → src/app/data/date-window.ts（数据页日期口径，唯一的日期来源）
```
`:181`
```
// 所以这层收敛在本文件，`src/app/data/date-window.ts` 是它唯一的调用点。
```

**为何是缺陷（三条，均可复验）**：
1. **`src/app/data/date-window.ts` 根本不存在**。`ls src/app/data/date-window.ts` → `No such file or directory`；`grep -rn "date-window" src/` → **0 命中**。注释指向一个不存在的文件，读者按图索骥只会扑空 —— 这正是 round1 审计 [D-39] 记录过的同类病（文档里列的路径在仓库中找不到）。
2. **「唯一的调用点」是错的**。实测调用方有 **3 个文件**：`src/app/data/data-client.tsx`（`lastDayKeys`/`shanghaiDate`）、`src/app/data/presets.ts`（`shiftDays`/`monthEnd`/`prevMonthKey`）、`src/app/ledger/transaction-form.tsx`（`shanghaiDate`）。
3. **`:7` 声称 `filterTxs`/`TxFilter` 是「`query-params.ts` 的类型基准」，也是假的**。`query-params.ts` 里 `grep "stats\|TxFilter\|filterTxs"` → **0 命中**；`query-params.ts` 自定义了 `QueryFilter`，两者无任何引用关系。`filterTxs` 的真实调用方只有 `stats.test.ts`。

**为何阻塞**：这段注释是 WP-3 本次**新增**的（`git diff` 显示 `stats.ts` +84 行全为新增含注释），且它是本包解释「为什么这些函数还活着」的唯一依据。一段用来防死城的注释，自己引入了三处死路径，比没有注释更糟。

**修复步骤**（可直接执行）：
1. 把 `:6` 的 `→ src/app/data/date-window.ts（数据页日期口径，唯一的日期来源）` 改为
   `→ src/app/data/data-client.tsx · src/app/data/presets.ts · src/app/ledger/transaction-form.tsx（三个调用方）`
2. 把 `:181` 的 `src/app/data/date-window.ts 是它唯一的调用点` 改为
   `调用方是 src/app/data/{data-client,presets}.ts 与 src/app/ledger/transaction-form.tsx`
3. 把 `:7` 的 `→ src/app/data/query-params.ts 的类型基准` 改为
   `→ 仅 src/lib/ledger/stats.test.ts 直接引用（与服务端 SQL 规则对照用）`

**复验命令**：
```bash
grep -rn "date-window" src/                      # 期望 0 命中
grep -n "shanghaiDate\|shiftDays" src/app/data/*.tsx src/app/ledger/transaction-form.tsx
npm test && npx tsc --noEmit && npx eslint src/lib/ledger/stats.ts
```

### 2.6 施工方关于 [D-15] 的说法 —— 核实为真

施工方称「`data-client.tsx` 里 `as unknown as` 本来就是 0 个」。核实：
```
git show HEAD:src/app/data/data-client.tsx | grep "as unknown as"   → 0 命中
```
**说法成立**。审计第 372-373 行记录的是 `DashboardSnapshot`（属 WP-2）。施工方的判断准确，未夸大。

**「手写 `Number()` 断言被真正替代」也已核实**：`Number(` 在 `data-client.tsx` 中由基线的 **15 处**降到 **2 处**，且这 2 处都不是断言 —— 一处是注释文本（`:78`），一处是 `snapDays(raw === null ? undefined : Number(raw))`（`:261`，参数解析器，属于校验而非断言）。`any` / `@ts-ignore` / `as unknown as` 三者在 WP-3 范围内均为 **0**。

---

## 3. 可访问性 —— 通过

- **骨架播报**：三条路径（静态壳 fallback / `loading.tsx` / client loading 分支）全部渲染同一 `DataShellBody` → `SkeletonStatus`，实测产物含 `role="status"`、`aria-busy="true"`、`<span class="sr-only">掌灯中…</span>`。与 `loading.tsx` 同源，不再漂移。
- **`id="main"`**：`data-shell.tsx:94` 与 `data-client.tsx:330` 均带 `id="main"`，skip link（WCAG SC 2.4.1）落点成立。
- **`#results` 的 scroll-margin**：`globals.css:75-78` 有统一规则 `:target, section[id] { scroll-margin-top: var(--nav-scroll-offset); }`；`#results` 是 `<section id="results">`（`data-client.tsx:404`），**已被覆盖**。`data-client.tsx` 内 `scroll-mt-*` 实测 **0 处**（仅注释中提及）。[D-43]§data 达成。
- **标题层级**：`h1`（`data-shell.tsx:39`「曲线与查询」）→ 5 个 `h2`，无跳级。
- **触控目标**：天数 chip 与预设 chip 均带 `min-h-[44px]`（`data-client.tsx:361`、`:377`），符合项目 44px 约定。
- **状态播报**：`ResultsSummary` 带 `aria-live="polite"`；金额用 `sr-only` 文本 + `aria-hidden` 视觉副本，读屏不丢信息。

> 附注（非本包引入）：`query-form-fallback.tsx` 自带 `role="status"`，被 `SkeletonStatus` 包住后形成**嵌套 live region**。该文件 WP-3 未改动（`git status` 为空），且基线 `data/loading.tsx:13/47` 已是同样嵌套，属**继承的既有问题**，不计入本包缺陷。

---

## 4. 代码质量 —— 不通过（D-2）

### 4.1 `stats.ts` 改动与 WP-6 的 `stats.test.ts` 兼容 —— 通过

`npm test` 全量 **98 passed / 0 failed / 23 suites**（基线 57 → 98，新增 41 条全属 WP-3）。WP-6 的 `stats.test.ts` 覆盖 `filterTxs`/`accountBalances`/`summarizeTxs`/`monthlyTrend`/`categoryShare`/`assetCurve` 全部通过，本包对 `stats.ts` 的改动（新增日期算术 + 修 `monthEnd`）**未打破任何既有断言**。

`monthEnd` 的修复经变异测试确认真实有效：把 `new Date(Date.UTC(y, m, 0)).getUTCDate()` 退回 `m` → **失败 4 条**。

### 4.2 【缺陷 D-2】`query-params.test.ts` 存在 1 处变异存活盲区

用**变异测试**（逐个注入缺陷 → 跑 `npm test` → 还原，共 14 个变异，每次都做字节级还原校验）判定测试是否真在测行为：

```
baseline: pass=98 fail=0
killed   [D-11] normalizeAccount 接受任意串（重开 or() 注入）        fail=4
killed   [D-11] cat 丢掉 "none" 哨兵分支                            fail=3
killed   [D-11] isUuid 锚定正则 -> 松散子串匹配                      fail=1
killed   [D-35] escapeLikePattern 变成空操作                          fail=5
killed   [D-35] escapeOrValue 去掉引号包裹                           fail=2
killed   [D-47] buildQueryString 默认值也输出 days                   fail=1
killed   [D-35] parseQueryFilter 不再截断 q                          fail=1
killed   [D-05] buildPresets 忽略 today 入参（冻结构建日）           fail=5
killed   [D-05] 「近 7 天」窗口差一天（-7）                          fail=1
SURVIVED [D-15] toNum 让 NaN 直通          <-- 盲区                 fail=0
killed   [D-15] toFilteredTxStats 不收窄                             fail=3
killed   stats: monthEnd 差一天（2 月 bug）                          fail=4
killed   stats: shiftDays 用本地时间字段（DST/时区回归）            fail=6
killed   stats: prevMonthKey 跨年断裂                                fail=3

mutations applied: 14  killed: 13  survived: 1
all source files restored byte-identical: True
```

- **文件**：`src/app/data/payload.ts:50-57`（`toNum`）与 `src/app/data/query-params.test.ts:386-390`
- **存活原因**：`toNum` 有**两条** NaN 防线 —— `:51`（`typeof v === "number"` 分支的 `Number.isFinite(v) ? v : 0`）与 `:54`（`typeof v === "string"` 分支的 `Number.isFinite(n) ? n : 0`）。现有测试
  ```ts
  const stats = toFilteredTxStats({ count: Number.NaN, expense: Number.POSITIVE_INFINITY })!;
  ```
  传的是**真正的 number**，只走到 `:51`。把 `:54` 的防线拆掉（`return Number(v)`），测试仍然全绿。
- **为何是缺陷**：这是一个**未被测试保护的真实分支**。实测该分支一旦失守：
  ```
  变异体：toFilteredTxStats({count:'abc', expense:'NaN', income:'Infinity'})
         → {"count":null,"expense":null,"income":null}   ← NaN 上屏（JSON 序列化为 null）
  现版本：同上输入
         → {"count":0,"expense":0,"income":0}            ← 正确
  ```
  PostgREST 的 `numeric` 列回来是**字符串**（`payload.ts:19-20` 自己就是这么写的），所以生产上真正会命中的是**字符串分支**，恰恰是当前测不到的那条。文件头注释承诺「数值统一经 `toNum`……含 NaN/Infinity 归零，绝不让 NaN 上屏」，而这条承诺的字符串路径无测试背书。
- **修复步骤**：在 `query-params.test.ts` 的「NaN / Infinity 不进结果」用例里补字符串入参（同文件 `:386` 附近）：
  ```ts
  // 字符串分支同样不得产出非有限值（PostgREST 的 numeric 列回来就是字符串）
  const strStats = toFilteredTxStats({ count: "abc", expense: "NaN", income: "Infinity" })!;
  assert.equal(strStats.count, 0);
  assert.equal(strStats.expense, 0);
  assert.equal(strStats.income, 0);
  ```
- **复验命令**：
  ```bash
  npm test
  # 再跑一次变异确认这条也 killed：把 payload.ts:54 的
  #   return Number.isFinite(n) ? n : 0;   改成   return Number(v);
  # 期望 npm test 出现 fail > 0
  ```

### 4.3 383 行测试是否真在测行为 —— 通过

除 D-2 那一处外，测试质量经得起推敲：断言的是**可观察行为**（URL 串、转义后的模式、日期窗口跨度、载荷收窄结果），不是实现细节；多处用**独立算法交叉验证**（如用 `Date.parse` 差值独立复核 7 天窗口、用 `Object.fromEntries` 做序列化往返一致性）；时区测试通过改 `process.env.TZ` 跑三个时区验证纯算术不漂移。**不是凑行数的测试。**

---

## 5. 测试与验证 —— 不通过（D-3，外部阻塞）

### 5.1 已取得的干净结果

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | 本包范围 **0 错误**（详见 5.2） |
| `npx eslint src/app/data src/app/api/data/route.ts src/lib/ledger/stats.ts` | **exit 0，0 error 0 warning** |
| `npm test` | **98 passed / 0 failed / 23 suites** |
| 恶意 query 实测（18 个用例） | 全部符合预期，见 §1 |
| `node:sqlite` LIKE 求值 | 见 §1.2 |
| 变异测试 | 14 变异，13 killed / 1 survived |

### 5.2 【缺陷 D-3】`next build` 未取得干净结果 —— 并行 agent 在途，非本包缺陷

按审核开始时的状态，`npm run build` 曾**成功**通过（路由表四页全 `○`，`/data` 为 Static）。但审核期间，并行 WP-6 agent 正在改 `src/lib/api/**`，导致：

```
$ npm run build
✓ Compiled successfully in 421ms
   Running TypeScript ...
src/lib/api/session.ts(78,46): error TS2454: Variable 'data' is used before being assigned.
Failed to type check.
BUILD_EXIT=1
```

**核实结论 —— 这不是 WP-3 造成的**：
- 报错文件 `src/lib/api/session.ts` 属 WP-6 所有权，WP-3 未修改（`git status` 中该文件为 WP-6 的 `M`）。
- `npx tsc --noEmit` 全量输出**只有这一类错误，且全部落在 `src/lib/api/**`**，WP-3 范围（`src/app/data/**`、`src/app/api/data/route.ts`、`src/lib/ledger/stats.ts`）**0 错误**。
- 该文件在审核期间被持续改动（mtime 13:29 → 13:31），随后 WP-6 又新增了 `src/lib/api/session-outcome.test.ts`（其自身有 3 条 TS 错误），属**明确的在途半成品**。

**已做的等待**：按指示轮询 `npx tsc --noEmit`（每 30s，上限 20 分钟），等待 WP-6 完工。**截至本报告写完，WP-6 仍在改动其文件，未取得全量干净结果。**

**因此本包标记为「待复验」，本次不提交。** WP-3 自身维度已全部取得干净结果，唯独全量 build 被外部阻塞。

**复验命令**（WP-6 完工后由任一方执行）：
```bash
mkdir .hermes/.build-lock 2>/dev/null || { sleep 10; }   # 拿不到锁则重试
npm run build
rmdir .hermes/.build-lock
# 期望：Failed to type check 不出现；路由表 /data 仍为 ○ (Static)
```

---

## 6. 额外必查项：畸形 payload 实测

`toFilteredTxStats` / `toSnapshot` 对 16 类畸形输入（真实执行，非代码走查）：

| 输入 | 结果 | 非有限值 | 原型污染 |
|---|---|---|---|
| `null` / `undefined` / `"nope"` / `42` / `[1,2,3]` | `null`（形状不符） | 否 | 否 |
| `{}` | 收窄为全 0 + 空数组 | 否 | 否 |
| `{count:null, by_category:null, accounts:null}` | 收窄为 0 / `[]` | 否 | 否 |
| `{count:NaN, expense:Infinity, transfer:-Infinity}` | 全部归 **0** | 否 | 否 |
| `{count:"999…9"(24位), expense:"1e400"}` | 有限值（`1e400`→0） | 否 | 否 |
| `{count:"  12  ", expense:""}` | `12` / `0` | 否 | 否 |
| `{count:true, expense:false}` | `0` / `0` | 否 | 否 |
| `{count:[1], by_category:["x",null,5]}` | `0` / `by_category:[]` | 否 | 否 |
| `{by_category:{a:1}, months:"2026-09"}` | `[]` / `[]` | 否 | 否 |
| `daily:[{date:null,delta:"abc"},null,7,"x"]` | 逐项收窄，不炸 | 否 | 否 |
| `JSON.parse('{"__proto__":{"polluted":true},…}')` | 正常收窄 | 否 | **否** |

**结论**：无抛出、无 NaN/Infinity 泄漏、无原型污染。`isRecord` 正确排除数组，`toNum`/`toStr`/`toArr` 对错型一律降级。形状良好的载荷完整无损（实测 `"128"→128`、`"3210.00"→3210`、`"-3"→-3`）。**运行时收窄对畸形输入是安全的。**

---

## 7. 待接线清单（施工方自报 + 本次核实更新）

| # | 项目 | 状态 |
|---|---|---|
| ① | `.num` 计数类 | **已可接线**。施工方称「`.num` 未落地」——**该前提已不成立**：`globals.css:297` 现已有 `.num { font-variant-numeric: tabular-nums; }`（WP-1 并行加入，**尚未提交**）。当前 `data-client.tsx:85` 用的是 Tailwind `tabular-nums`，**渲染结果与 `.num` 完全等价**，故无功能缺陷；但按 DESIGN.md §八，计数应走 `.num`。建议 WP-1 提交 globals.css 后，把 `data-client.tsx:85` 的 `tabular-nums` 换成 `num`，并同步删掉 `:68` 那段已过期的注释。**本包不改**（globals.css 非本包所有权）。 |
| ② | 根级 `loading.tsx` 层级冲突 | **已解决**。该文件在审核期间被并行 agent **删除并 staged**（`git status` 显示 `D  src/app/loading.tsx`）。DESIGN.md §七.2 已写入硬规则「不设根级 `src/app/loading.tsx`」，并附删除前后 `<main>` SHA-256 比对。**本包未动该文件**（明令不得删）。 |
| ③ | 测试里的自包含 `@/` 解析 hook（12 行） | **仍成立**。`query-params.test.ts:41-51` 确实自带 `registerHooks` + 动态 import。WP-6 若在 `scripts/ts-resolve-hooks.mjs` 统一加 `@/`→`src/` 映射，这 12 行可删。 |
| ④ | `stats.ts:6` 注释过期 | **成立且更严重** → 已升级为阻塞缺陷 **D-1**（两处指向不存在的 `date-window.ts` + 一处虚假引用关系）。 |

---

## 8. 未验证项（如实标注）

1. **真机浏览器验证缺失** —— 施工方报告本机 Chrome 启动失败；本次审核**同样未做**（无浏览器环境）。因此以下均为**未验证**：hydration 实际行为、chip 的实际 `href` 点击结果、`role="status"` 的实际播报、skip link 的实际跳转、iPhone 安全区下的锚点落点。静态侧与纯函数侧已由构建产物 + 98 条单测 + 18 例恶意 query 实测 + 变异测试覆盖。
2. **`next build` 全量干净结果** —— 被 WP-6 在途阻塞（D-3）。审核早期的 build 曾通过，但那**早于**并行改动，不能代表当前状态。
3. **真实 Supabase/PostgREST 行为** —— 本次用 mock 记录**实际上线的 query string**（这是注入防护的关键证据），但**未连真实数据库**。Postgres 对 `%\%%` 的求值用 `node:sqlite` 按同样的反斜杠转义规则模拟，与 Postgres `ILIKE` 默认转义符一致，但非 Postgres 本体。
4. **RLS 行为** —— 未验证。审计 [D-11] 已指出 RLS 会兜住行级越权，本次未实测 RLS。

---

## 9. 缺陷清单（汇总）

| ID | 严重度 | 文件:行 | 阻塞提交 | 修复 |
|---|---|---|---|---|
| **D-1** | 中 | `src/lib/ledger/stats.ts:6`、`:181`、`:7` | **是** | 三处注释指向不存在的 `date-window.ts` / 虚假引用关系，按 §2.5 步骤改为真实调用方 |
| **D-2** | 低 | `src/app/data/payload.ts:54` + `query-params.test.ts:386` | 否（但须补） | 补字符串入参的 NaN 用例，见 §4.2 |
| **D-3** | 外部 | `src/lib/api/**`（WP-6） | 否（外部阻塞） | 等 WP-6 完工后重跑 build，见 §5.2 |

**判定：不通过。** D-1 须修正；D-3 须在 WP-6 完工后取得干净 build；D-2 建议同批补上。三者闭环后本包可提交，提交时 scope 用 `data`。
