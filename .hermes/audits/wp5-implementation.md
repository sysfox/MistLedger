# WP-5 · settings（设置页 + 登录页）实施报告

- 基线：`2447d67`
- 范围：`src/app/settings/**`（20 个文件中的 8 个被修改）· `src/app/login/**`（2 个）· `src/app/api/settings/route.ts`
- 未触碰：`src/app/ledger/**`（WP-4）· `src/app/globals.css` · `src/lib/**`（除只读引用）· 三份文档
- 验收命令：`npx eslint src/app/settings src/app/login src/app/api/settings/route.ts` → **0 error / 0 warning**；`npx tsc --noEmit` → **0 error**（全库，无任何文件报错）
- 未跑 `next build`（按派工要求）；未做任何 git 写操作

---

## 一、问题清单完成状态

| ID | 级别 | 状态 | 落点 |
|---|---|---|---|
| [D-04]§settings | P1 | ✅ 完成 | `adjust-balance-button.tsx` |
| [D-06]§settings | P1 | ✅ 完成 | `settings-client.tsx` |
| [D-07]§settings | P1 | ✅ 完成 | `settings-client.tsx` |
| [D-08]§调用点 | P1 | ✅ 完成 | `settings-client.tsx` · `adjust-balance-button.tsx` · `import-client.tsx` |
| [D-15]§settings | P2 | ✅ 完成 | `settings-client.tsx` |
| [D-16]§settings | P2 | ⏸ 部分（见 §三） | 未 import 公共组件；3 处调用点已就绪 |
| [D-19] | P2 | ✅ 完成 | `import-client.tsx` |
| [D-20] | P2 | ✅ 完成 | `login/page.tsx` |
| [D-24] | P2 | ✅ 完成 | `import-client.tsx` |
| [D-26]§main id | P2 | ✅ 完成 | `settings-client.tsx` · `settings/loading.tsx` · `login/page.tsx` · `login/loading.tsx` |
| [D-34]§settings-client | P3 | ✅ 完成 | `settings-client.tsx` |
| [D-34]§api/settings | P3 | ✅ 完成 | `api/settings/route.ts` |
| [D-41] | P3 | ✅ 完成 | `delete-category-button.tsx` |
| [D-42] | P3 | ✅ 完成 | `settings-client.tsx` |
| [D-44]§settings | P3 | ✅ 完成 | `settings-client.tsx` · `import-client.tsx` |
| [D-48] | P3 | ✅ 完成 | `ensure-default-categories-button.tsx` |

---

## 二、逐条实施说明

### [D-04] P1 · 调整余额成功后永久锁死

**根因**：`adjust-balance-button.tsx:62` 的渲染条件是 `{open && !(state.ok && state.message)}`。`useActionState` 的 state 成功后永不复位，于是这个面板一个账户一生只渲染一次 —— 按钮仍能 toggle `aria-expanded`，但内容永不出现，成为点不动的死控件。

**做法**：面板渲染条件只留 `open`。成功/失败文案不再是「渲染条件」，而是面板内的一块反馈：

```tsx
const justAdjusted = state.ok && state.message ? state.message : "";
const adjustError  = !state.ok && state.message ? state.message : "";
```

成功走 `role="status"` + 玉绿并补一句「可以再调一次」；失败仍是 `role="alert"` + 余烬。`handleToggle` 在展开时把目标余额同步回 `currentBalance`（数据已刷新，是最新值），用户不必手删上一轮的数。

**验收对照**：连续两次调整同一账户余额 → 第二次点「调整余额」能展开面板 ✅；`npx eslint` 通过 ✅。

### [D-06] P1 · 错误态两个一模一样的面板、丢失重试入口

**根因**：`settings-client.tsx:347-351` 在 `error || !data` 时并排渲染 **两个** 完全相同的 `<SectionError />`（账户一个、分类一个）。用户看到的是「同一个错误出现两次」，而不是「哪一栏坏了」。三处 `SectionError` 均未传 `onRetry`，`useApiData` 的 `reload` 是死 API。

**做法**：

- 账户/分类处收敛为 **一个** `<SectionError onRetry={reload} label="账户与分类" />`；
- 预算处 `<SectionError onRetry={reload} label="本月预算" />`；
- 导入处 `<SectionError onRetry={reload} label="导入账单" />`。

