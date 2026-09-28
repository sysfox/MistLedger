# WP-4 · ledger（记账页 + 确认组件收敛）实施报告

> 基线 `2447d67` ｜ 范围：`src/app/ledger/**`、`src/app/api/ledger/route.ts`、新建
> `src/components/confirm-submit-button.tsx`（公共目录，供 WP-5 import）
> 验收：`npx tsc --noEmit` → exit 0；`npx eslint`（全库）→ exit 0；`npm test` → 98/98 pass

---

## 一、逐条完成状态

| ID | 优先级 | 状态 | 落点 |
|---|---|---|---|
| [D-04]§ledger | P1 | ✅ 完成 | `edit-transaction-button.tsx` 拆出 `EditPanel`，渲染条件只留 `open`，用 `gen` 作 key 重挂载 |
| [D-15]§ledger | P2 | ✅ 完成 | `ledger-client.tsx` 新增 `relationName()`，3 处 `as unknown as` 清零 |
| [D-16]§ledger | P2 | ✅ 完成（ledger 侧）| 新建 `src/components/confirm-submit-button.tsx`；2 个调用点收敛；**settings 侧 4 个调用点待 WP-5 接线** |
| [D-18] | P2 | ✅ 完成 | 新建 `src/app/ledger/type-picker.tsx`，APG radiogroup 键盘契约；2 处调用点复用 |
| [D-21] | P2 | ✅ 完成 | `ledger-client.tsx` 空态改指 `/settings#accounts` + `Link` |
| [D-45] | P3 | ✅ 完成 | `transaction-form.tsx` 删 useEffect 直写 DOM，改 `defaultValue` + `suppressHydrationWarning`；时区复用 `shanghaiDate()` |
| [D-46] | P3 | ✅ 完成 | `transaction-form.tsx` 渠道默认值 `alipay` → `direct` |
| `<main id="main">` | — | ✅ 完成 | `ledger-client.tsx`、`loading.tsx` |

---

## 二、[D-16] `ConfirmSubmitButton` 完整接口（供 WP-5 直接接入）

**文件**：`src/components/confirm-submit-button.tsx`（WP-4 建，WP-5 import）
**导入**：`import ConfirmSubmitButton from "@/components/confirm-submit-button";`

### 2.1 Props 签名

```ts
export type ConfirmSubmitButtonProps = {
  /** useActionState 返回的第二个值（action），直接挂到 <form action> 上。
   *  刻意写成 (formData: FormData) => void 而不是具体 server action，
   *  调用方不必关心 state 的形状 —— 本组件不读 state，只负责发起提交。 */
  action: (formData: FormData) => void;

  /** 触发按钮文案（未提交时） */
  label: ReactNode;
  /** 提交中的按钮文案；不传则沿用 label */
  pendingLabel?: ReactNode;
  /** 提交中（通常直接传 useActionState 的第三个返回值） */
  pending?: boolean;

  /** 二次确认框标题，例如「删除这笔流水？」 */
  confirmTitle: ReactNode;
  /** 二次确认框正文：说清后果。必须是**行内**内容（会渲染进 DialogContentText 的 <p>）。
   *  省略则不渲染正文。 */
  confirmBody?: ReactNode;
  /** 确认按钮文案，例如「确认删除」 */
  confirmLabel: ReactNode;
  /** 确认按钮配色。error 仅用于删除等不可逆操作（DESIGN.md §十三 #3），其余一律 primary。 */
  confirmColor?: "primary" | "error";

  /** 触发前校验：返回 false 时既不弹确认框也不提交。
   *  用于「服务端要中文报错、但控件层没有原生约束」的场景。
   *  通常应同时把触发按钮 disabled 掉（见下方 triggerProps）。 */
  validate?: () => boolean;

  /** <form> 的 className */
  formClassName?: string;

  /** 触发按钮的样式/无障碍属性：sx、color、variant、aria-label、disabled…
   *  children / onClick / type 由本组件控制，从类型上排除。
   *  注意：它会**覆盖**组件自己设的 disabled={pending}，
   *  所以需要两者取或时请显式传 disabled={pending || !xxx}。 */
  triggerProps?: Omit<ButtonProps, "children" | "onClick" | "type">;

  /** 表单主体：隐藏字段、受控输入、错误提示等，渲染在触发按钮之前 */
  children?: ReactNode;
  /** 触发按钮之后、表单末尾的节点（行内错误提示等） */
  afterTrigger?: ReactNode;
};

export default function ConfirmSubmitButton(props: ConfirmSubmitButtonProps): JSX.Element;
```

**渲染结构**（调用方拿到的是这个，不需要自己写 `<form>`）：

