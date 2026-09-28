# WP-5 · 设计片段（待合并进 DESIGN.md）

> 本包**不修改** `DESIGN.md` / `STRUCTURE.md` / `AGENTS.md`（不在文件所有权内）。以下片段在合并顺序到位后由 WP-1（或 DESIGN.md 的维护者）并入对应章节。
> 涉及的两个文件都在其他包名下：`src/app/globals.css`（WP-1）与 `src/app/data/data-client.tsx`（WP-3）。

---

## 一、§八 组件契约 · 新增 `.tag`（静态标签）

**背景**（[D-42]）：`.chip` 在本项目语义里 =「可点的选择器/标签」，其 `:hover` 转纸墨是明确的假 affordance。设置页的「归类规则（关键词 → 分类）」是**只读展示**，却套了 `.chip`。

**本包的临时落地**（不碰 `globals.css`，直接用等价工具类）：

```tsx
// settings-client.tsx · 归类规则
<li className="rounded-full border border-fogline bg-veil px-3 py-1 text-sm text-dim">
  {r.keyword} → {cat}
</li>
```

**建议 WP-1 落地的正式契约**：在 `@layer components` 里与 `.chip` 并列新增

```css
/* 只读标签：外形与 .chip 一致，但没有任何 hover / active / 焦点反馈 ——
   它不是一个控件。DESIGN.md §七.3「反馈只给真正可点的元素」。 */
.tag {
  border: 1px solid var(--color-fogline-strong);
  background-color: var(--color-veil);
  color: var(--color-dim);
  border-radius: 9999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
}
```

**§八 表格补一行**：

| 类名 | 定义 | 用途 |
|---|---|---|
| `.tag` | `.chip` 的静态版，**无** `:hover` / `:active` / `:focus-visible` | 只读标签（关键词→分类规则、纯展示的元信息） |

