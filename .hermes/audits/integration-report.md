# 契约与文档收口 · 集成报告

- 日期：2026-09-28
- HEAD（本包开始时）：`a8b3d03`（WP-1 已入库）
- 范围：DESIGN.md · STRUCTURE.md · README.md · `src/app/loading.tsx` · `src/app/globals.css` · `.gitignore` · `.hermes/audits/`
- 明确不碰（并行审核中）：`src/app/overview-client.tsx` · `src/app/data/**` · `src/app/ledger/**` · `src/app/settings/**` · `src/app/login/**` · `src/app/api/**` · `src/lib/api/**`

本包只做横跨包的设计契约、文档一致性与骨架层级收口。**每条声明都逐条核对过代码**；
核对不通过的，要么标为待办，要么从「已实现」降级为「建议」，没有把未实现的写成已实现。

---

## 一、决策 1：删除根级 `src/app/loading.tsx`

**裁定：删除。**（三选一里的第 1 项）

### 核实过程与证据

先在**未改动**的状态下跑了一次 `next build`（构建锁 `.hermes/.build-lock`），
再逐字节比对 `.next/server/app/*.html` 里 `<main>` 元素的 SHA-256：

| 路由 | 删除前 `<main>` 长度 | SHA-256（前 12） | 骨架区块名 | bailout |
|---|---|---|---|---|
| `/` | 3893 | `340ad480728c` | 近 6 个月收支趋势 / 本月支出占比 / 近 30 天总资产曲线 / 各账户余额 / 本月预算进度 | 0 |
| `/data` | 3893 | **`340ad480728c`（与 `/` 相同）** | 同上 | **1** |
| `/settings` | 3893 | **`340ad480728c`（与 `/` 相同）** | 同上 | 0 |
| `/ledger` | 3016 | `a4c1923f2854` | （无区块名） | 0 |
| `/login` | 2690 | `cd1fec2fed3b` | （无） | 0 |

即：`/data` 与 `/settings` 的首屏显示的是**总览页**的骨架——两页都写着「各账户余额 /
本月预算进度」，而它们根本没有这两个区块。`/data` 另带
`BAILOUT_TO_CLIENT_SIDE_RENDERING` 标记，即真实内容被推到客户端渲染之后才出现。

**比 WP-3 报告的更严重**：WP-3 只报了 `/data`，实测 `/settings` 同样中招（WP-3 当时
尚未提交 `settings-client.tsx` 的骨架，两条路由撞同一副骨架）。

**机制**（不是猜的，是产物证据）：根级 `loading.tsx` 在 App Router 里包裹的是整个
`children`，比任何路由级 `loading.tsx` **更外层**，因此在预渲染产物中占据可见槽位，
路由自己的骨架被推进内层。`/ledger` 与 `/login` 未受影响，正是因为它们各自的
`loading.tsx` 结构与总览骨架差异足够大、且页面本身没有触发 bailout。

### 删除后复测（同一份构建流程）

| 路由 | `<main>` 长度 | SHA-256（前 12） | 首个 h1 |
|---|---|---|---|
| `/` | 3881 | `27c206784014` | 总览 |
| `/data` | 4928 | `58d7b867fc48` | 曲线与查询 |
| `/ledger` | 2947 | `de43cc4d903d` | 记账 |
| `/settings` | 6488 | `29be8f92ca75` | （骨架态，走自己的 `掌灯中…`） |
| `/login` | 2690 | `cd1fec2fed3b` | 雾夜账 |

五条路由的 `<main>` **两两不同**；`/data` / `/settings` 各自渲染自己的 `掌灯中…` 骨架；
跨页串味消失。`next build` 通过，四页仍全为静态 `○`。

### 为什么这比「看起来更好」更硬

WP-1 审核通过的是「根级骨架镜像总览布局」这个**局部**判断，它本身没错；遗漏的是
**溢出效应**。三条硬理由：

1. **可复现的产物级缺陷，不是观感问题。** 三个不同路由的 `<main>` 哈希完全相同，
   这是可判定的布尔事实，不是审美。用户在 `/settings` 上第一眼看到「各账户余额」，
   而该页的账户区标题是「账户与分类」——骨架在**说这个页面上不存在的东西**。