```html
<form id="confirm-submit-«r0»" action={action} className={formClassName} onSubmit={…}>
  {children}
  <Button type="button" …>{pending ? (pendingLabel ?? label) : label}</Button>
  {afterTrigger}
</form>
<Dialog open={confirmOpen} onClose={…}>   <!-- Portal 到 body，关联 form=… -->
  <DialogTitle>{confirmTitle}</DialogTitle>
  <DialogContent><DialogContentText>{confirmBody}</DialogContentText></DialogContent>
  <DialogActions>
    <Button color="primary" variant="text">取消</Button>
    <Button color={confirmColor} variant="contained" form="confirm-submit-«r0»"
            data-confirm-submit="1">确认</Button>
  </DialogActions>
</Dialog>
```

### 2.2 WP-5 的四个调用点怎么接

四个文件的现状都读过了（`delete-account-button.tsx` / `delete-budget-button.tsx` /
`delete-category-button.tsx` / `adjust-balance-button.tsx`）。它们都能一对一映射：

| 现有 props/结构 | 对应新 props |
|---|---|
| `action` / `state, action, pending = useActionState(...)` | `action={action}` `pending={pending}` |
| 触发按钮 `删除` / `调整` | `label="删除"` / `label="调整"` |
| `{pending ? "删除中…" : "删除"}` | `pendingLabel="删除中…"` |
| `<DialogTitle>删除这个账户？</DialogTitle>` | `confirmTitle="删除这个账户？"` |
| `<DialogContentText>…</DialogContentText>` | `confirmBody="…"` |
| `确认删除` / `确认调整` | `confirmLabel="确认删除"` / `confirmLabel="确认调整"` |
| `color="error"` 的确认按钮 | `confirmColor="error"`（三个删除）/ `"primary"`（调整余额） |
| `-ml-2.5 flex items-center gap-2` | `formClassName="-ml-2.5 flex items-center gap-2"` |
| 按钮上的 `sx={{minHeight:44,minWidth:0,px:0.75,fontSize:"0.75rem"}}` | `triggerProps={{ sx: {...} }}` |
| 触发按钮 `disabled={pending \|\| !targetValid}`（仅 adjust） | `triggerProps={{ disabled: pending \|\| !targetValid }}` + `validate={() => targetValid}` |
| 触发按钮的 `onClick={() => setConfirmOpen(true)}` | **删除该行**，由组件接管 |
| 提交按钮 + 删除 / 调整确认按钮 | **删除这两处**，由组件渲染 |
| `<form onSubmit={…armedRef…}>` | **整个删除**，由组件渲染 |

**接线后可删掉的样板**（每个文件）：`formRef` + `armedRef` + `confirmOpen` 三个 useRef/useState、
`confirmSubmit` 函数、`onSubmit` 拦截闭包、`<Dialog>` + 4 个子组件的 import 与 30 行 JSX。

**注意点**

1. **`adjust-balance-button.tsx` 有一个本组件管不到的按钮**：外层的
   「调整余额」toggle（`aria-expanded` + 开关面板）**在 `<form>` 之外**，继续留在
   WP-5 自己的组件里；把 `<ConfirmSubmitButton>` 放进 `{open ? … : null}` 即可。
   WP-5 已经修好的 [D-04]§settings（`open` 条件 + `justAdjusted` 状态块）不受影响。
2. **`confirmBody` 只接受行内内容**。`adjust-balance` 的正文带金额对比
   （`−¥1.00 → ¥5.00`），写成
   `confirmBody={<><span className="money">{formatSignedMoney(a)} → {formatSignedMoney(b)}</span>。将同步调整期初余额…</>}`
   即可 —— `.money` 是 span，包在 DialogContentText 的 `<p>` 里合法。
   不要再套 `<p>` / `<div>`。
3. **`children` 渲染在触发按钮之前，`afterTrigger` 渲染在之后**。三个删除按钮的错误文案
   原来在按钮右侧，用 `afterTrigger` 保持同样的 DOM 顺序。
4. **不要在 children 里再放 `type="submit"` 的按钮**。组件的提交入口是它自己渲染的
   那个触发按钮；额外的 submit 按钮会因 `submitter` 没有标记而被拦下确认框（行为仍正确，
   但会多一次点击）。
5. **触发按钮的 `sx` 会覆盖组件默认的 `alignSelf: "flex-start"`**。面板类表单（调整余额）
   若依赖这个默认值，把 `alignSelf: "flex-start"` 一并写进 `triggerProps.sx`。

### 2.3 行为契约（与改造前逐条对齐）