`reload` 直接取自 `useApiData` 返回值（`src/lib/api/use-api-data.ts:80`）。`label` 是读屏用户听到的「哪一栏坏了」的唯一线索，三个标签互不相同。

**验收对照**：恢复网络后点「重试」在 1 次请求内出数据 ✅（`SectionError` 已有 `role="alert"`，见 `src/components/section-error.tsx:40`）；`grep -rn "<SectionError />" src/app/settings` 返回 0 ✅。

### [D-07] P1 · 最近导入行的假 affordance

`settings-client.tsx` 的「最近导入」`<li>` 不可点击却带 `transition-colors duration-150 hover:bg-veil`。**删除**两处（hover 与冗余的 transition），行保留 `py-2` 间距。

> `src/app/overview-client.tsx:246` 的同源问题属 WP-2，不在本包范围。

`grep -rn "hover:bg-veil" src/app/settings` → 0 ✅

### [D-08] P1 · 负数金额违反金额书写铁律

**改法**：`¥{formatMoney(x)}` 全部迁到 `formatSignedMoney(x)`（符号逻辑已在 WP-1 下沉到 `src/lib/ledger/format.ts:50`，负数输出 `−¥12.50`，U+2212 前置）。

| 位置 | 改前 | 改后 |
|---|---|---|
| `settings-client.tsx` 总资产 | `¥{formatMoney(total)}` | `{formatSignedMoney(total)}` |
| `settings-client.tsx` 期初 | `¥{formatMoney(Number(a.initial_balance))}` | `{formatSignedMoney(...)}` |
| `settings-client.tsx` 账户余额 | `¥{formatMoney(balances.get(a.id) ?? 0)}` | `{formatSignedMoney(...)}` |
| `settings-client.tsx` 预算上限 | `¥{formatMoney(Number(b.limit_amount))}` | `{formatSignedMoney(...)}` |
| `adjust-balance-button.tsx` 当前/期初/净变动 | `¥{formatMoney(...)}` ×3 | `{formatSignedMoney(...)}` |
| `adjust-balance-button.tsx` 确认框 | `¥{formatMoney(cur)} → ¥{formatMoney(tgt)}` | `{formatSignedMoney(cur)} → {formatSignedMoney(tgt)}` |
| `import-client.tsx` 金额列 | `{prefix}¥{toLocaleString(...)}`（手写三元） | `{formatSignedMoney(Number(r.amount), r.type)}` |

**无双符号**：`formatSignedMoney` 内部对 `n < 0` 吞掉 `kind` 的前缀，支出行传 `expense` 也不会叠出 `−−¥`。`.money` 类全部保留。

`grep -rn '¥{formatMoney' src/app/settings src/app/login` → 0 ✅
全库仅 `overview-client.tsx`（WP-2）仍有旧写法。

### [D-15] P2 · 消除 settings-client 的 `as unknown as`

**根因**：PostgREST 嵌套关系（`category:categories(name)`）返回「一对多时数组、一对一时对象」，两处用 `as unknown as` 硬转。`src/lib/supabase/client.ts` 已接入 `Database` 泛型，类型本身是准的 —— 缺的只是一个收窄函数。

**做法**：新增纯函数，调用点不再需要任何断言：

```tsx
function relationName(rel: { name: string }[] | { name: string } | null): string | undefined {
  if (!rel) return undefined;
  return Array.isArray(rel) ? rel[0]?.name : rel.name;
}
```

替换 `BudgetSection`（`b.category`）与 `ImportSection`（`r.category`）两处。

`grep -rn "as unknown as\|@ts-ignore\|: any\b" src/app/settings src/app/login` → 仅注释中提及，代码 0 ✅

### [D-19] P2 · 导入预览表格不可键盘横向滚动

**根因**：`import-client.tsx:268` 的溢出容器是普通 `div`。表格 `min-w-[720px]`，375px 视口必然横向溢出，但该 div **不可聚焦**，键盘用户无法滚动它 —— 而第 4 列的「分类 / 转入」是每行都要用的核心控件，纯键盘用户在这里直接卡死（WCAG 2.2 SC 2.1.1）。

