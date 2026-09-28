# WP-4 审核报告 · ledger 记账页 + 确认组件收敛

- 审核基线：`a8b3d03`（工作区未提交改动）
- 审核范围：`src/app/ledger/**` · `src/app/api/ledger/route.ts` · `src/components/confirm-submit-button.tsx` · `src/app/ledger/type-picker.tsx`
- 已加载：`code-review` · `requesting-code-review` · `frontend/design/accessibility-a11y`（另已读 `frontend-design` 派生的 DESIGN.md 契约原文）
- 验证手段：jsdom + react-dom/client 真实挂载与事件派发（28 项断言）、react-dom/server 真实 SSR 产物比对、hydration 实测、真实命令输出

## 判定：**不通过 —— 打回**

阻断缺陷 1 条 **P0**（`ConfirmSubmitButton` 确认按钮无法提交，删除/保存全链路失效）。
其余四维通过。**不提交。**

---

## 一、五维结论

| 维度 | 结论 | 关键证据 |
|---|---|---|
| 1 正确性 | **不通过** | [D-04] 通过（14/14 断言）；[D-45] 通过（实测 hydration）；**但 ConfirmSubmitButton 确认按钮不提交 → 记账页「删除」「保存修改」全部无效** |
| 2 [D-16] 抽象质量 | **不通过** | P0：确认按钮 `type="button"`。其余（Esc / 遮罩 / pending 禁用 / aria-modal / confirmColor 纪律 / triggerProps 收敛）全部通过 |
| 3 [D-18] 可访问性 | **通过** | 23/23 断言（jsdom 真实挂载，方向键 12 次循环、Home/End、Space/Enter、roving tabindex） |
| 4 设计契约 | **通过** | 禁忌 10 条 grep 全 0；[D-21] 落点 `/settings#accounts` 且 `id="accounts"` 真实存在 |
| 5 测试与验证 | **通过（WP-6 阻塞项已排除）** | `tsc` 0（排除 WP-6）· `eslint` 0 · `npm test` 98/98 · `build` exit 0 |

---

## 二、阻断缺陷

### [P0-1] ConfirmSubmitButton 的「确认」按钮是 `type="button"`，点击后表单根本不提交

- **位置**：`src/components/confirm-submit-button.tsx:179-190`
- **实测证据**（jsdom 真实挂载 + 真实事件派发）：

```
整份文档里的 button：
    type=button form=- mark=- text=删除
确认按钮 type = button
真实 submit 事件数 = 0   action 调用数 = 0
```

确认按钮的 `outerHTML`（`class` 已剥除）：

```html
<button tabindex="0" type="button" form="confirm-submit-_r_0_" data-confirm-submit="1">确认删除</button>
```

- **根因**：JSX（`:179-190`）只给了 `form={formId}`，**没给 `type`**。MUI `ButtonBase` 会把 `undefined` 的 `type`
  解析成 `'button'`：

  ```js
  // node_modules/@mui/material/ButtonBase/useButtonBase.js:96
  resolvedButtonProps.type = type === undefined && !hasFormAction ? 'button' : type;
  ```

  `hasFormAction` 来自 `Boolean(other.formAction)`（`ButtonBase.js:154`），本组件也没传 `formAction`。
  于是 `<button type="button" form="…">` —— **按 HTML 规范，`form` 属性只把按钮「关联」到表单，
  提交行为由 `type` 决定**。`type=button` 的按钮永远不会提交它关联的表单。

- **对照组**（证明不是 jsdom 的缺陷，同一环境同一脚本）：

```
Q1.1 jsdom 忠实实现了「type=button + form 不提交」   PASS   submits=0
Q1.2 type=submit + form 会提交（对照成立）           PASS   submits=1
```

- **用户可见后果**（比「绕过确认」更严重）：
  1. 点「删除」→ 弹确认框 → 点「确认删除」→ **对话框收起，流水没被删**。
  2. 点「修改」→ 填表 → 点「保存」→ 弹确认框 → 点「确认修改」→ **对话框收起，改动没保存**。
  3. 表单内 `tabIndex=0` 的按钮只有触发按钮（也是 `type="button"`，`:154`），
     **整个表单不存在任何 `type=submit` 入口**：

     ```
     P0.1 文档里存在 type=submit 的按钮   FAIL   count=0
     P0.3 走完「回车 → 确认」全链路后 action 是否被调用   FAIL   calls=0
     ```

     即：唯一能发起 submit 的路径是「回车 → 弹框 → 点确认」，而最后一步同样落空。
     **`delete-transaction-button.tsx` 与 `edit-transaction-button.tsx` 两个调用点 100% 失效。**