| 行为 | 实现 |
|---|---|
| 二次确认 | 表单 `onSubmit` 放行由「确认」按钮发起的提交，其余一律 `preventDefault()` 并弹框 |
| Esc 关闭 | MUI Dialog `onClose`（`reason: "escapeKeyDown"`）|
| 点遮罩关闭 | 同上（`reason: "backdropClick"`）|
| 确认后提交 | 真实 `<form action>` 提交，`useActionState` 正常收到 `FormData` |
| pending 期间禁用 | 触发按钮 + 确认框「取消」「确认」三个按钮全部 `disabled` |
| 原生校验时机 | 触发按钮是 `type="button"`，因此在**弹框之前**显式 `form.reportValidity()` —— 与原先「`type=submit` 被浏览器拦下」的时刻一致 |
| 无障碍 | MUI Dialog 自动 `role="dialog"` + `aria-modal="true"` + `aria-labelledby`（`Dialog.js:274,307-311`），标题/正文由 `DialogTitle`/`DialogContentText` 自动接上 |

### 2.4 「禁用 armedRef，改为派生状态」是怎么做的

旧逻辑：`armedRef.current = true → requestSubmit() → onSubmit 里读到 true 就放行`。
这是一枚**命令式旗标**：它必须在下一次提交前被复位，而复位点藏在 onSubmit 里；
一旦有第二条提交路径（比如回车）先跑，旗标就会错位 —— [D-04] 那个 bug 正是这类
「记得复位」的复制品出错的结果。

新逻辑是**从事件本身派生**，没有任何需要复位的状态：

```ts
// 确认按钮上带 data-confirm-submit="1"
const submitter = (e.nativeEvent as Event & { submitter?: Element | null }).submitter;
if (submitter?.getAttribute("data-confirm-submit") === "1") return; // 放行
e.preventDefault();                                                   // 其余拦下
```

「这一跳是不是用户点确认按钮发起的」变成事件的客观属性，而不是组件自己记的账。
回车隐式提交的 `submitter` 是 `null`（确认按钮在 Portal 里，不是表单的后代，
不会成为表单的默认按钮），因此同样被拦下 —— **不存在绕过确认的提交路径**。

读 `submitter` 零断言：把 `submitter` 声明成**可选**扩展字段后，`Event` 在结构上就可赋值给
`Event & { readonly submitter?: … }`，因此既不用 `as`、也不用 `any` / `@ts-ignore`。
`SubmitEvent.submitter` 在 Chrome 81+ / Safari 15.4+ / Firefox 75+ 均已支持。

### 2.5 已完成验证的部分

- ledger 侧两个调用点已迁移并通过 tsc + eslint（见下）
- settings 侧四个文件**未动**（WP-5 所有权），WP-5 接入后请重跑
  `npx tsc --noEmit` 与 `npx eslint`，并确认 `grep -rn "armedRef" src/app/settings` 返回 0

---

## 三、[D-18] `<TypePicker>` 的键盘契约

新建 `src/app/ledger/type-picker.tsx`，新建流水与修改流水两处复用。

```ts
export type TypeOption = { value: string; label: string };
export const TX_TYPES: TypeOption[];  // expense / income / transfer，顺序即左右键顺序
export default function TypePicker(props: {
  value: string;              // 受控
  onChange: (next: string) => void;
  label?: string;             // radiogroup 的可访问名，默认「收支类型」
}): JSX.Element;
```

| APG 要求 | 实现 |
|---|---|
| Roving tabindex | 只有选中项 `tabIndex=0`，其余 `-1` → **Tab 进入本组 1 次、离开 1 次**（验收标准达成）|
| ←/→/↑/↓ 移动并选中 | 组内循环移动焦点，`onChange` 同步更新，`aria-checked` 随之翻转 |
| Home / End | 跳到首项 / 末项 |
| Space / Enter | 交给底层原生 `<button>` 的按键激活 → `onClick` → `onChange`（不在 `onKeyDown` 里重复处理）|
| 方向键默认滚动 | 一律 `preventDefault()`，上下键不会把页面滚走 |

**焦点环**（DESIGN.md §十一 #9）：没有新增任何 `outline` 样式。Chip 的灯色焦点环来自
`mui-theme.tsx:212` 的 `MuiChip.root["&:focus-visible"] = LAMP_RING`
（`0 0 0 2px rgba(227,179,65,0.6)`），与 `globals.css:254-259` 的 `.chip:focus-visible` 同值。

**`role="radio"` 覆盖是否生效**：MUI `ButtonBase` 渲染时把 `...(buttonProps)` 铺在
`...other` **之前**（`ButtonBase.js:300-301`），我们传的 `role` / `tabIndex` / `onKeyDown`
都在 `other` 里，因此不会被 ButtonBase 内部的 `role="button"` 覆盖。