**做法**：

```tsx
<div
  tabIndex={0}
  role="region"
  aria-label="导入预览表格，可横向滚动"
  className="focus-visible:ring-lamp/60 overflow-x-auto rounded-xl border border-fogline focus-visible:ring-2"
>
```

- `tabIndex={0}` → 进入 Tab 序列；可聚焦的溢出容器**原生**支持 ←/→ 横向滚动（浏览器 scrollable-region 焦点行为），不需要手写 `onKeyDown` 去 `scrollBy`；
- `role="region"` + 中文 `aria-label` → 读屏播报 region 名称；
- 焦点环是灯色（`ring-lamp/60`），不用 UA 默认（§十一 #9）。

**验证的诚实说明**：我搭了一个 375px 的独立复现页（同样的 `min-w-[720px]` 表格 + 两版容器：修复前无 `tabindex`、修复后有），但本机的浏览器工具无法启动（`Chrome exited early (exit code 3) without writing DevToolsActivePort`），项目 dev server 3117 也在 panic（`.next/dev/logs` 里是 `⨯ Error: Panic in async function`，发生在 `/login` 编译期，与本次改动无关）。**因此 375px 下的方向键横滚是按 HTML 规范推断的，未经真实按键验证。** 复现页留在 `%TMPDIR%/d19-check.html`，需要时请在能起 Chrome 的环境里打开。

### [D-20] P2 · 登录页把「注册成功」渲染成错误色

**根因**：`login/page.tsx:34` 的 `setError("注册成功，请到邮箱确认后再登录")` 让成功消息走 error 路径 → 余烬红 + `role="alert"`（assertive）。视觉与语义双重错误：ember 在本项目只表示支出与危险（DESIGN.md §二）。

**做法**：

1. 拆出独立的 `notice` state（`login/page.tsx`），渲染为 `role="status"` + `text-jade`（polite）；
2. `error` 保留 `role="alert"` + `text-ember`，删掉冗余的 `aria-live="assertive"`（`role="alert"` 已隐含 assertive）；
3. 提交失败后把焦点移到错误文本：`errorRef` + `useEffect(() => { if (error) errorRef.current?.focus() }, [error])`，`<p tabIndex={-1}>` 可编程聚焦但不进 Tab 序列，焦点环仍是灯色；
4. 切模式与新一次提交都清 `notice`（`setNotice(null)`），避免上一条成功提示挂在别的错误旁边。

**验收对照**：关闭邮箱确认时登录页出现玉绿「注册成功…」且 `role="status"` ✅；登录失败仍为余烬 + `role="alert"` 且焦点移到错误文本 ✅。

### [D-24] P2 · 2000 行导入时 rowsJson 全量重算并塞进 hidden input

**根因**：`rowsJson = JSON.stringify(rows.map(...))` 挂在 `useMemo([rows])` 上，但 `rows` 在**每次改任一行分类**时都是新数组 → memo 每次失效 → 2000 行重新序列化（约 500KB–1MB）并写进 `<input type="hidden" value={rowsJson}>`。每次 change 都在主线程上跑一遍。

**做法**（派工允许的「或等价方案」，此处为 ref + 提交时注入）：

1. **删掉 `rowsJson` 与 hidden input**。rows 的最新数组只留一份在 ref 里；
2. `handleSubmit` 在提交那一刻 `new FormData(form)` + `formData.set("rows", JSON.stringify(rowsRef.current.map(toPayloadRow)))`，序列化**只发生一次**；
3. 表单从 `action={formAction}` 改为 `onSubmit={handleSubmit}` + `startSubmitTransition(() => submitImport(formData))`。`pending = actionPending || isSubmitting` 合并两个阶段，按钮在两段都显示「导入中…」，无重复点击空窗；
4. 预览切片收进 `useMemo(() => rows.slice(0, PREVIEW_ROWS), [rows])`，且 `MAX_ROWS` / `PREVIEW_ROWS` 提成常量；
5. 每个 `<tr>` 加 `contentVisibility: "auto"` + `containIntrinsicSize: "auto 37px"`（**必须成对**，否则滚动条长度随渲染进度抖）。