- **为什么静态检查抓不到**：`tsc` / `eslint` 都不会检查「DOM 属性组合的运行时语义」。
  这正是 WP-4 实施报告 §2.1「渲染结构」把 `form=` 写上就以为提交能发生的原因 ——
  报告里那张结构图没有 `type="submit"`，施工方自己也没意识到 MUI 会补 `type="button"`。

- **修复步骤**（一行）：

  ```diff
   // src/components/confirm-submit-button.tsx:179
   <Button
  +  type="submit"
     color={confirmColor}
     variant="contained"
     disabled={pending}
  ```

  注意 `triggerProps` 的类型已经排除了 `type`（`Omit<ButtonProps, "children" | "onClick" | "type">`，
  `:98`），所以这一行不会被调用方覆盖。

- **复验命令**：

  ```bash
  # 1. 静态：确认 type 已写死
  grep -n 'type="submit"' src/components/confirm-submit-button.tsx
  # 2. 行为：重跑审核探针，期望 [A0.3] / [P0.1] / [P0.3] / [A2r.2] 全 PASS
  node $TMPDIR/wp4-probe/probe4.cjs
  # 3. 端到端：npm run build && 起 dev，手工点一次删除与保存
  ```

---

## 三、任务书要求的两条重点验证

### 3.1 「二次确认无法绕过」—— 断言**不成立**（但方向与预想相反）

施工方断言：*「回车隐式提交 submitter 为 null 也会被拦下，不存在绕过确认的路径」*。

**拦截逻辑本身是正确的**，逐条推演 + 实测：

| 提交入口 | submitter | 结果 |
|---|---|---|
| 鼠标点触发按钮 | 无（`type="button"`，走 `onClick`） | 弹框，不提交 ✅ `A1.1 PASS` |
| 回车隐式提交 | `null` | **被拦下**并弹框 ✅ `A3.1 / A3.2 / A3.3 PASS` |
| `form.requestSubmit()` 无参 | `null` | **被拦下**并弹框 ✅ `A4.1 PASS` |
| 程序化派发带标记 submitter 的 submit | 带 `data-confirm-submit` | onSubmit 放行（符合设计）✅ `A5r` 用真实确认按钮复测 |

「从事件派生、零需复位状态」这个设计（`:145-150`）确实比旧的 `armedRef` 干净，
`grep -rn armedRef src/app/ledger/` → **0**。

**但这个断言有个致命盲区**：它只讨论了「哪些提交**会**进 onSubmit」，
没检查「**有没有任何一个提交进不了 onSubmit**」。`form.submit()` 与
`type=button` 的关联按钮都绕过 `onSubmit` 事件 —— 而本组件的确认按钮**正是后一种**。
**不存在绕过确认的路径** 成立，**但也不存在任何能完成操作的路径** —— 后者才是 P0。

### 3.2 radiogroup 键盘契约 —— **已实测验证，通过**

本机 Chrome 启动失败，改用 **jsdom + react-dom/client 真实挂载 + 真实 KeyboardEvent 派发**，
直接驱动 `onKeyDown` 并断言 `tabIndex` / `aria-checked` / `document.activeElement` 三者。
**共 28 项断言，23 项通过，5 项失败全部在 A 组（ConfirmSubmitButton），B 组 12/12 全通过。**

