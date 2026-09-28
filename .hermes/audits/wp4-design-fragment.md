# WP-4 · 设计片段（ledger + 确认组件）

> 本文件是 WP-4 在 DESIGN.md 之外新增/固化的设计决策记录，供后续 Code Review
> 与 WP-5 接线时对照。**未改动 DESIGN.md 本体**（三份文档不在 WP-4 所有权内）。
> 配套实现细节见 `wp4-implementation.md`。

---

## 一、新增组件 1：`<ConfirmSubmitButton>`

**位置**：`src/components/confirm-submit-button.tsx`（公共目录，因为 settings 侧也要用）

### 设计立场

这是一次**收敛**而不是**新增**。审查前有六份逐字复制的「拦截 submit → 弹 Dialog →
`requestSubmit()` → `armedRef` 复位」，约 300 行；[D-04] 那个 P1 bug 就是在这种复制里
被复制了六次的。收敛之后，流程只存在于一处，改一次即改六处。

### 三个不显然的设计点

**1. 派生状态，而非命令式旗标。**

`armedRef` 是「组件自己记的一笔账」：设了必须在下一跳复位，而复位点藏在 `onSubmit` 里。
新实现让「这一跳是不是用户点了确认」变成**事件的客观属性**（`submitter` 上带的
`data-confirm-submit="1"`），组件没有需要维护的中间状态，因此也不可能错位。

副产物：**不存在绕过确认的提交路径**。确认按钮在 Portal 里，不是表单的 DOM 后代，
因此不会是表单的默认按钮 —— 回车隐式提交的 `submitter` 是 `null`，照样被拦下确认。

**2. 触发按钮是 `type="button"`，所以要自己调 `reportValidity()`。**

改造前触发按钮是 `type="submit"`，浏览器会在派发 submit 之前跑一遍约束校验，
不合法就根本不派发 —— 用户看到的是原生气泡。改成 `type="button"`（因为它现在要弹框
而不是提交）之后，这个时机得自己补上，否则会先弹出一个可以确认的框、
确认之后才看到校验错误。组件在 `requestConfirm()` 里先 `reportValidity()` 再开框，
**校验时机与改造前逐字一致**。

**3. 确认按钮用 `form={formId}` 关联表单，而不是 `requestSubmit()`。**

Dialog 经 Portal 渲染到 `body`，不在表单 DOM 后代内。`requestSubmit()` 是一条命令式
旁路（且正是 [D-16] 审计点名的脆性来源），`form` 属性是浏览器原生的关联机制 ——
与 `settings/import-client.tsx` 里已有的做法一致。

### 接口设计原则

**props 只暴露「决策」，不暴露「机制」。** 调用方要回答的只有四类问题：
用哪个 action、按钮上写什么话、什么颜色、触发前要额外校验什么。
`formRef` / `armedRef` / `confirmOpen` / `onSubmit` 拦截 / Dialog 骨架一律不出现。

两个刻意的类型约束：

- `action: (formData: FormData) => void` —— **不**写成具体的 server action。
  组件不读 `useActionState` 的 state，因此调用方的 state 形状与它无关。
- `confirmColor?: "primary" | "error"` —— 落实 DESIGN.md §十三 #3「error 仅用于删除确认」。
  「可逆操作不能选 error」从口头规范变成编译期约束。

`triggerProps` 排除了 `children` / `onClick` / `type`（这三者由组件控制），
其余（`sx` / `variant` / `color` / `aria-label` / `disabled`）自由传入。

### 一处未收敛的边界

`adjust-balance-button` 的**外层** toggle（「调整余额」按钮，`aria-expanded` + 开关面板）
在 `<form>` 之外，组件不覆盖它。这不是遗漏 —— 组件的职责边界是「表单 + 二次确认」，
面板开合是调用方的状态。对应地，组件新增了 `children`（按钮之前）与 `afterTrigger`
（按钮之后）两个插槽，让行内错误文案能保持改造前的 DOM 顺序。

---

## 二、新增组件 2：`<TypePicker>`

**位置**：`src/app/ledger/type-picker.tsx`（ledger 内部，两处调用点）

### 设计立场