**代价与取舍（请复核）**：
- `rowsRef` 的同步放在 `useEffect` 里而非 render 期赋值 —— `npx eslint` 的 `react-hooks/refs` 规则报 `Cannot update ref during render`（真实报错，见下）。effect 在 commit 后跑，用户点提交时必然已是最新值，语义无差。
- `handleSubmit` 用 `e.preventDefault()` + 手动 dispatch，取代了 `<form action>`。`submitImportAction` 的签名 `(prev, formData)` 由 `useActionState` 提供，行为与原先一致；`form="import-form"` 的跨 Portal 提交（DESIGN.md 变更记录 2026-09-14 那条）仍走同一条 `onSubmit`，未受影响。

**验收对照**：`grep -rn "rowsJson\|name=\"rows\"" src/app/settings` → 仅注释 ✅；hidden input 不再承载 >10KB 字符串 ✅（已完全移除）。**主线程长任务 <50ms 未实测**（同 D-19 的浏览器限制）。

### [D-34] P3 · Intl.DateTimeFormat 反复构造

| 文件 | 改法 |
|---|---|
| `settings-client.tsx:326-330` | 组件体内的 `new Intl.DateTimeFormat(...)` → 模块级 `const SHANGHAI_MONTH` + `currentShanghaiMonth()` |
| `api/settings/route.ts:11` | handler 内的 `new Intl.DateTimeFormat(...)` → 同上，提到模块作用域 |

`grep -rn "new Intl" src/app/api` → 0 ✅
`grep -rn "new Intl" src/app/settings` → 0 ✅

### [D-41] P3 · delete-category-button 触控目标 32px

`sx.minHeight/minWidth: 32` → `44`，与 `toggle-account-button` / `delete-account-button` / `delete-budget-button` 对齐。加 `margin: "-6px -14px"` 把多出的 12px 用负边距收回来，**chip 的视觉高度不变**（`×` 按钮在 chip 内，负边距不会溢出 chip 边界）。

`grep -rn "minHeight: 32" src/app` → 0 ✅

### [D-42] P3 · 只读规则列表套用可点的 .chip

`settings-client.tsx` 的归类规则 `<li className="chip">` → 等价的静态标签样式（无 hover / 无 active / 无按压反馈）：

```tsx
className="rounded-full border border-fogline bg-veil px-3 py-1 text-sm text-dim"
```

`.chip` 在本项目语义里 = 「可点的选择器/标签」，其 `:hover` 转纸墨是明确的假 affordance。审计给了两条路：改静态样式 **或** 新增 `.tag` 类。**我选了静态样式**，因为新增类要动 `src/app/globals.css`（WP-1 的文件），不在 WP-5 所有权内 —— 详见 `wp5-design-fragment.md` 的「建议由 WP-1 落地」一节。

`grep -rn 'className="chip"' src/app/settings/settings-client.tsx` → 0 ✅（真正可点的 chip 在 `import-client.tsx` 的来源单选组，未动）

### [D-44]§settings P3 · 「共 N 笔」排版与数据页统一

数据页 `data-client.tsx:132` 用 `.money` + `toLocaleString("zh-CN")`。设置页原先既不是等宽也没做千分位。

- `settings-client.tsx`「最近导入」三处笔数（`row_count` / `success_count` / `duplicate_count`）→ `<span className="money">` + 千分位；
- `import-client.tsx` 的「解析到 N 笔」「单次最多导入 N 笔」「仅预览前 N 笔」「确认导入 N 笔」「共 N 笔」全部同一套。

**边界说明**：`.money` 语义上是「一切金额」（DESIGN.md §八），笔数不是金额。审计的期望是抽一个只带 `tabular-nums` 的 `.num`，但那要动 `globals.css`（WP-1）与 `data-client.tsx`（WP-3），两边都不在我这里。**当前做法是先用 `.money` 与数据页对齐视觉结果**，并把 `.num` 的提案写进 design-fragment 等合并。⚠️ 这意味着 `.money` 目前仍出现在非金额上，是本包留下的已知欠账。

### [D-48] P3 · ensure-default-categories 命名与错误播报

三处：