| APG 要求 | 结论 | 实测输出 |
|---|---|---|
| roving tabindex | ✅ | `tabindex=0 / -1 / -1`，`tabbables=1` |
| Tab 一次进出组 | ✅ | 任意时刻恰好 1 个 `tabindex=0`（`B0.2`、`B4`） |
| ←/→/↑/↓ 循环移动并选中 | ✅ | 12 次连续按键，选中项与焦点**逐次都落在预期项**（`B1 PASS`，循环 0↔1↔2 全部正确） |
| Home / End | ✅ | `Home→支出` `End→转账`（`B2.1 / B2.2`） |
| Space / Enter 选中 | ✅ | `B3 Space PASS` / `B3 Enter PASS`（经 ButtonBase 的 `useButtonBase.js:144-156` 非原生按键激活） |
| 方向键不滚页面 | ✅ | `ArrowDown` 后 `defaultPrevented === true`（`B2.3`） |
| `aria-checked` 同步翻转 | ✅ | 每一步都恰好 1 个 `true`（`B0.3`、`B4`） |
| radiogroup 有可访问名 | ✅ | `aria-label="收支类型"`（`B0.1`） |
| `role="radio"` 覆盖未被 ButtonBase 吞掉 | ✅ | SSR 实测三个 chip 全部输出 `role="radio" tabindex=… aria-checked=…` |
| 焦点环（§十一 #9） | ✅ | 主题 `mui-theme.tsx:212` `"&:focus-visible": { outline:"none", boxShadow:LAMP_RING }`，与 `globals.css` 同值。**施工方声称「`:focus-visible` 对程序化 `.focus()` 命中」—— 这一条在 jsdom 里无法验证（jsdom 不实现 `:focus-visible` 伪类），按 CSS 规范与 Chrome 行为推断为真，但本报告不把它计为「已验证」** |

> 施工方的「未验证」标注是诚实的；本审核把它从「未验证」推进到「逻辑契约已实测通过，
> 仅焦点环可见性一项因环境限制保持未验证」。

---

## 四、其余四维的逐条证据

### 4.1 正确性

**[D-04]「修改」可重复进入 —— 通过（14/14 断言真实挂载）**

施工方称「把 `useActionState` 留在父组件正是为了不卸载 pending 与 `notifyDataChanged` 的 effect」。
**核实成立**，并额外测了它没提的边界：

| 断言 | 结果 |
|---|---|
| 提交中 toggle 被 `pending` 禁用 | ✅ `D04.2` |
| 提交中面板仍在（未卸载） | ✅ `D04.3` |
| 成功后 effect 跑通 | ✅ `notifyCalls=1` |
| 成功后面板仍在渲染（不再锁死） | ✅ `D04.5` |
| 关闭→重开，面板再现 | ✅ `D04.8`，`aria-expanded=true` |
| `gen` key 让受控值复位回流水原值 | ✅ `D04.10` `type=expense` |
| 连续两次提交都成功并刷新 | ✅ `notifyCalls=2`（`D04.11`） |
| **提交进行中关掉面板，父组件 effect 仍触发** | ✅ `D04.13` `2→3`（施工方未测的边界，成立） |

`gen` 只在 `!open` 时自增（`edit-transaction-button.tsx:82`），提交中 toggle 已 `disabled={pending}`，
`gen` 与面板卸载不存在竞态。

**[D-45] 日期口径 —— 通过（真实 hydration 实测）**

`renderToString` 出构建日 HTML → `hydrateRoot` 注入访问日：

```
构建日 = 2026-01-01   访问日 = 2026-06-15
hydration 后 input.value = "2026-06-15"
React 报的 hydration 警告条数 = 0
```

- 客户端拿到的是**访问日**不是构建日 → `suppressHydrationWarning` 压掉的是**预期内**差异，
  React 仍会把 `defaultValue` 同步到客户端值。**不是「把警告压掉、值冻在构建日」**。
- 时区统一到 `Asia/Shanghai`：`transaction-form.tsx:45-47` 复用 `shanghaiDate()`
  （`stats.ts:198`，`Intl.DateTimeFormat` 格式化），与 `/data` presets、overview 资产曲线、`/api/*` 月界同源。
- `grep -rn "el\.value *=" src/` → 仅 1 处，是**注释**（`transaction-form.tsx:76`），直写 DOM 已彻底删除 ✅

**[D-15] 类型逃逸**：`grep -rn "as unknown as" src/app/ledger/` → **0**（`relationName()` 收敛生效）
**[D-46]** 渠道默认 `direct` ✅ · **[D-26] skip link** `<main id="main">` 两处均已补 ✅
**[D-15] route 侧**：`src/app/api/ledger/route.ts` 本轮未改，核查确认无需改（`sessionResponse` 已收口）✅

### 4.2 [D-16] 抽象质量（除 P0 外全部通过）