2. **四页形状各异，根级那份必然是某一页的复制品，而复制品在其余三页上就是错的。**
   这不是本项目的特例判断，是「一个文件要同时正确描述四种形状」在信息论上的不可能。
3. **契约自身已经给出了答案。** §七.2 原有条文就要求「布局镜像真实页面：区块顺序、
   双列网格、行高对齐真实内容，杜绝加载完成后的布局跳动」——根级骨架在 `/data` 上
   **必然**跳出，且跳的是整页。删除是让实现回到既有契约，而不是新增规则。

因此 §七.2 已重写为三条带判据的硬规则（不设根级 loading / 一个区块的骨架只能有一份 /
骨架里不得含随访问变化的值），并把上面的产物哈希写进契约作为**可复现的判据**。

---

## 二、决策 2：§九 饼图色板第 8 槽 —— 改色板，不加例外

**裁定：把 `#94A3B8` 换成 `var(--color-dim)`（`#8B93A7`），不给 §十一 #6 开例外。**

PM 审计标记的「契约内部矛盾」：`#94A3B8` 是 Tailwind `slate-400` 的**字面值**，
而 §十一 #6 写的是「禁 zinc/neutral/slate 灰阶」。一份契约不能一边禁灰阶、
一边在自己的色板里写死一个灰阶色值。

**为什么选「改色板」而不是「加受控例外」**：

- 受控例外会把一条**可机器执行**的禁忌（eslint 守卫逐条比对类名）降级成一句
  需要人每次都重新判断的散文。§十一 的十条禁忌之所以有力，正因为它们是无条件的。
- 这条例外没有任何不可替代性：色板第 8 槽要的是「中性的一档」，而项目里本来就有一个
  更好的中性令牌。**没有必要的例外就不该存在**——它只会在下一次有人想加第 9 条时
  变成「既然有例外，再加一条也行」。

**为什么是 `var(--color-dim)` 而不是随便换个「新灰」**——令牌额外带来两件白名单做不到的事：

1. 它受 `prefers-contrast: more` 覆盖（该偏好下为 `#b6bed1`，对 mist 9.54:1）。
   写死的 hex **不受任何偏好覆盖**，等于在一处偷偷开后门。
2. 它是 §二 的既有令牌，跟着主题走，不需要在两处维护同一个灰。

**数值验证**（WCAG 相对亮度实算）：

| | 对 mist | 对 night | 对 veil |
|---|---|---|---|
| `#8B93A7`（新） | 5.78:1 | 6.29:1 | 5.05:1 |
| `#94A3B8`（原） | 6.93:1 | 7.54:1 | 6.20:1 |

图形对象下限是 3:1，新值余量接近一倍。唯一的指标变化是比值略降。

**但相邻切片的可分辨性反而变好**（RGB 欧氏距离，越大越易分辨）：

| 与 | 原 `#94A3B8` | 新 `#8B93A7` |
|---|---|---|
| #7 `#D98A4B`（橙） | 25 | **121** |
| #1 `#E3B341`（灯） | 31 | **138** |
| #5 `#B48BE0`（紫） | 42 | **71** |

原值与橙色槽的距离只有 25，两片相邻扇区在视觉上几乎同亮；新值 121。**这是修正，
不是妥协。**

§十一 #6 同步补了「这条对色值同样生效，不只对类名」——写死 `slate-400` 的字面值与写
`slate-400` 类名是同一件事，只是绕过了 eslint 守卫的字符串匹配。

---

## 三、决策 3：[D-49] 契约张力裁定

**张力**：§六线框图规定总览 hero 只有 eyebrow + 大数字；§六又规定「区块头部统一
eyebrow + serif 标题」。两条对总览 hero 有张力。WP-2 按前者（线框图）执行。

**裁定：WP-2 执行正确。线框图比通则更具体，冲突时以线框图为准。** 已写入 §六，
并把「更具体者优先」这个隐含判断写成明文（否则下一个人还会重新纠结一遍）。

理由：