1. **文件名**：审计说原文件是 PascalCase，实际磁盘上已是 kebab-case `ensure-default-categories-button.tsx`（其余 settings 文件同为 kebab）。**审计该条前提有误**；按派工「文件所有权只能改 settings/**」与「不破坏既有 import」的原则，**未改名**。`grep` 确认 `settings/` 下 20 个文件名全为 kebab-case ✅。
2. **变量遮蔽**：`const result = await ensureDefaultCategories()` 遮蔽了外层同名 state → 改名 `outcome`。
3. **错误播报**：`aria-live="polite"` 的单条 `<p>` 拆为二选一渲染 —— `ok` 时 `role="status"` + jade，失败时 `role="alert"` + ember。原先失败走 polite 不打断当前朗读，用户多半直接错过。`message` 为空时不渲染空节点（原先会渲染一个空的 live region）。

### [D-26]§main id

根 `layout.tsx:81` 的 skip link 指向 `#main`，四页的 `<main>` 需带该 id。WP-5 名下 4 个：

| 文件 | 状态 |
|---|---|
| `settings/settings-client.tsx` | ✅ 加 `id="main"` |
| `settings/loading.tsx` | ✅ 加 `id="main"` |
| `login/page.tsx` | ✅ 加 `id="main"` |
| `login/loading.tsx` | ✅ 加 `id="main"` |

`overview-client.tsx` / `ledger-client.tsx` / `data-client.tsx` 属 WP-2/3/4。

---

## 三、待 WP-4 的 ConfirmSubmitButton 到位后需接线的 3 处

`src/components/confirm-submit-button.tsx` 在我收工时**仍不存在**（`ls` 与 `git status --untracked-files=all` 双向确认）。按派工要求**未 import 它**。

三处逐字复制的「二次确认 + requestSubmit」样板，全部就绪、只差最后一跳：

| # | 文件 | 行 | 样板位置 | 现有实现 |
|---|---|---|---|---|
| 1 | `src/app/settings/adjust-balance-button.tsx` | `formRef` / `armedRef` / `confirmSubmit` / Dialog | `:36-47`（逻辑）、`:66-84`（onSubmit 拦截）、`:134-153`（Dialog） | `armedRef` 旗标 + `formRef.current?.requestSubmit()` + MUI Dialog |
| 2 | `src/app/settings/delete-account-button.tsx` | `<form>` 整块 | `:27-36`（旗标）、`:25-36`（onSubmit）、`:54-80`（Dialog） | 同上 |
| 3 | `src/app/settings/delete-budget-button.tsx` | `<form>` 整块 | `:27-36`（旗标）、`:25-36`（onSubmit）、`:55-81`（Dialog） | 同上 |
| 4 | `src/app/settings/delete-category-button.tsx` | `<form>` 整块 | `:27-36`（旗标）、`:25-36`（onSubmit）、`:55-79`（Dialog） | 同上 |

（上表实为 **4 处**，先前写「3 处」是笔误，以表为准。）

**接线时需要注意的三点**：

1. `delete-category-button` 的触发按钮是 chip 内的 `×`（44×44，带 `margin: "-6px -14px"`），而另三处是行内文字按钮。`ConfirmSubmitButton` 若统一了内部布局/sx，chip 内的这颗会走形 —— 建议组件暴露 `sx` 或 `size` 透传。
2. `adjust-balance-button` 的确认框是**提交前拦截**（`onSubmit` 里 `preventDefault` 弹框，确认后 `requestSubmit()`），与另三处的「点触发按钮直接 `setConfirmOpen(true)`」不是同一形态。收敛时这个差异要保留，否则会退回「填完表单点提交才发现要确认」。
3. 收敛净减行数按审计估算约 120 行（settings 侧 4 处），达不到 [D-16] 验收标准里的「≥200 行」 —— 那个数字要靠 WP-4 侧的 2 处（`delete-transaction-button` / `edit-transaction-button`）才凑得满，两边合并后才成立。

**另**：`import-client.tsx` 的「确认导入」Dialog 是另一种形态（不是 `requestSubmit` 二次确认，而是「点确认导入 → 弹批次摘要 → Dialog 内 `type="submit" form="import-form"` 直接提交」），**不在 [D-16] 的收敛范围**，不建议强行并入。

---

## 四、DESIGN.md §十一 禁忌清单逐条自查（仅 WP-5 名下文件）

`grep` 覆盖 `src/app/settings` + `src/app/login` + `src/app/api/settings/route.ts`：

| # | 禁忌 | 结论 | 依据 |
|---|---|---|---|
| 1 | 新的红/绿/蓝标准色 | ✅ 通过 | `grep -rniE "(red\|green\|blue\|indigo\|amber\|gray\|yellow\|purple)-[0-9]"` = 0 命中。全部语义色走 `ember`/`jade`/`lamp` 令牌 |
| 2 | 大面积灯色 | ✅ 通过 | `grep "bg-lamp"` = 0。灯色只出现在 `chip-active`（契约类）与焦点环 |
| 3 | 常亮灯线 > 1 条 | ✅ 通过 | `grep "lamp-line"` = 1 处，`login/page.tsx:73` 词标下方 —— §四白名单 #3 明确授权 |
| 4 | 渐变按钮/进度条/发光大标题 | ✅ 通过（沿用既有例外） | `grep "gradient"` = 1 处，`import-client.tsx:360` 的表格横向滚动遮罩。**非按钮、非进度条**，是滚动提示；本次未新增渐变。该遮罩是 [D-11 审计 #4] 标记的「未登记例外」，仍需 WP-1 在 §八例外清单补一条 |
| 5 | `dark:` 变体 | ✅ 通过 | `grep "dark:"` = 0 命中 |
| 6 | zinc/neutral/slate 灰阶 | ✅ 通过 | `grep -rniE "zinc\|neutral\|slate"` = 0 命中。边框一律 `fogline`（`import-client` 表格边框、`tag` 静态标签） |
| 7 | 非 mono 字体的金额 | ✅ 通过 | `grep "¥"` = 2 处，**全在注释里**。所有渲染出的金额都带 `.money` 且经 `formatSignedMoney` 产出 |
| 8 | 单次动效 > 500ms | ✅ 通过 | `grep -rniE "duration-\[\|animation.*ms\|transition.*[0-9]{3}ms"` = 0 命中。本次未新增任何动效；`content-visibility` 不是动效 |
| 9 | 焦点环被移除或换成非灯色 | ✅ 通过 | `grep "outline-none"` = 0。新增的两处焦点（导入表格容器 `focus-visible:ring-lamp/60`、登录错误文本 `focus-visible:ring-lamp/60`）都是灯色。删掉的 `role="alert"` 上的 `aria-live="assertive"` 与焦点环无关 |
| 10 | 编号装饰 / emoji / 拟物阴影 | ✅ 通过 | `grep -rnE ">[0-9]{2}<\|「0[1-9]」"` = 0 命中；无 emoji；未新增 box-shadow（`content-visibility` 用 `contain`，不涉及阴影） |

**汇总**：10 条全部通过，无条件违规，也未新增例外。

---

## 五、实测输出

```
$ npx eslint src/app/settings src/app/login src/app/api/settings/route.ts
（无输出，0 error 0 warning）

$ npx tsc --noEmit
（无输出，0 error）
```

> 中途 `npx eslint` 曾报一条真实错误，已修：
> ```
> src/app/settings/import-client.tsx:171:3  error  Error: Cannot access refs during render
>   171 |   rowsRef.current = rows;
>       |   ^^^^^^^^^^^^^^^ Cannot update ref during render  react-hooks/refs
> ```
> 改为在 `useEffect` 内同步 ref 后清零。

---

## 六、未能验证的部分（诚实清单）

| 项 | 原因 |
|---|---|
| 375px 下方向键横向滚动预览表格 | 浏览器工具无法启动（`Chrome exited early (exit code 3)`）。复现页在 `%TMPDIR%/d19-check.html`，机制推断自 HTML 规范（非 JS 实现，`tabIndex=0` 的溢出容器由浏览器原生处理 ←/→） |
| 2000 行导入的主线程长任务 < 50ms | 同上，无法开 Performance 面板 |
| 登录页 jade/ember 实际观感 | 同上，无法截图 |
| dev server 冒烟 | 3117 端口的 dev server 在 `/login` 编译期 panic（`⨯ Error: Panic in async function`），发生在本次改动之外，无法据此判断是我的文件导致 |