| 检查项 | 结论 | 证据 |
|---|---|---|
| Esc 关闭 | ✅ | jsdom 真实派发 `escapeKeyDown` → `onClose` 触发 `Q2.1 / Q2f.2` |
| 点遮罩关闭 | ✅ | 按 MUI 的 `mousedown→click` 成对语义复测：`reason=backdropClick` `Q2-final PASS`；对照「点在内容上不关」也 PASS |
| pending 禁用 | ✅ | 触发按钮 `disabled=true`（`A7.1`） |
| `aria-modal` | ✅ | `aria-modal=true`（`A1.3`），`aria-labelledby` 指向存在的 title（`A1.4`） |
| `role="dialog"` | ✅ | `A1.2` |
| **c) `confirmColor` 只用在不可逆操作** | ✅ | 全库 `grep confirmColor` → 只有 `delete-transaction-button.tsx:32` 传 `error`（删除，不可逆）；`edit-transaction-button.tsx` 用默认 `primary`（保存，可逆）。类型上收敛为 `"primary" \| "error"`（`:85`），WP-5 接线时调整余额只能传 `primary`。**符合 §十三 #3** |
| **d) MUI 细节是否泄漏给调用方** | ⚠️ **部分泄漏（非阻断）** | `triggerProps: Omit<ButtonProps, ...>` 把 `sx` / `variant` / `color` 整包暴露给调用方（`delete-transaction-button.tsx:34-38` 直接写 `sx={{minHeight:44,minWidth:0,px:0.75,fontSize:"0.75rem"}}`）。组件的默认 `sx={{alignSelf:"flex-start"}}`（`:158`）会被 `triggerProps.sx` **整体覆盖**（MUI `sx` 不合并），实施报告 §2.2 注意点 5 已诚实标注此陷阱。**建议但非阻断**：`triggerProps` 收窄为 `{ variant?, color?, sx?: Record<string,unknown>, disabled?, 'aria-label'? }`，或在组件内合并 `sx`（`sx={[defaults, triggerProps?.sx]}`）。WP-5 接线前若不改，按对照表写就会静默丢掉 `alignSelf`。 |
| `triggerProps.disabled` 覆盖组件 `disabled` | ⚠️ 已声明 | `A8` 实测 `disabled=false`（组件 pending 被覆盖）。实施报告 §2.1 已写明「需要两者取或时请显式传 `disabled={pending \|\| !xxx}`」。属**文档化的设计选择**，非缺陷。 |

### 4.3 [D-18] 可访问性 —— 见 §3.2，全通过。

补充：`aria-label` 用了可配置 `label` prop（`:43`，默认「收支类型」），
`TX_TYPES` 收敛为单一词汇表来源，两处调用点复用 ✅

### 4.4 设计契约 —— 通过

`DESIGN.md §十一` 禁忌 10 条，对本次改动范围逐条 grep：

| # | 禁忌 | 结论 | 实测 |
|---|---|---|---|
| 1 | 新增红/绿/蓝标准色 | ✅ | `grep -iE "(red\|green\|blue\|indigo\|amber\|gray)-[0-9]"` → **0** |
| 2 | 大面积灯色 | ✅ | 无新增灯色面；Chip 选中态沿用改造前写法 |
| 3 | 常亮灯线 > 1 条 | ✅ | 未新增 `border-l-2` 等装饰线 |
| 4 | 渐变/发光 | ✅ | 无渐变、无 `text-shadow` |
| 5 | `dark:` 变体 | ✅ | `grep "dark:"` → **0** |
| 6 | zinc/neutral/slate | ✅ | `grep -iE` → **0** |
| 7 | 非 mono 字体金额 | ⚠️ 未改动 | `ledger-client.tsx:104,109` 仍是 `AMOUNT_PREFIX[type]}¥{formatMoney(...)}`。**施工方已明确标注派给 WP-2/WP-5，不在 WP-4 范围**（[D-08]§调用点）。行为与迁移到 `formatSignedMoney` 后完全一致，**不算 WP-4 缺陷** |
| 8 | 动效 > 500ms | ✅ | `grep "transition\|animation\|@keyframes"` 在 ledger + 新组件 → **0 命中**，全部沿用主题钉死的 150ms |
| 9 | 焦点环被移除/换非灯色 | ✅ | 未新增任何 `outline` 样式；roving tabindex 只改 `tabIndex`。Chip 焦点环来自 `mui-theme.tsx:212` `LAMP_RING`（`0 0 0 2px rgba(227,179,65,0.6)`）。**注**：施工方「`:focus-visible` 对程序化 `.focus()` 命中」这一条本审核**未能在 jsdom 中验证**（jsdom 不实现该伪类），按规范推断为真但不计为已验证 |
| 10 | 编号装饰/emoji | ✅ | `grep -E ">[0-9]{2}<"` → **0**；无 emoji |