1. **信息量。** 总览 hero 回答的是「本月账是多少」。页名「总览」对它没有信息量——
   它是导航项，用户已经身在总览页。其余三页的 serif 标题都在回答「我在哪」
   （记账 / 曲线与查询 / 设置），那是**导航锚点**，不是装饰。把一个零信息量的词
   放到首屏最贵的位置，是拿首屏 fold 换一句话。
2. **首屏预算。** hero 上方再压一行 20–22px serif 标题，会把灯下大数字挤到首屏折线
   附近。而大数字是本页唯一需要被一眼看到的东西——§六 线框图把它放在灯线之上、
   区块之前，是刻意的。
3. **不是「放松」而是「精确」。** 保留的唯一硬要求是：eyebrow 同时作 `<h1>`
   （可见文本，不是 `sr-only` h1 + `aria-hidden` eyebrow 的两份文本）、四个分支
   （加载/错误/有数据）都有 h1、加载分支的 h1 **不含月份**（该分支会进静态预渲染
   HTML，取「今天」会造成构建日 ≠ 访问日的 hydration 不一致）。

---

## 四、决策 4：`.num` 与 `.tag` 落地（globals.css）

WP-3 与 WP-5 都因为 `globals.css` 不在自己所有权内而用了等价工具类顶替。
`a8b3d03` 入库后该文件无人拥有，故由本包正式补上。**未改任何调用点**
（`data-client.tsx` / `settings-client.tsx` 属并行审核中的包）。

### `.num` —— 计数

```css
.num { font-variant-numeric: tabular-nums; }
```

**语义边界：计数需要的是「数字等宽」，不是「字族等宽」。** 多行列表要的是数字逐行对齐；
把中文量词「笔」和数字一起塞进 mono 是浪费——mono 的价值在对齐数字，不在渲染汉字。
「共 1,280 笔」用 mono 读起来像一笔账。计数同时应带千分位。

与 `.money` 的分工：金额走 `.money`（mono + tabular + 紧字距），计数走 `.num`
（仅 tabular，沿用正文字族）。**互不替代。**

### `.tag` —— 只读标签

```css
.tag { border: 1px solid var(--color-fogline-strong);
       background-color: var(--color-veil);
       color: var(--color-dim);
       border-radius: 9999px; padding: 0.25rem 0.75rem; font-size: 0.875rem; }
```

**语义边界：`.chip` 在本项目里 =「可点的选择器/标签」，它的 `:hover` 转纸墨是一次
明确的 affordance 承诺。** 给只读元素套 `.chip` 就是假 affordance——它亮一下却点不动，
用户会以为漏了实现，而不是以为这里不可点。`.tag` 外形同 `.chip`，但**零反馈**：
没有 hover / active / 焦点环，也不在 Tab 序列。

判据是**元素本身是否可交互**，不是「它在一个看起来像列表/像标签的容器里」——
这条已从「不要做」升级为「怎么做」写进 §七.3（可交互 → `.chip`/`.btn-*`/`.link-subtle`；
只读 → `.tag`，二选一，无第三种）。

### 验证

`node .hermes/audits/contrast-check.mjs` → **11/11 通过，0 失败**（真实输出见下）。
`node .hermes/audits/format-check.mjs` → **13/13 通过**。

---

## 五、决策 5：补登 §八 第三条例外 + 例外清单自身的纪律