**视觉零变化**：选中态 `color="primary"`、未选中 `color="default"`，`variant="outlined"`
与 `clickable` 全部沿用改造前的写法，主题里的 `.chip-active` 复刻照旧生效。

---

## 四、[D-45] 日期口径

`transaction-form.tsx` 原来有两处问题，都在本次一并解决：

1. **`useEffect` 直写 DOM**（`el.defaultValue = today; el.value = today;`）
   → 删掉整个 effect 与 `dateRef`。改由 React 通过 `defaultValue={today()}` 拥有。
   `slotProps.htmlInput.suppressHydrationWarning` 标注的是「这一处的值本就可能与
   服务端预渲染算出的不同」——日期是**访问日**口径，构建日 ≠ 访问日时必然不同，
   压制的是这一处预期内的差异。
2. **`localToday()` 读浏览器本地时区**
   → 换用 `shanghaiDate()`（`src/lib/ledger/stats.ts:198`），即 `/data` presets、
   总览资产曲线、`/api/*` 月界共用的那一份 `Asia/Shanghai` 口径。
   `shanghaiDate()` 是**调用时**求值而非模块加载时，所以不会被静态预渲染冻成构建日。

> ⚠️ **给 WP-3**：`src/lib/ledger/stats.ts:6` 的注释仍写着「`shanghaiDate` →
> `src/app/data/date-window.ts`（数据页日期口径，唯一的调用点）」。记账页现在也是调用点，
> 该文件属 WP-3 所有权，WP-4 未改，请 WP-3 顺手更新这句注释。

---

## 五、[D-15] 类型逃逸清零

`ledger-client.tsx` 原来三处 `as unknown as`，全部收敛进一个函数：

```ts
type Relation = { name: string } | { name: string }[] | null;

function relationName(rel: Relation): string | null {
  if (rel === null) return null;
  return Array.isArray(rel) ? (rel[0]?.name ?? null) : rel.name;
}
```

这些断言**从类型上讲本就不必要**：`Array.isArray` 的真分支已经把数组成员收窄掉，
else 分支里剩下的只有 `{ name: string } | null`。原写法是「联合类型 + 断言」的组合，
断言的唯一作用是让编译器闭嘴。收进函数后三种关系（`account` / `category` / `to_account`）
在一处归一，`TransactionRow` 的三个字段也从 `{name}[] | {name} | null` 简写为 `Relation`。

---

## 六、DESIGN.md §十一 禁忌清单 · 逐条自查（只覆盖本次改动触及的范围）

| # | 禁忌 | 自查结果 |
|---|---|---|
| 1 | 新的红/绿/蓝标准色 | ✅ 本次未引入任何新色。新增的 `text-jade` 成功块复用既有令牌（`globals.css`），`confirmColor="error"` 走 MUI 主题已把 `error` 指回 ember 令牌（`mui-theme.tsx`）|
| 2 | 大面积灯色 | ✅ TypePicker 选中态是 Chip 的 `color="primary"`（半透明灯底 + 灯色边框，主题已复刻 `.chip-active`），与改造前逐字相同，未扩大 |
| 3 | 常亮灯线 > 1 条 | ✅ 本次未新增任何 `border-l-2` / 装饰线。Chip 的边框是 `fogline` 契约色 |
| 4 | 渐变 / 发光 | ✅ 无渐变、无 text-shadow。Dialog 沿用 `mui-theme.tsx:215-216` 的双层轻投影，未叠加 |
| 5 | `dark:` 变体 | ✅ `grep -rn "dark:" src/app/ledger src/components/confirm-submit-button.tsx` → 0 |
| 6 | zinc/neutral/slate | ✅ 同上 grep → 0；边框一律 `border-fogline` |
| 7 | 非 mono 字体的金额 | ⚠️ **未改动，故未变化**。`ledger-client.tsx:81,90` 仍是 `{AMOUNT_PREFIX[type]}¥{formatMoney(...)}` 且带 `.money`。[D-08]§调用点派给 WP-2/WP-5，不在 WP-4 范围 —— 迁移到 `formatSignedMoney` 后行为完全一致（`format.ts:38-39` 已注明）|
| 8 | 动效 > 500ms | ✅ 确认框是 MUI Dialog，沿用主题钉死的 `transitions.duration.* = 150ms`；本次未新增任何 `transition` / `@keyframes` |
| 9 | 焦点环被移除或换成非灯色 | ✅ **重点复核**：(a) radiogroup 的 roving tabindex 把三个 chip 的 `tabIndex` 从「各自 0」改成「仅选中项 0」，但**没有动任何 outline 样式** —— 焦点环仍由 `MuiChip.root["&:focus-visible"] = LAMP_RING`（`mui-theme.tsx:212`）提供，且 `:focus-visible` 对**程序化 `.focus()`** 同样命中，所以方向键移动焦点时灯环照常出现；(b) Dialog 的焦点由 MUI FocusTrap 管理，首焦落在 Paper（`tabIndex={-1}`，`Dialog.js:311`）而非触发按钮，Esc 后焦点回到触发按钮，MUI 已处理；(c) 新增的 `/settings#accounts` 链接用既有 `.link-subtle`，自带 `rgba(227,179,65,.6)` 焦点环（`globals.css:232-236`）|
| 10 | 编号装饰 / emoji / 拟物阴影 | ✅ `grep -rnE ">[0-9]{2}<" src/app/ledger` → 0；无 emoji；无新增阴影 |