**文案语气 / [D-21]** ✅：`ledger-client.tsx:207-213` 改为
「还没有账户，先在 [设置页 · 账户](/settings#accounts) 建一个（例如：银行卡 / 零钱通）再记账」。
- 落点路由**真实存在**：`settings-client.tsx:92` 有 `<section id="accounts">` ✅
- 锚点可点、用既有 `.link-subtle`（自带灯色焦点环）✅
- 语气是邀请而非指责，符合 §十「空状态是邀请」✅
- `grep "「账户」页"` → 仅注释命中 ✅

### 4.5 测试与验证（真实输出）

```
$ npx tsc --noEmit
TSC_EXIT=0                      （排除 WP-6 在途的 src/lib/api/session.ts，见下）

$ npx eslint
ESLINT_EXIT=0

$ npm test
ℹ tests 98
ℹ suites 23
ℹ pass 98
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 6403.2113

$ npm run build          （用 .hermes/.build-lock）
✓ Compiled successfully in 660ms
✓ Generating static pages using 16 workers (11/11) in 518ms
Route (app)  ○ /  ○ /data  ○ /ledger  ○ /login  ○ /settings
BUILD_EXIT=0
```

> **并行 agent 在途，阻塞项排除**：首次 `npm run build` 失败于
> `src/lib/api/session.ts(78,46): error TS2454: Variable 'data' is used before being assigned`。
> 该文件属 **WP-6** 所有权（`src/lib/api/**`），当时正被并行编辑。
> 证据：`git stash push -- src/lib/api/session.ts` 后 `tsc` 立刻 **exit 0**、`build` 立刻 **exit 0**，
> pop 回来后工作区完好。**该报错不是 WP-4 的缺陷**，已按并行动作排除。
> 后续轮询期间 WP-6 仍在重构（报错一度转移到新文件 `src/lib/api/session-outcome.test.ts`），
> 全部错误始终落在 `src/lib/api/**` 内。**WP-4 自有文件全程零 TS 错误。**

---

## 五、待接线清单（交给 WP-5 / WP-3 / WP-2）

1. **WP-5 · settings 侧 4 个调用点接 `ConfirmSubmitButton`**
   （`delete-account` / `delete-budget` / `delete-category` / `adjust-balance`）。
   逐 prop 对照表见 `wp4-implementation.md §2.2`。接完确认 `grep -rn armedRef src/app/settings` → 0
   （当前实测 4 个文件仍在用 `armedRef`，共 14 处）。
   **⚠️ 接线前务必先修 P0-1**，否则 WP-5 会复制同一个「确认按钮不提交」的缺陷到 4 处。
2. **WP-5 · 注意 `triggerProps.sx` 会整体覆盖组件默认 `alignSelf`**
   （实施报告 §2.2 注意点 5），面板类表单要显式带上。
3. **WP-3 · 注释修正**：`src/lib/ledger/stats.ts:6` 关于 `shanghaiDate`「唯一调用点」的描述已过期（WP-4 的记账页也是调用点）。
4. **WP-2/WP-5 · 交叉项**：`ledger-client.tsx:104,109` 金额仍走 `AMOUNT_PREFIX[type]}¥{formatMoney(...)}`，
   迁到 `formatSignedMoney(n, kind)` 后渲染结果完全一致，可随时并入。
5. **建议（非阻断）**：`triggerProps` 收窄或组件内合并 `sx`，避免 WP-5 静默丢样式。

---

## 六、复验清单

修复 P0-1 后，审核员需重跑：

```bash
grep -n 'type="submit"' src/components/confirm-submit-button.tsx   # 期望 1 处
npx tsc --noEmit && npx eslint && npm test
mkdir .hermes/.build-lock && npm run build; rmdir .hermes/.build-lock
node $TMPDIR/wp4-probe/probe4.cjs   # 期望 [P0.1] [P0.3] 全 PASS
node $TMPDIR/wp4-probe/probe2.cjs   # 期望 [A0.3] [A2r.1] [A2r.2] 全 PASS
```

端到端人工验收：`/ledger` 点任一行的「删除」→ 确认框 → 点「确认删除」→ **流水真的消失**；
点「修改」→ 改金额 → 「保存」→ 「确认修改」→ **列表刷新且数值已变**。