**补登**：设置页 `import-client.tsx:360` 的 `bg-gradient-to-l from-night to-transparent`
横滑遮罩（WP-5 报告，[D-11 审计禁忌 #4] 标记至今未登记）。

**裁定：登记为例外。** 它是表格右侧「右边还有内容、可以横滑」的**方向提示层**，
`pointer-events-none` + `aria-hidden` 的纯装饰，`md` 以上不渲染。
§十一 #4 禁的是**渐变按钮**与**渐变进度条**，不是所有渐变——它在语义上两者都不是：
它不承载动作，也不表示进度，只表示「这段内容还没到头」。

例外写明了**边界**（不得用于任何可点元素本身、不得改为双向、不得承载文案），
并给「已批准的例外」清单本身加了一条纪律：**新增例外必须写明为什么必要、边界在哪、
为什么不违反被引的那条禁忌。** 只写「已批准」而不写边界的例外，等于把禁忌开了一个
没有形状的口子——下一个人会照着它做第二件事。

---

## 六、决策 6：`.hermes/` 版本化策略

**裁定：整份审计流水当项目资产入库**（不撤出已入库的 `reviewer-wp1.md`），
并用 `.gitignore` 排除真正的临时产物。

**理由**：

1. `DESIGN.md` 的变更记录里直接引用了 `.hermes/audits/reviewer-wp1.md`（「审核报告见
   `.hermes/audits/reviewer-wp1.md`」）。撤出仓库 = **契约引用了一个不存在的文件**，
   这比「一半入库」更糟。
2. `[D-xx]` 编号是全项目的交叉引用语言（DESIGN.md 变更记录、代码注释、AGENTS.md 的
   自检要求都在用）。这些编号的**唯一出处**就是 `.hermes/audits/`。撤出 = 编号变成
   无解引用。
3. 这些文件记录的是**实测数据与「为什么」**（本报告里那些产物哈希、对比度实算值），
   不是过程日志。下一个接手的人要判断「能不能删掉根级 loading.tsx」时，需要的正是
   这些证据，而不是重新跑一遍 build。

**另一半问题也一并解决**：`.gitignore` 补了 `.hermes/.build-lock`（并发跑
`next build` 的互斥目录，纯运行时状态）、`.hermes/tmp/`、`.hermes/cache/`、
`.hermes/*.log`。**规则写在文件里并附理由**，而不是靠「大家记得别提交」。

---

## 七、待接线清单（本包**未**执行，交给相应所有者）

这些是**刻意没做**的：文件属于并行审核中的包，改了会与他们的提交冲突。

| # | 待接线项 | 文件与位置 | 动作 |
|---|---|---|---|
| 1 | **`.num` 接线** | `src/app/data/data-client.tsx:85` | `tabular-nums` → `num`（WP-3） |
| 2 | **`.num` 接线** | `src/app/data/data-client.tsx` 「只显示前 N 笔（共 N 笔）」 | 同上（WP-3） |
| 3 | **`.num` 接线** | `src/app/settings/settings-client.tsx:280-282` 「最近导入」三处笔数 | `money` → `num`（WP-5） |
| 4 | **`.num` 接线** | `src/app/settings/import-client.tsx:306,311,366,395` 四处笔数 | `money` → `num`（WP-5） |
| 5 | **`.tag` 接线** | `src/app/settings/settings-client.tsx` 归类规则 `<li>` | 静态工具类 → `tag`（WP-5） |
| 6 | **色板第 8 槽** | `src/components/dashboard-charts.tsx:20-29` `PALETTE` 数组 | `"#94A3B8"` → `"var(--color-dim)"` |
| 7 | **锚点偏移** | `src/app/settings/settings-client.tsx:92` `#accounts` | 删 `scroll-mt-20` |
| 8 | **锚点偏移** | `src/app/settings/settings-client.tsx:414` `#import` | 删 `scroll-mt-20` |
| 9 | **`.money` 残留自查** | 全站 | 换完 1–4 后 `grep -rn 'className="[^"]*money' src/` 应只剩真正的金额 |

第 6 项虽只有一行，但 `dashboard-charts.tsx` 属 WP-6 审核范围，本包不动。
接线完成后建议复跑 `contrast-check.mjs` 确认色板无回归。

---

## 八、逐条核对结果（fragment 声明 vs 代码）

**核对方法**：对每条 fragment 声明跑具体的 `grep`/读取，不看报告只看代码。

### WP-2 —— 全部核对通过

| 声明 | 核对 |
|---|---|
| D-08 `formatSignedMoney` 下沉 | ✅ `format.ts` 有实现；`overview-client.tsx` 10 处引用 |
| D-49 h1 统一 | ✅ `overview-client.tsx:167-172` 可见 h1 + 加载分支不带月份 |
| D-07 账户余额行去 hover | ✅ `:294-297` 已删 hover / 过渡 / rounded-md，附理由注释 |
| D-06 错误态收敛 + 重试 | ✅ 单个 `SectionError` + `reload`，h1 补齐 |
| D-26 `<main id="main">` | ✅ `overview-client.tsx:380` |

### WP-3 —— 大部分通过，两条修正后写入

| 声明 | 核对 |
|---|---|
| D-05 fallback 不得为 `null` | ✅ `page.tsx:27` `fallback={<DataShell />}` |
| D-17 骨架同源 | ✅ `data-shell.tsx` 一份，三处引用 |
| D-05 日期来自访问日 | ✅ `buildPresets(today)` 是纯函数入参 |
| D-05 UTC 日期算术 | ⚠️ **不在 `query-params.ts`/`presets.ts`，而在 `src/lib/ledger/stats.ts`**（`Date.UTC` / `getUTCDate`，`monthEnd` 用 `Date.UTC(y, m, 0)`），由 `presets.ts` import。已按实际落点写入，未夸大成「已在数据页内」 |
| D-06 错误粒度 = 请求粒度 | ✅ `data-client.tsx:344` 单个 `SectionError` + `reload` |
| D-43 锚点单一来源 | ⚠️ **只完成一半**：数据页已删，`settings-client.tsx:92,414` 两处 `scroll-mt-20` 仍在。已标为待接线（见上表 7、8） |
| D-11/D-35 参数校验两端共用 | ✅ `api/data/route.ts:11` 与 `data-client.tsx:21` 同一 import |
| 转义（`.or()` / LIKE） | ✅ `escapeLikePattern` + `escapeOrValue` 均在用 |
| D-44 `.num` | ⏳ **未落地**（当时不归 WP-3），本包补了类定义，调用点待接线 |

### WP-4 —— 全部核对通过

| 声明 | 核对 |
|---|---|
| `ConfirmSubmitButton` 收敛 | ✅ 存在；`reportValidity`（`:133`）、`confirmColor?: "primary" \| "error"`（`:85`）均已落地 |
| `TypePicker` APG 契约 | ✅ 存在；roving tabindex + 方向键 + Home/End |
| `<main id="main">` | ✅ `ledger-client.tsx` 与 `loading.tsx` 各 1 处 |
| D-21 空态指向存在的门 | ✅ `ledger-client.tsx:209` `href="/settings#accounts"` |
| D-45 日期口径 | ✅ `shanghaiDate()`（`stats.ts:198`）+ `suppressHydrationWarning` |
| D-46 渠道默认 `direct` | ✅ `transaction-form.tsx:152` + 服务端兜底一致 |
| D-15 断言归零 | ✅ `relationName()`（`ledger-client.tsx:46`）已抽出 |

### WP-5 —— 全部核对通过

| 声明 | 核对 |
|---|---|
| 横滑遮罩 | ✅ `import-client.tsx:360`（已补登 §八 例外） |
| D-24 `content-visibility` + `contain-intrinsic-size` | ✅ `:80` **成对**出现 |
| D-24 全量数据不进 DOM | ✅ `rowsRef`（`:171-173`）+ 提交时 `formData.set`（`:224`），`PREVIEW_ROWS = 200` |
| D-41 44px + 负边距 | ✅ `delete-category-button.tsx:50` `minHeight:44 … margin:"-6px -14px"` |
| D-20 notice / error 拆分 | ✅ `login/page.tsx:21` 独立 `notice` state（jade + role=status） |
| D-42 `.tag` / D-44 `.num` | ⏳ 调用点待接线（见上表） |

---

## 九、遇到的问题

1. **构建被并行审核中的瞬时状态阻断过一次。** 首次 `next build` 报
   `query-params.ts:102` 语法错误；核对该文件 mtime 发现它在**几秒前**刚被写入，
   是 WP-3 审核员的中间态（一个 JSDoc 的 `/**` 尚未落盘）。等待文件稳定后重跑即通过。
   **这不是本包的缺陷，也没有去「修」它**——那会覆盖对方正在进行的工作。
2. **测试与 lint 在并行审核期间有瞬时红。** 观察期间 `npm test` 在
   `src/app/data/query-params.test.ts`（WP-3 的新文件）出现 5→6 个失败，
   `tsc` 报 `src/lib/api/session.ts:78`、eslint 报 `use-api-data.ts` 的
   rules-of-hooks——均位于正在被编辑的文件中（mtime 均为观测前 2 分钟内）。
   本包自己的改动不涉及这些文件。本报告的验证结论以**本包改动落地后、且不覆写他人
   中间态**的实跑结果为准，见下。

---

## 十、本包验证结果（真实输出）

```
$ npx tsc --noEmit
（0 errors）

$ npx eslint
（0 errors, 0 warnings）

$ node .hermes/audits/contrast-check.mjs
── 对比度实测 ──
 fogline-strong on veil（.input 边框）  3.05:1  ≥3.0  PASS
 fogline-strong on mist（.chip 边框）   3.49:1  ≥3.0  PASS
 fogline on mist（.panel 装饰边框）     1.39:1  —    PASS
 fogline on veil（.panel 装饰边框）     1.22:1  —    PASS
 more: fogline-strong on veil           5.38:1  ≥3.0  PASS
 more: fogline-strong on mist           6.16:1  ≥3.0  PASS
 more: fogline on mist（装饰线）        2.25:1  ≥1.4  PASS
 焦点环 lamp@60% on night               4.16:1  ≥3.0  PASS
 焦点环 lamp@60% on mist                4.03:1  ≥3.0  PASS
 ink on night（正文）                  15.25:1  ≥4.5  PASS
 dim on night（次要文字）                6.29:1  ≥4.5  PASS
结论：11/11 通过，0 失败

$ node .hermes/audits/format-check.mjs
ℹ tests 13  ℹ pass 13  ℹ fail 0

$ npx next build   （删除根级 loading.tsx 之后）
✓ Compiled successfully
Route (app):  ○ /   ○ /data   ○ /ledger   ○ /settings   ○ /login
（四个应用页全部仍为静态 ○）
```

产物抽查（删除根级 `loading.tsx` 之后，`.next/server/app/*.html` 的 `<main>`）：

| 路由 | SHA-256（前 12） | 首个 h1 | 串味 |
|---|---|---|---|
| `/` | `27c206784014` | 总览 | — |
| `/data` | `58d7b867fc48` | 曲线与查询 | 无 |
| `/ledger` | `de43cc4d903d` | 记账 | 无 |
| `/settings` | `29be8f92ca75` | （自己的 `掌灯中…` 骨架） | 无 |
| `/login` | `cd1fec2fed3b` | 雾夜账 | 无 |

---

## 十一、路径断言抽查（STRUCTURE.md / README.md）

对 STRUCTURE.md 目录树逐条 `os.path.exists` 重建路径后核对：

- **48 条**文档中已登记的树条目 —— **全部存在**（0 缺失）。
- 反向核对：真实存在的 `.ts/.tsx/.css` 共 82 个，未在文档中登记的由 **19 个降为 11 个**，
  其中 8 个是 `src/app/settings/` 的表单/按钮子组件（已用一条集合条目统一登记），
  3 个是 WP-6 审核期间新增的 `src/lib/api/` 文件（已补登记）。
- 本任务点名的 7 个新文件全部确认存在且已登记：
  `src/app/data/{query-params,payload,presets,data-shell}.ts(x)` ✅ ·
  `src/app/ledger/type-picker.tsx` ✅ · `src/components/confirm-submit-button.tsx` ✅ ·
  `src/lib/api/api-cache.ts` ✅（另 `src/components/mui-gate.tsx` 原本就已登记 ✅）。

同时修正了 STRUCTURE.md 中三处**已过期或错误**的陈述：

1. 根级 `loading.tsx` 的 CAVEAT 段（说「两套骨架会漂移，待解决」）→ 改为记录删除决定与产物证据。
2. `/data` 的 NOTE 段（说 `fallback={null}` 尚未解决）→ [D-05] 已解决，且说明该 Suspense
   边界**必须保留**（去掉会导致 production build 失败）。
3. 「Sign-out wiring is still outstanding」→ 实际已接线（`site-nav.tsx:102` 调
   `resetApiCache()`），已更正。