**同时建议在 §八「已批准的例外」补一条**（[D-11 审计禁忌 #4] 标记至今未登记的例外）：

> 设置页导入区块的表格横向滚动遮罩 `bg-gradient-to-l from-night to-transparent`：它是「右侧还有内容、可横滑」的提示层，不是渐变按钮也不是渐变进度条，`aria-hidden` 装饰性，`md` 以上不渲染。

---

## 二、§八 组件契约 · 新增 `.num`（计数）

**背景**（[D-44]）：DESIGN.md §八 定义 `.money` 为「一切金额」，但数据页 `data-client.tsx:132` 把**笔数**也套了 `.money`，设置页原先则既不是等宽也没做千分位 —— 同一产品里「128 笔」有两种排版。

**本包的临时落地**：先用 `.money` + `toLocaleString("zh-CN")` 与数据页对齐视觉结果。⚠️ 代价是 `.money` 仍出现在非金额上。

**建议的正式修法**（需 WP-1 加类 + WP-3 换类）：

```css
/* 计数：只要 tabular-nums，不要 mono —— 笔数不是金额，
   等宽会让「共 1,280 笔」读起来像一笔账。 */
.num {
  font-variant-numeric: tabular-nums;
}
```

| 类名 | 定义 | 用途 |
|---|---|---|
| `.num` | `tabular-nums`（无 `font-family`） | 一切计数（笔数、条数、个数） |

**待换的调用点**（3 个文件 / 8 处）：

| 文件 | 位置 |
|---|---|
| `src/app/data/data-client.tsx` | `:132`（`共 N 笔`）、`:224`（`只显示前 N 笔（共 N 笔）`）— **WP-3** |
| `src/app/settings/settings-client.tsx` | 「最近导入」三处笔数 — **WP-5（已完成，等换类）** |
| `src/app/settings/import-client.tsx` | 「解析到 N 笔」「单次最多导入 N 笔」「仅预览前 N 笔」「确认导入 N 笔」「共 N 笔」 — **WP-5（已完成，等换类）** |

换完后 `.money` 的 grep 结果应只剩真正的金额。

---

## 三、§三 金额书写铁律 · 调用点写法

**背景**（[D-08]）：铁律要求「负号（U+2212）前置、`¥` 紧跟其后」，但调用点一律手写 `¥{formatMoney(v)}`，负号被夹在 `¥` 之后且是 ASCII hyphen。WP-1 已把符号逻辑下沉到 `src/lib/ledger/format.ts`（`formatSignedMoney`）。

**建议在 §三 补一句调用约定**：

> 金额渲染一律经 `formatSignedMoney(n, kind)`（`src/lib/ledger/format.ts`），**调用点不手写 `¥`**：
> - 余额 / 总资产 / 上限等中性数字 → `formatSignedMoney(n)`（默认 `neutral`，正数不带 `+`）
> - 收支流水行 → `formatSignedMoney(n, "expense" | "income" | "transfer")`
> - hero 需要把 `¥` 单独染成灯色时 → `amountSign(n, kind)` + `YUAN` + `formatMoney(Math.abs(n))`

**本包已迁移的调用点**（WP-5 名下 7 处，见实施报告 §二）：`settings-client.tsx` ×4 · `adjust-balance-button.tsx` ×5 · `import-client.tsx` ×1。
**未迁移**：`src/app/overview-client.tsx`（WP-2）、`src/app/data/data-client.tsx`（WP-3）、`src/app/ledger/**`（WP-4）。

---

## 四、§七.3 微交互 · 「只读行的类选择纪律」

**背景**（[D-07] + [D-42]）：两处同源问题 —— 不可点的元素给了 hover 或可点的类。本包在两处都改成了静态样式。

**建议把这条从「不要做」升级为「怎么做」**（§七.3 现有措辞只说了「行本身不可点则不加 hover」，没说替代方案）：

> 行/标签的视觉分层按「是否可交互」二选一：
> - **可交互** → `.chip` / `.btn-*` / `.link-subtle`，给 hover + active + 焦点环；
> - **只读** → `.tag`（或等价的静态工具类），**零反馈**：没有 `:hover`、没有 `:active`、不进 Tab 序列。
>
> 「加了 hover 却点不动」是假 affordance，比没有反馈更糟：用户会以为漏了实现。

---

## 五、§七 动效系统 · 补一条（非动效，但属渲染性能）

**背景**（[D-24]）：2000 行的导入预览此前每次改任一行分类都全量 `JSON.stringify` 并写进 hidden input。

**本包的落地**（不改契约，作为「长列表/大数据不进 DOM」的实践条目）：

- 预览行 `<tr>` 上 `content-visibility: auto` + `contain-intrinsic-size: auto 37px`（**必须成对**，否则滚动条长度随渲染进度抖）；
- 全量数据不进 DOM：只渲染前 200 笔预览，提交时由 `formData.set("rows", …)` 注入。

**建议在 §七 补一小节「长列表与大数据的渲染」**：

> 超过约 200 行的列表：
> 1. 行元素加 `content-visibility: auto` + `contain-intrinsic-size`（成对，后者必须给，否则滚动条抖）；
> 2. 视口外的行用固定值占位，不用 `<Skeleton>` —— 一旦随滚动进出视口就开始闪；
> 3. 大数组（如导入的 2000 行）**不通过 DOM 传递**：hidden input 的 value 每次 change 都要重算 + 重写，实测在移动端是明显的主线程长任务来源。改用 `useRef` 持有最新数组，在提交那一刻 `formData.set()` 注入。

---

## 六、§十三 MUI 接入 · 补一条

**背景**：[D-41] 把 `delete-category-button` 的 32px 触控目标提到 44px 后，chip 内的 `×` 会在视觉上撑高 chip。

**本包的落地**（`delete-category-button.tsx`）：

```tsx
// 44×44 触控 + margin: "-6px -14px" 把多出的 12px 用负边距收回来，
// chip 的视觉高度与改前完全一致。
sx={{ minHeight: 44, minWidth: 44, fontSize: "0.875rem", lineHeight: 1, margin: "-6px -14px" }}
```

**建议在 §十三 使用约束补一条**：

> 嵌在紧凑容器（`.chip`、表格行）内的 MUI Button，44px 触控目标一律配 `margin: 负值` 收回视觉撑开 —— 触控目标与视觉尺寸可以不一致，前者管可达性，后者管密度。

---

## 七、§十 文案语调 · 无变更

本包所有新增/改写的文案均符合既有约定，未提出契约变更：

- 调整余额成功：「已调整余额，可以再调一次。」（动作前后同名 + 给出可恢复性）
- 设置页错误面板：「账户与分类 / 本月预算 / 导入账单」作为 `SectionError` 的 `label`，让三个面板互相可区分（原先是三块一模一样的文字）
- 导入表格 region 名：「导入预览表格，可横向滚动」（说清是什么 + 暗示可操作）
- 登录成功：「注册成功，请到邮箱确认后再登录」（不变，仅从 ember + alert 迁到 jade + status）
- 一键补齐默认分类失败：「读取分类失败，请稍后再试」/「补齐默认分类失败，请稍后再试」（不变，仅改播报强度）