旧实现宣告了 `role="radiogroup"` / `role="radio"`，却只实现了 radiogroup 的**语义**
而没有实现它的**键盘契约**：三个 chip 各自 `tabIndex=0`（Tab 要按三次）、
无 `onKeyDown`（方向键全部无响应）。这是「宣告了却欠实现」——读屏用户听到
「单选按钮组，共 3 项」，键盘用户发现组内无法用方向键导航。

**选择实现契约，而不是撤掉语义。** 审计给了两条路（补齐 APG 键盘契约 / 降级为不宣告）。
选前者，因为：

- 收支类型是**单选**，而 radiogroup 正是表达单选的语义。降级成 `tablist` 或
  一组 toggle button 会丢失「三选一」这个信息，读屏播报反而变差。
- APG 的契约本身是**增强**：补齐后键盘用户能少按 2 次 Tab，且方向键直达，
  触屏与鼠标行为完全不变。

### 契约实现

| 键 | 行为 |
|---|---|
| Tab | 进入本组一次（落在选中项）、离开一次 |
| ← / ↑ | 移到上一项并选中（首项 → 末项，循环）|
| → / ↓ | 移到下一项并选中（末项 → 首项，循环）|
| Home / End | 首项 / 末项 |
| Space / Enter | 选中当前项（由底层原生 `<button>` 的按键激活派发 click）|

「移动并选中」而非「移动焦点后还要按 Space」是 APG 对**单选** radiogroup 的规定
（手动选择模式才是后者）。

### 焦点环 —— 审查点 #9 的重点

roving tabindex 把 chip 的 `tabIndex` 从「各自 0」改成「仅选中项 0」，这是审查点 #9
最可能被怀疑的地方。结论是**没有触碰任何 outline 样式**：

- 灯色焦点环由 `mui-theme.tsx:212` 的 `MuiChip.root["&:focus-visible"] = LAMP_RING`
  提供（`0 0 0 2px rgba(227,179,65,0.6)`），与 `globals.css:254-259` 同值。
- `:focus-visible` 对**程序化 `.focus()`** 同样命中，所以方向键移动焦点时灯环照常出现
  —— 这正是 roving tabindex 模式唯一容易漏掉的一环。
- `tabIndex={-1}` 不是 `display:none` / `hidden`，元素仍可被脚本聚焦。

### 视觉零变化

选中态 `color="primary"`、未选中 `color="default"`、`variant="outlined"`、`clickable`
全部沿用改造前写法；主题里复刻 `.chip-active` / `.chip` 的 styleOverrides 照旧生效。
**只有键盘行为变了，鼠标与视觉一字未动。**

---

## 三、`<main id="main">` —— 跳转到主内容的落点

`layout.tsx:81-86` 有全站唯一的 skip link，指向 `#main`。`/ledger` 的
`ledger-client.tsx` 与 `loading.tsx` 此前都没有这个 id，键盘用户点「跳到主内容」
会停在页面顶部。

两处都补上。补 `loading.tsx` 而不是只补客户端组件，是因为骨架屏是**先于**数据到达
被看到的 —— 慢网络下用户面对的正是它。

（全站现状：`/` `overview-client.tsx:380`、`/data` `data-shell.tsx:94` +
`data-client.tsx:330`、`/settings` `settings-client.tsx:366` + `loading.tsx:5`、
`/login` `page.tsx:70` + `loading.tsx:5`、`error.tsx:19` 均有；`/ledger` 本轮补齐。）

---

## 四、[D-21] 空态文案：邀请必须指向存在的门

原文案「先去「账户」页建一个账户」指向一个**已被删除的路由**（`/accounts` 早已并入
`/settings`）。DESIGN.md §十 要求「空状态是邀请」，而一个通向 404 的邀请不是邀请。

改为：「还没有账户，先在 **设置页 · 账户** 建一个（例如：银行卡 / 零钱通）再记账」，
其中「设置页 · 账户」是可点的 `Link` 指向 `/settings#accounts`。

两个细节：

- 链接用既有 `.link-subtle`（`globals.css:216-236`），它自带 `rgba(227,179,65,.6)`
  的灯色焦点环，不新增样式即满足审查点 #9。