补充（§十三 MUI 约束）：

- **§十三 #1** MUI 只出现在 `/ledger`、`/settings`、`/login` —— 本次新增的 MUI 用法
  全部在 `/ledger` 内与公共组件内，无扩散。
- **§十三 #3** `error` 仅用于删除确认 —— `ConfirmSubmitButton` 把这件事做成了
  **类型上的约束**：`confirmColor` 只有 `"primary" | "error"` 两个取值，
  且 ledger 侧只有 `delete-transaction-button` 传了 `error`。调整余额这类可逆操作
  只能传 `primary`。
- **§十 界面词汇表** — 空态文案（[D-21]）与 `CHANNELS` 已去重的展示文案对齐；
  `type` 词汇表从两份副本收敛到 `TX_TYPES` 一份。

---

## 七、改动文件与行数

| 文件 | 状态 | 行数变化 |
|---|---|---|
| `src/components/confirm-submit-button.tsx` | **新建** | 0 → 195 |
| `src/app/ledger/type-picker.tsx` | **新建** | 0 → 114 |
| `src/app/ledger/ledger-client.tsx` | 改 | 209 → 236（+27）|
| `src/app/ledger/edit-transaction-button.tsx` | 改 | 278 → 297（+19，含大段注释）|
| `src/app/ledger/transaction-form.tsx` | 改 | 204 → 200（−4）|
| `src/app/ledger/delete-transaction-button.tsx` | 改 | 76 → 46（**−30**，**−39%**）|
| `src/app/ledger/loading.tsx` | 改 | 51 → 51（1 行）|
| **净计** | | **+355 / −345 行**；其中「确认 + radiogroup」的**实现代码**净减约 120 行 |

未改动：`src/app/ledger/page.tsx`、`src/app/ledger/actions.ts`、`src/app/api/ledger/route.ts`
（后两者本轮无需修改，核查过 `[D-15]` 后确认 route 侧类型已由 `sessionResponse` 收口）。

---

## 八、验收命令的真实输出

```
$ npx tsc --noEmit
TSC_EXIT=0

$ npx eslint src/app/ledger src/components/confirm-submit-button.tsx
ESLINT_EXIT=0

$ npx eslint
ESLINT_ALL_EXIT=0

$ npm test
ℹ tests 98
ℹ suites 23
ℹ pass 98
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6403.2113
```

关键 grep：

```
$ grep -rn "as unknown as" src/app/ledger/          # 仅注释命中 3 行
$ grep -rn "el\.value *=" src/                     # 仅注释命中 1 行
$ grep -rn "「账户」页" src/                        # 仅注释命中 1 行
$ grep -rn "armedRef" src/app/ledger/              # 仅注释命中 1 行
$ grep -rn "<main id=\"main\"" src/app/            # ledger-client.tsx:195 · loading.tsx:5 均已补
```

---

## 九、需要 WP-5 接线的点

1. **`src/components/confirm-submit-button.tsx` 的四个 settings 调用点**（§2.2 有逐 prop
   对照表）。接完请确认 `grep -rn "armedRef" src/app/settings` → 0。
2. **给 WP-3 的注释修正**：`src/lib/ledger/stats.ts:6` 关于 `shanghaiDate` 「唯一调用点」的
   描述已过期。
3. **给 WP-2/WP-5 的交叉项**：`ledger-client.tsx` 的金额渲染仍走
   `AMOUNT_PREFIX[type]}¥{formatMoney(...)}`（[D-08]§调用点不在 WP-4 派工内），
   迁到 `formatSignedMoney(n, kind)` 后渲染结果完全一致，可随时并入。