- 落点带 `#accounts` 锚点。**已核实该锚点真实存在**：
  `settings-client.tsx:92` 的 `<section id="accounts" … scroll-mt-20>`（`scroll-mt-20`
  让 sticky 导航不遮住标题）。链接可直达。

---

## 五、[D-45] 日期：让 React 拥有 DOM，让全站共享一个时区

原实现是「用副作用写 DOM」：`useEffect` 里 `el.defaultValue = today; el.value = today;`。
这是为绕开 hydration mismatch 而采取的补丁，代价是破坏了 React 的非受控不变量 ——
DOM 改了，React 并不知道，后续重渲染不会把它同步回去。

修复分两步：

1. **DOM 归 React**：`defaultValue={today()}` + `slotProps.htmlInput.suppressHydrationWarning`。
   后者标注的是「这个值本就可能与预渲染算出的不同」——日期是**访问日**口径，
   构建日 ≠ 访问日时必然不同。这是**预期内**的差异，不是被掩盖的 bug。
2. **时区归全站**：`localToday()`（浏览器本地时区）→ `shanghaiDate()`（`Asia/Shanghai`）。

第 2 点才是用户实际能感知的那一半：时区在 UTC 以西的用户，会在 `/ledger` 记下
和 `/data`「近 7 天」窗口**不同的那一天**。日期是账本的主键，跨端不一致等于记错账。
现在两侧读同一个函数（`src/lib/ledger/stats.ts:198`），不存在「各算各的」的可能。

`shanghaiDate()` 是调用时求值而非模块级常量 —— 这一点很重要：模块级 `const TODAY = …`
会被静态预渲染冻成构建日，「今天」永远停在发布那天。它是函数，才是对的。

---

## 六、[D-46] 渠道默认值：默认值即断言

渠道是受控词汇表（DESIGN.md §十），**默认值是一次隐含的主张**。
默认「支付宝」等于系统替用户断言「这笔钱走的是支付宝」——于是银行转账、现金支出
被记成支付宝渠道，统计口径被污染。

改为 `direct`（`constants.ts` 里展示文案是「现金」：现金 / 银行柜台 / 银行转账等
**不经第三方**的直接支付）。理由：

- 与 `actions.ts:25,132` 里 `formData.get("channel") ?? "direct"` 的服务端兜底一致 ——
  前后端对「没选渠道」的默认判断必须是同一个值。
- 「现金 / 线下」是四种渠道里**最中性**的一种，符合「默认值应是最中性的」。

（`CHANNELS` 的展示文案本轮之前已去重：`direct` 标为「现金」、`other` 标为「其他渠道」，
两两不重叠，数据库 value 不变。）

---

## 七、[D-15] 类型逃逸的真正问题不是断言

`as unknown as` 在这里**从类型上讲本来就不必要**：`Array.isArray` 的真分支已经
把数组成员收窄，else 分支里剩下的只有 `{ name: string } | null`。

所以这不是「补一个类型」的问题，而是「**为什么会写出这个断言**」的问题：
原写法把联合类型 `{name}[] | {name} | null` 和一个断言绑在一起，
断言的作用只是让编译器闭嘴。收进 `relationName()` 后：

- 三种嵌入关系（`account` / `category` / `to_account`）在一处判别，不再各复述一遍；
- `TransactionRow` 的三个字段从 `{name}[] | {name} | null` 简写为一个具名类型 `Relation`；
- 断言归零，且**没有引入 `any` 或 `@ts-ignore` 来换取编译通过**。

---

## 八、跨页一致性清单（接线时对照）

| 关注点 | 本轮结论 |
|---|---|
| 收支类型词汇表 | 收敛到 `type-picker.tsx` 的 `TX_TYPES` 一份（原来 transaction-form 与 edit 各一份）|
| 二次确认交互 | 收敛到 `ConfirmSubmitButton` 一份（原来六份）|
| 删除确认配色 | 由 `confirmColor="error"` 在类型层约束，不可逆才可用 |
| 日期口径 | 全站统一 `shanghaiDate()`（Asia/Shanghai，访问日）|
| 渠道默认值 | 新建与修改两侧、服务端兜底三处统一为 `direct` |
| skip link 落点 | `/ledger` 两个 `<main>` 均补 `id="main"` |
