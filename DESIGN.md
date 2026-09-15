# 雾夜账 MistLedger · 设计系统

> 本文档是 MistLedger 界面的**唯一设计契约**。任何界面改动（配色、字体、组件、动效、文案）都必须遵循本文档，改动需同步更新此文件。

---

## 一、设计理念：雾里点灯看账

**主体**：雾夜账是一个中文个人记账应用。**受众**：记账者本人——一个想看清自己钱的人。**页面的唯一职责**：让人看清「每笔钱从哪出、还剩多少」。

产品的名字就是设计任务书：**雾夜账——雾夜里的账房**。标语「看清每笔钱从哪出、还剩多少」本身就是一句视觉宣言：雾是遮蔽（看不清钱去哪了），灯是照明（记账这件事）。

因此整个界面只有一个意象：**深夜账房，掌灯看账**。

- **夜**——蓝黑的底色，不是纯黑。夜晚有层次：天穹、雾面、纱面。
- **雾**——缓慢漂移的背景雾气、发丝般的雾线边界、转场时「雾散显影」。
- **灯**——琥珀色灯火是唯一的主角色。数字在灯下显影，激活项下有一条灯线，加载时是在「掌灯」。
- **账**——宋体的标题骨相（老账簿），等宽数字的金额（账房笔笔清楚），暖纸白的文字（灯下的纸）。

### 一条审美冒险（及理由）

**全站强制常夜模式**，不提供浅色模式，不跟随系统偏好。理由：产品名叫「夜账」，浅色模式是对名字的背叛。代价是可读性，收益是身份。为控制代价：正文对比度 ≥ 4.5:1（ink on night ≈ 13:1，dim on night ≈ 5:1），控件色统一 `color-scheme: dark`。

### 与「AI 默认审美」的距离（自我校验记录）

- ❌ 不是奶油底 + 陶土色 + 衬线（默认look 1）
- ❌ 不是近纯黑 + 单一酸绿/朱红 accent（默认look 2）——本方案是**蓝黑分层表面 + 暖纸墨文字 + 双语义色（余烬/玉绿）+ 灯色只做点睛**，且直接演绎自产品名
- ❌ 不是报纸 hairline + 零圆角（默认look 3）
- ❌ 不用 01/02/03 编号装饰——记账内容不是序列，编号是撒谎

---

## 二、色彩系统

全部以 Tailwind v4 `@theme` token 定义，生成 `bg-*` / `text-*` / `border-*` 工具类。

### 身份色（5 个）

| Token | 值 | 名 | 用途 |
|---|---|---|---|
| `--color-night` | `#0A0E14` | 夜空 | 页面底色（蓝黑，非纯黑） |
| `--color-ink` | `#E9E4D8` | 纸墨 | 主文字（灯下暖纸白，偏暖不偏灰） |
| `--color-lamp` | `#E3B341` | 灯火 | **唯一主角色**：CTA、激活态、关键数字的 ¥ 符号、灯线、焦点环 |
| `--color-ember` | `#E2574C` | 余烬 | 支出（暖烬红，替代刺眼 red-600） |
| `--color-jade` | `#6FBF8F` | 玉绿 | 收入（玉青，替代刺眼 green-600） |

### 功能色（4 个）

| Token | 值 | 名 | 用途 |
|---|---|---|---|
| `--color-mist` | `#111826` | 雾面 | 卡片/面板表面 |
| `--color-veil` | `#1B2436` | 纱面 | 输入框、hover 态、表格行悬浮 |
| `--color-fogline` | `#28324A` | 雾线 | 全部边框/分隔线 |
| `--color-dim` | `#8B93A7` | 远雾 | 次要文字、占位符 |

### 用色规则

1. **灯火只做点睛**：每屏常亮灯色不超过 3 处（导航激活灯线、关键数字的 ¥、主按钮）。大面积铺灯色 = 犯规。
2. 支出/收入一律用 `ember` / `jade`，禁止再引入其他红绿。
3. 边框一律 `fogline`，禁止纯灰 zinc/neutral。
4. 转账（中性）用 `ink`/`dim`，不染色。
5. 超支警示：`ember` + 文字「超支」，不用刺眼纯红。
6. `:root` 声明 `color-scheme: dark`；删除 prefers-color-scheme 媒体查询（常夜）。

---

## 三、字体系统

通过 `next/font/google` 加载，CSS 变量挂在 `<html>` 上：

| 角色 | 字体 | 变量 | 字重 | 用途 |
|---|---|---|---|---|
| 展示 | **Noto Serif SC** | `--font-display` | 600 / 700 / 900 | 页面标题、词标「雾夜账」、区块标题。宋体骨相 = 账簿。**克制使用**：正文和按钮不用它 |
| 正文 | **Noto Sans SC** | `--font-body` | 400 / 500 / 700 | 全部 UI 文字、表单、说明 |
| 数据 | **Geist Mono** | `--font-geist-mono` | 400 / 600 | **所有金额**。必须 `tabular-nums` |

### 字阶

| 层级 | 规格 |
|---|---|
| 页面主标题（hero 数字除外） | serif 600 · 22–24px |
| Hero 大数字（总资产） | mono 600 · 40–48px · `tabular-nums` · tracking-tight |
| 区块标题 | serif 600 · 16–17px |
| eyebrow 小标 | sans 500 · 11px · `letter-spacing: 0.2em` · `dim` 色 |
| 正文 | sans 400 · 14px · `ink` |
| 次要说明 | sans 400 · 12–13px · `dim` |
| 金额 | mono · 13–15px · `tabular-nums` |

### 金额书写铁律

- 金额一律 `.money` 类（mono + tabular-nums）。
- 支出前缀 `−`（U+2212）、收入前缀 `+`、转账前缀 `⇄`，¥ 紧跟其后。
- 保留两位小数，`toLocaleString("zh-CN")`。

---

## 四、签名元素：灯线（lamp line）

> 整个界面靠**一件事**被记住：一条带辉光的琥珀细线。

**实现**（globals.css 中 `.lamp-line`）：

```css
.lamp-line {
  height: 1px;
  background: var(--color-lamp);
  box-shadow: 0 0 8px rgba(227, 179, 65, 0.55), 0 0 24px rgba(227, 179, 65, 0.25);
}
```

**允许出现的位置**（白名单，其余位置禁止）：

1. **导航激活项下缘**——当前页的灯（导航内用短横线版本，宽度 = 文字宽）。
2. **Hero 数字下方**——总览页大数字与次级统计之间，一条全宽灯线 = 「灯照亮账本第一行」。
3. **登录页词标下方**——进门第一眼。

**规则**：每屏常亮灯线 ≤ 1 条（导航那条不计）。禁止把灯线当装饰边框到处贴。

---

## 五、氛围：雾

body 上两层**缓慢漂移**的径向渐变雾（`body::before` / `body::after`，`position: fixed`，`pointer-events: none`）：

- 一层冷蓝雾（`rgba(126,162,214,0.06)` 级别）偏左上，一层暖灯雾（`rgba(227,179,65,0.04)`）偏右下。
- `@keyframes fog-drift`：60–90s 交替漂移（translate 数十 px 即可），`prefers-reduced-motion` 下静止。
- 雾永远在最底层、永远极淡——它是氛围不是图案，用户不该"看见"它，只该"感觉"夜里有雾。

---

## 六、布局概念

- 容器：`max-w-4xl` 居中，`px-4 py-6`，区块间距 `gap-6`。不做超宽仪表盘——账房是一张桌子，不是指挥中心。
- 面板：`.panel`（雾面 + 雾线边框 + 大圆角 xl + 极轻内高光），内部留白 `p-4`~`p-5`。
- 区块头部统一结构：**eyebrow 小标（雾气里的字）+ serif 标题**，标题下不再加线。
- 总览页信息层级（信息结构即布局）：

```
┌──────────────────────────────────────────┐
│ 雾夜账         总览 记账 数据 设置         │ ← 激活项下有灯线
│ 二零二六年九月 · 本月账                    │ ← eyebrow（月份用汉字数字）
│ ¥ 12,345.67                              │ ← hero：mono 大数字，¥ 为灯色
│ ──────── 灯线 ────────                   │
│ 本月支出 ¥3,210.00   本月收入 ¥8,000.00    │ ← ember / jade
├──────────────────────────────────────────┤
│ 近6个月收支趋势（全宽）                    │
│ 本月支出占比 ｜ 30天资产曲线（两列）        │
│ 各账户余额                                │
│ 本月预算进度（进度条：ember 超支/ink 未超） │
└──────────────────────────────────────────┘
背景：两层缓漂的雾
```

- **预算进度条**：底轨 `veil`，填充未超支用 `ink/70`（灰纸色，克制），超支才用 `ember`。禁止渐变进度条。
- 登录页：居中窄卡（max-w-sm），词标 serif + 灯线 + 标语，是全站的「门」。
- 导航在 `/login` 隐藏（登录页是门，不需要房间内的指示牌）。
- 移动端（<sm）双层导航：顶部 sticky 品牌栏（词标「雾夜账」+「退出」，`pt-[env(safe-area-inset-top)]` 撑开刘海/挖孔区，滚动时内容从雾面下穿过）+ 固定底部 tab 栏（4 项导航，safe-area 底距由 body padding 预留）。桌面仍是单层顶栏。导航四项为总览/记账/数据/设置，导入与账户并入设置页，以区块锚点 #accounts / #import 呈现。
- 数据页（/data）：曲线与查询的账房档案柜。结构自上而下：近 12 个月收支趋势 → 总资产曲线（30/90/180 天 chip 切换，选中态用 `chip-active`）→ 常用查询（chip 预设链接）→ 自定义查询表单（可见小标签 + `.input`）→ 查询结果（汇总行 + 流水列表 + 支出构成饼图）。查询条件全部走 URL searchParams，可分享、可后退。

---

## 七、动效系统

动效只讲一个故事：**雾散**。内容不是"飞进来"的，是"从雾里显影"的。

### 1. 路由转场「雾散显影」

`src/app/template.tsx` 包裹 children，每次导航重新挂载并播放：

```css
@keyframes mist-in {
  from { opacity: 0; filter: blur(8px); transform: translateY(6px); }
  to   { opacity: 1; filter: blur(0);   transform: translateY(0); }
}
.page-enter {
  animation: mist-in 380ms cubic-bezier(0.22, 0.68, 0.32, 1) both;
}
```

- 时长 380ms，宁短勿长；blur 上限 8px。
- 禁止离场动画（App Router 无此必要，加了只会拖慢感）。

### 2. 路由级结构骨架屏

每个路由配 `loading.tsx`，用**结构骨架屏**镜像真实页面布局（`src/components/page-skeleton.tsx` 提供零件）：

- 骨架全部基于 `.skeleton` 类（veil 色块 + `skeleton-pulse` 2s 透明度脉动），不自定义颜色；禁用 lamp-dot 与 `.lamp-line`（灯属于内容，不属于等待）。
- 布局镜像真实页面：main 容器类与页面完全一致（如总览 `mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6`），区块顺序、双列网格、行高对齐真实内容，杜绝加载完成后的布局跳动。
- 图表占位固定 220px（与图表容器一致）；每个 loading.tsx 根节点 `role="status" aria-busy="true"` + `<span class="sr-only">掌灯中…</span>`，骨架不放可见文案、不放 emoji。
- `prefers-reduced-motion` 下骨架静止（全局降级规则覆盖 `skeleton-pulse`）。
- 根级 `src/app/loading.tsx` 现为总览骨架（hero 大金额线 + 趋势/双列图表 220px + 余额行 + 预算进度条），不再用全屏「掌灯…」灯点；`lamp-breathe` 灯点仅保留给离线兜底页（第七节 2.5）。

### 2.5 离线兜底（PWA Service Worker）

断网时的页面兜底由 `public/sw.js` 内联 HTML 提供，视觉复用「掌灯」语言：夜空底色 + 呼吸灯点（受 reduced-motion 约束）+ 文案「雾太浓了，暂时连不上账房」与提示「等雾散了再试一次」。不新建路由页（登录墙内页面无法被可靠预缓存），兜底样式以行内 CSS 写死并保持与令牌一致。

### 3. 微交互

- **即时响应（pointer-down）**：所有可交互面在按下的**那一帧**给反馈，不等抬起、不等 `click`。
  `.btn-primary` / `.btn-ghost` / MUI Button·Chip 用 `:active` 位移或缩放（`transform` 不在全局过渡属性内 → 无过渡、即时）；
  `.chip` 为内联元素（位移不生效）改用底色即时变化（`.chip:active` 提亮纱底，`.chip-active:active` 加深灯底）；
  导航链接用 `active:opacity-60`。悬停态仍走 150ms 颜色过渡，按压态不走。
- 面板/行 hover：背景 `mist → veil`，150ms。行本身不可点则**不加** hover（避免假 affordance），
  反馈只给真正可点的元素（按钮在行内时由按钮自身给）。
- 焦点环：一律 `ring-lamp/60`（键盘可见焦点，灯色）。禁止 outline-none 裸奔。
- 按钮 active：`translate-y-px`。
- 金额数字不做滚动/计数动画（账要稳，不要炫）。

### 4. 降级

`@media (prefers-reduced-motion: reduce)` 下：所有 animation/transition 时长归零，雾静止，内容直接显影。

---

## 八、组件契约（globals.css 中定义，页面直接使用）

| 类名 | 定义 | 用途 |
|---|---|---|
| `.panel` | `bg-mist border border-fogline rounded-xl` + `box-shadow: inset 0 1px 0 rgba(233,228,216,0.03), 0 1px 2px rgba(0,0,0,0.4)` | 所有卡片容器（内边距用 Tailwind 另加） |
| `.input` | `bg-veil border border-fogline rounded-md px-3 py-2 text-sm text-ink placeholder:text-dim/70 focus:ring-2 focus:ring-lamp/60 focus:border-lamp/60 outline-none` | 所有 input/select/textarea |
| `.btn-primary` | `bg-lamp text-night rounded-md px-4 py-2 text-sm font-medium hover:brightness-110 active:translate-y-px focus:ring-2 focus:ring-lamp/60` | 主操作（保存/创建/确认导入/登录） |
| `.btn-ghost` | `text-dim hover:text-ink rounded-md px-3 py-2 text-sm` | 次要操作 |
| `.link-subtle` | `text-dim underline underline-offset-4 hover:text-ink` | 行内链接 |
| `.chip` | `border border-fogline bg-veil text-dim rounded-full px-3 py-1 text-sm` | 分类标签、单选组未选中态 |
| `.chip-active` | `border-lamp/70 bg-lamp/10 text-lamp` | 单选组选中态（支出/收入/转账、数据来源） |
| `.eyebrow` | `text-[11px] tracking-[0.2em] text-dim font-medium` | 区块小标 |
| `.money` | `font-mono tabular-nums tracking-tight` | 一切金额 |
| `.lamp-line` | 见第四节 | 签名灯线 |

**CSS 优先级纪律**：组件类只定义自身属性，页面用 Tailwind 工具类补充间距/字号；禁止在页面里用元素选择器覆盖组件类。

**已批准的例外**（仅以下两处，其余一律按契约执行）：

- 设置页分类列表 `chip + text-ink`：已创建的分类是用户资产的一部分，用 `text-ink` 提高可读，对比度优先于“未选中态用 dim”的默认规则。
- 设置页导入区块文件选择 `input + border-dashed`：文件拖放/点选区用虚线雾线边框以表达“可投放”，hover 时 `border-lamp/60`；焦点环仍为灯色不变。

---

## 九、图表主题（Recharts）

| 元素 | 规格 |
|---|---|
| 网格线 | `fogline`，虚线 `strokeDasharray="3 3"`，只留横向 |
| 坐标轴文字 | 12px，`dim`；轴线 `fogline` |
| Tooltip | `bg-veil`，`border fogline`，圆角 8px，文字 `ink`，金额 mono |
| 图例 | 12px，`dim` |
| 支出柱 | `ember` |
| 收入柱 | `jade` |
| 资产曲线 | `lamp`，宽 2，无点（hover 出点，点填充 `lamp`、描边 `night`） |
| 饼图色板（按序循环） | `#E3B341` `#6FBF8F` `#E2574C` `#7EA2D6` `#B48BE0` `#5CC8C0` `#D98A4B` `#94A3B8` |

图表容器高度 220px；加载骨架见第七节。

---

## 十、文案语调

记账工具的文案 = 账房先生的口吻：**平实、动词开头、不寒暄、不卖弄**。

- 按钮 = 动作本身：「保存」「创建」「确认导入 128 笔」，禁止「提交」「确定」。
- 动作前后同名：点「导入」→ 结果提示「导入完成：新增 128 笔」。
- 错误文案说清**发生了什么 + 怎么办**，不道歉不模糊：「有 3 笔转账没选转入账户，请先补齐」。
- 空状态是邀请，不是叹息：「还没有账户，先在下面建一个（例如：银行卡 / 零钱通）」。
- 界面词汇表（全站一致）：账户、分类、流水、期初余额、上限、记账账户、转入账户。禁止同义漂移（如"记录/条目/行"混用，数量一律用"笔"）。
- 金额语境下数字永远用阿拉伯数字；月份在 eyebrow 中可用汉字数字（二零二六年九月）。

---

## 十一、禁忌清单（Code Review 时逐条对照）

1. ❌ 引入新的红/绿/蓝标准色（Tailwind red-500 之类）——语义色只有 ember/jade/lamp。
2. ❌ 大面积灯色（整块 amber 背景卡片、amber 大标题）。
3. ❌ 常亮灯线超过每屏 1 条（导航除外）。
4. ❌ 渐变按钮、渐变进度条、发光大标题。
5. ❌ `dark:` 变体（全站常夜，无需变体）。
6. ❌ zinc/neutral/slate 灰阶——用 night/mist/veil/fogline/dim。
7. ❌ 非 mono 字体的金额。
8. ❌ 单次转场/微交互动画 > 500ms；reduced-motion 下仍会动的元素。`fog-drift` / `lamp-breathe` / `skeleton-pulse` 为持续环境类豁免（不计入 500ms 上限），但必须受 `prefers-reduced-motion` 约束静止。
9. ❌ 焦点环被移除或换成非灯色。
10. ❌ 编号装饰（01/02/03）、emoji 图标、拟物阴影堆叠。

---

## 十二、实施与验收

- 技术栈：Next.js 16 App Router + Tailwind v4（`@theme` token）+ Recharts。改动 Next 约定前先查 `node_modules/next/dist/docs/`。
- 每次界面改动后：`npm run lint` 与 `npm run build` 必须通过。
- 验收动作：键盘 Tab 走一遍（焦点环可见）、`prefers-reduced-motion` 开启走一遍（无动画）、375px 宽度走一遍（不横向滚动）。

## 十三、MUI 接入（进行中，experiment/mui-trial）

`/ledger`（记账）、`/settings`（设置）与 `/login`（登录）可用 MUI 组件，其余现有页面（总览/数据）一律不动。
主题（`src/components/mui-theme.tsx`）把第二节令牌映射到 MUI palette：
`primary` 灯 `#E3B341`、`error` 烬 `#E2574C`、`success` 玉 `#6FBF8F`、
`background` 夜空 `#0A0E14` / 雾面 `#111826`、`text` 纸墨 `#E9E4D8` / 远雾 `#8B93A7`、
`divider` 雾线 `#28324A`；`warning` 指回灯色、`info` 指回远雾（不引入新标准色）；
`fontFamily` 指回 `var(--font-noto-sans-sc)`；`components` 复刻 `.input`（纱底+雾线边+灯焦点环）
与 `.btn`（主按钮灯底夜空字 + `brightness(1.1)` hover + `translate-y-px` active，
次按钮远雾字 hover 转纸墨）；纸面（Menu/Dialog）雾面+雾线边+面板级阴影，无渐变、无辉光。

使用约束：

1. MUI 组件只出现在 `/ledger`、`/settings` 与 `/login`；金额一律 `.money`（mono），不用 MUI Typography 渲染金额（金额输入框本身不加 mono，提交前仍走 formatMoney）。
2. 大面积灯色与渐变禁用；灯线 0 条（≤1，登录页词标灯线仍为契约白名单）。
3. 无 `dark:` 变体、无 zinc/neutral/slate；`warning`/`info` 已指回令牌，`error` 仅用于删除确认。
4. 焦点环一律灯色（`0 0 0 2px rgba(227,179,65,.6)`），与第七节一致。
5. 动画全部钉为 150ms；TouchRipple 默认 550ms 超 §十一 #8 上限，已全局 `disableRipple`，
   按压反馈改用 `active:translateY(1px)`。
6. 注入顺序（`src/components/mui-provider.tsx`）：`AppRouterCacheProvider`
  （`@mui/material-nextjs/v16-appRouter`，Next 16 通道）+ `ThemeProvider` + `CssBaseline`，
   包裹 `SiteNav` 与 `children`；`CssBaseline` 的 body 输出与 `globals.css` 完全同值。
   现有页面不渲染 MUI 组件即不产生 MUI 组件样式，故无回归；同一元素不混用
   Tailwind 与 MUI 竞争属性（布局间距走 `sx` 或外层 `div`）。有意不用 `enableCssLayer`，
   隔离靠上述两条保证，而非 layer 顺序。
7. 依赖仅 `@mui/material` `@emotion/react` `@emotion/styled` `@mui/material-nextjs`
  （不装 `x-date-pickers`，保持最小）。
8. `/settings` 的导入预览表格内紧凑 `select`、来源单选 chip、文件拖放虚线 `label`
   仍按第八节契约类实现（预览区逐行控件保持原生以维持 44px 触控与紧凑密度），
   仅区块级触发按钮（确认导入）与各二次确认迁移到 MUI Dialog/Button。

## 变更记录

- 2026-09-15 · 即时按压反馈（响应原则）：补齐所有可交互面在 pointer-down 上的反馈，消除「按下无反应、抬起才动」的迟滞感。`.btn-ghost` 增加 `:active` 纸墨色 + `translateY(1px)`（与 `.btn-primary` 对齐）；`.link-subtle:active` 转纸墨；`.chip` 增加 `:hover` 转纸墨、`:active` 提亮纱底（内联元素位移不生效，故用底色；`.chip-active` 悬停/按压保持灯色并加深灯底，避免被 `.chip:hover` 的纸墨色覆盖）；导航桌面项/移动 tab/词标链接补 `active:opacity-60`；MUI `MuiChip`（类型选择）补 `MuiChip-clickable` 的 `:hover` 转纸墨与 `:active scale(0.97)`，选中态悬停保持灯色。按压反馈全部走 `transform`/`opacity`（不在全局 150ms 颜色过渡内）→ 即时，不拖沓。第七节 3 微交互补「即时响应」条款；无新配色、无令牌变更、无动效时长变更。lint 与 build 通过。
- 2026-09-14 · 页面分区流式渲染（Suspense 分节 + 页内骨架兜底）：总览/记账/数据/设置四页改为分区 Suspense 流式渲染，每个分区是独立 async 组件并配页内骨架兜底（复用 `page-skeleton` 零件：SkeletonLine/Panel/Chart/Row/Bar/Chip，数据页查询表单骨架镜像真实表单结构）；分区数据失败由分区级 try/catch 渲染内联错误面板（panel + 「这一栏暂时加载失败，刷新后再试」，dim 文字，不新增配色）替代整页 error.tsx 兜底（error.tsx 根节点是 `<main>`，分区抛错会被其原位替换造成嵌套非法）；共享数据源经 React `cache()` 单次请求，失败时仅主分区显示错误面板、其余分区静默收起，不叠错误卡；骨架行补 `py-2` / `py-2.5` 内边距贴近真实行高；各 loading.tsx 的 `role=status aria-busy` 移入 `<main>` 内的包裹层（不再覆盖 main 地标），sr-only「掌灯中…」不变。无配色/动效变更；lint 与 build 通过。

- 2026-09-14 · sw v2 precache/SWR + staleTimes 路由缓存：`public/sw.js` 升级为 `mistledger-v2`——安装期预缓存 manifest 与图标，静态资源 cache-first，图标/清单 stale-while-revalidate（后台刷新挂 `event.waitUntil` 防 SW 提前终止），导航 network-first 且不缓存带 `Set-Cookie` 或 `cache-control` 含 no-store/private 的响应（避免缓存 /login 与过期会话页），离线兜底仍为内置「雾夜账 · 离线」页；登录墙内页面不预缓存，离线兜底为内置页（权衡：登录后页面离线不可用，换取不缓存会话态页面）；`next.config.ts` 设 `staleTimes.dynamic: 30`（static 保留默认），缓解 force-dynamic 页面返回导航时的重新取数闪烁。无配色/组件类/文案变更；lint 与 build 通过。

- 2026-09-14 · 路由级结构骨架屏：新增 `src/components/page-skeleton.tsx`（SkeletonLine/Panel/Chart/Row/Bar/Chip 六个零件，全部基于 `.skeleton`）；根级 `loading.tsx` 由全屏「掌灯…」灯点改为总览结构骨架，并新增 `/ledger`、`/data`、`/settings`、`/login` 四个 route 级 `loading.tsx`，布局镜像各页真实结构防跳动；骨架不放 lamp-dot / 灯线 / 可见文案 / emoji，根节点统一 `role=status aria-busy=true` + sr-only「掌灯中…」；§七加载态改写为结构骨架屏契约，`lamp-breathe` 仅保留给离线兜底页。lint 与 build 通过。

- 2026-09-14 · 记账页流水行「修改」「删除」再收紧（去掉按钮内边距留白）：两按钮 `minWidth` 由 44 改为 0、`px` 收到 0.75，不再被 44px 触控宽度把文字撑到盒子两端居中，标签间视觉距离由约 22px 收至约 14px；`minHeight: 44` 触控高度与 `-ml-2.5` 负边距不变。lint 通过。

- 2026-09-14 · 记账页流水行「修改」「删除」间距进一步收紧：负边距由 `-ml-1.5` 调至 `-ml-2.5`，两按钮视觉间距由 6px 收至 2px。lint 与 build 通过。

- 2026-09-14 · 记账页流水行「修改」「删除」按钮间距收紧：删除表单根节点加 `-ml-1.5`，两按钮视觉间距由 12px 收至 6px，其余行内间距不变；44px 触控目标不受影响。lint 与 build 通过。

- 2026-09-14 · 记账页流水行操作区调整：删除按钮移到「修改」旁边（原在金额右侧），金额单独靠右，行尾顺序变为 金额 · 修改 · 删除；左侧描述区加 `flex-1` 保持单行布局，展开的修改面板仍整行换行。lint 与 build 通过。

- 2026-09-14 · 移除 `/mui-demo` 试验页（experiment/mui-trial）：MUI 已在 `/ledger`、`/settings`、`/login` 落地，演示页完成使命删除；§十三标题与范围同步更新。lint 与 build 通过。

- 2026-09-14 · MUI 迁入设置页与登录页（experiment/mui-trial）：`/settings` 全部原生控件迁移——新建账户/分类/预算与调整余额的输入改 TextField（可见浮动标签，日期 shrink），账户类型/分类类型/支出分类改 FormControl+Select+MenuItem（分类类型默认支出，预算分类保留占位 MenuItem）；「创建/保存/调整/停用/启用/一键补齐默认分类」改 MUI Button（contained/text）；删除账户/分类/预算的 `window.confirm` 改 MUI Dialog（取消/确认删除，确认用 error contained，触发按钮改 text error 常驻烬色）；「调整余额」由 confirm() 改 Dialog 确认（列出账户名与前后金额 mono，主按钮「确认调整」灯色），目标余额改为受控输入并前置校验；「确认导入 N 笔」改为先弹 MUI Dialog（列出文件名、笔数与记账账户批次摘要，说明自动去重），点「确认导入」提交——浏览器端解析与预览表格不变；`/login` 的邮箱/密码改 TextField（type=email/password，保留 autoComplete 与 minLength），登录/注册改 contained Button，切换登录/注册改 text Button；全部 useActionState / server action / 中文文案 / `role=alert`·`aria-live` 反馈不变。行为变化：删除类二次确认由浏览器原生 confirm 弹窗改为页内 Dialog；调整余额需先在 Dialog 中确认；确认导入多一步批次摘要确认；登录密码 minLength=6 由 TextField 顶层 prop 改走 slotProps.htmlInput；账房口吻与量词「笔」保持。lint 与 build 通过。

- 2026-09-14 · MUI 迁入记账页（experiment/mui-trial）：`/ledger` 交互控件全部迁移到 MUI——新建流水与行内修改面板的日期/金额/对方/备注改 TextField（可见 label，日期 shrink），账户/转入账户/分类/渠道改 FormControl+Select+MenuItem（空值 MenuItem 保留占位文案，渠道默认值保持首项支付宝，分类仍随类型 key 重挂载），类型支出/收入/转账改 Chip（colorPrimary 选中态复刻 `.chip-active`，`role=radiogroup/radio` + 隐藏 input 提交 type），提交/保存改 Button contained，「修改」改 text Button；删除与修改的 `window.confirm` 改 MUI Dialog（确认删除用 error 色），删除按钮改 text error（常驻烬色提示危险，原为远雾字 hover 转烬）。useActionState 流程、server action、中文文案、`role=alert`/`aria-live` 反馈完全不变；行为变化：必填 select 的浏览器原生 required 拦截改为服务端中文校验（MUI Select 的隐藏原生 input 会不可见地阻断提交，故不传 required），日期/金额仍保留原生 required；表单控件由 sr-only 标签改为 MUI 可见浮动标签。lint 与 build 通过。

- 2026-09-14 · MUI 最小侵入试验（experiment/mui-trial）：新增依赖 `@mui/material` `@emotion/react` `@emotion/styled` `@mui/material-nextjs`（Next 16 用 `v16-appRouter` 通道）；新增 `src/components/mui-theme.tsx`（令牌全量映射 + `.input`/`.btn` 复刻 + ripple 禁用）与 `src/components/mui-provider.tsx`（`AppRouterCacheProvider + ThemeProvider + CssBaseline`，`CssBaseline` 输出与 `globals.css` 同值）；`layout` 用 provider 包裹 `SiteNav`/`children`（其余不动）；新增 `/mui-demo`（Button/TextField/Select/Chip/Dialog 各一，中文动词文案，金额 `.money`，计数「笔」，灯线 0 条）；新增第十二节后的第十三节「MUI 试验」约束说明。lint 与 build 通过。

- 2026-09-13 · 初版：确立「雾里点灯看账」理念、常夜模式、灯线签名、雾散转场、组件契约。
- 2026-09-13 · 契约全站落地：globals.css 建立全部令牌与组件类；layout 接入 Noto Serif SC / Noto Sans SC / Geist Mono；新增 template.tsx（雾散显影转场）与 loading.tsx（掌灯加载）；导航激活灯线；图表骨架灯下化；总览/登录/记账/账户/导入/设置六页全部按契约重写，清除 zinc 与 red/green/indigo 标准色。lint 与 build 通过。
- 2026-09-14 · 焦点与导航可达性：`.btn-ghost` / `.link-subtle` / `.chip` / `.chip-active` 补 `:focus-visible` 灯环（`0 0 0 2px rgba(227,179,65,.6)`），`.chip` 追加 `:focus-within` 环；`.input` / `.btn-primary` 的 `:focus` 改为 `:focus-visible` 与导航对齐；导航在 `/login` 隐藏，nav 容器加横滑（`overflow-x-auto + whitespace-nowrap`，链接 `min-h-[44px]`）；禁忌#8 明确为单次转场/微交互 > 500ms，环境类动画豁免但受 reduced-motion 约束；第八节追加 settings chip 与 import 虚线 input 例外说明。
- 2026-09-14 · UI/UX全面修复：总览 Hero 防溢出（40px起跳）、预算行防挤压、收支补−/+前缀、进度条与图表补ARIA、图表 reduced-motion 关闭JS动画、Tooltip金额mono；记账/账户/设置表单补label、金额统一toLocaleString与.money、空状态改邀请句式、新建统一"创建"；导入"入账账户"改"记账账户"、量词统一"笔"、登录错误中文化。lint与build通过。
- 2026-09-14 · UI/UX与移动端全面修复（二轮）：组件契约类包进 `@layer components` 恢复工具类覆盖权（settings chip text-ink 与表内紧凑 select 实际生效）；移动端 .input 字号 16px 防 iOS 聚焦缩放；导航移动端改固定底部 tab 栏（含 safe-area 内距、正文补 padding、桌面顶栏不变）；记账收入语义修正——账户字段随类型联动（收入=「收入账户（钱进哪）」，收入场景不出现「钱从哪出」，渠道为来源渠道）；「今天」本地时区计算；分类 select 切类型强制重建；所有 server action 改返回 { ok, message } 并接入 useActionState（pending/防重/role=alert/aria-live）；删除类操作（流水/账户/分类/预算）全部二次确认 + 44px 触控目标；预算月份改 type=date（归一化当月 1 号，入库 YYYY-MM-01）；viewport 补 themeColor 与 viewportFit=cover；图表刻度补 mono、hex 全部令牌化、饼图窄屏自适应；新增 error.tsx / global-error.tsx 兜底页。lint 与 build 通过。
- 2026-09-13 · 新增数据页（/data）：近 12 个月收支趋势、总资产曲线（30/90/180 天切换）、常用查询预设（chip 链接）、自定义查询表单（日期/类型/分类/账户/金额区间/关键词，走 URL searchParams）与查询结果（笔数汇总 + 支出构成饼图 + 流水列表，上限 200 笔）；导航六项加入「数据」；stats.ts 新增 filterTxs / summarizeTxs 纯函数；第六节补数据页布局说明。
- 2026-09-13 · 数据页审查修复：曲线天数 chip 改为 chip 基础类叠加 chip-active（修直角无框选中态）并统一 44px 触控目标；三个图表组件新增 label 参数（读屏描述与实际范围一致，总览页默认不变）；Bar/Line/Pie 补 animationDuration=400（守 500ms 禁忌）；天数与查询条件互保参数（切天数不清查询、点预设不重置曲线）；「上月支出」改用真实月末（date 控件不吃非法日期）；from/to 正则校验、金额下限非负、days 吸附到 30/90/180；资产曲线只计启用账户流水；5000 笔取数截断加提示；查询表单 key 随条件重挂载（修 defaultValue 陈旧）、useTransition 查询中态、分类按支出/收入 optgroup、结果区 #results 锚点与 aria-live 汇总；列表行去掉假 affordance hover；桌面 nav 补 aria-label；accountBalances 不再为停用账户流水凭空建余额（总资产口径修正）。lint 与 build 通过。
- 2026-09-14 · PWA 支持：`src/app/manifest.ts` 生成 Web App Manifest（名称「雾夜账」、standalone、portrait、夜空/灯火令牌同值的 theme 与背景色、zh-CN）；GDI+ 生成品牌图标（夜空底 + 纸墨「雾」字 + 灯线签名，含 192/512 与 maskable 安全区版本，`src/app/icon.png`、`src/app/apple-icon.png` 走 Next 图标文件约定）；`public/sw.js` Service Worker——导航请求网络优先、失败回落缓存或内联离线兜底页（第七节 2.5），`/_next/static`、`/icons` 等静态资源缓存优先，RSC 预取与 server action 不缓存；`ServiceWorkerRegister` 客户端组件在 layout 挂载后注册；metadata 补 `applicationName` 与 `appleWebApp`（iOS 添加到主屏）。离线兜底页复用「掌灯」视觉并受 reduced-motion 约束。
- 2026-09-14 · 移动端顶部导航栏：新增移动端 sticky 顶栏（词标「雾夜账」+「退出」），`pt-[env(safe-area-inset-top)]` 补刘海/挖孔安全距，内容不再与手机摄像头区重合、滚动时从 `bg-night/80 backdrop-blur` 的雾面下穿过；「退出」自底部 tab 栏上移至此，底栏回归纯导航 6 项（原 7 项在窄屏过于拥挤）；桌面顶栏不变。第六节布局概念同步补充。
- 2026-09-14 · 移动端三处修复：①「掌灯」加载态——template 变 flex 列并 `flex-1` 撑满 body 剩余高度，加载态随之真正垂直居中（去 `py-24`），灯点由 10px 增至 16px（`h-4 w-4` 覆盖）；②登录页改 `flex-1` 填充，不再 `min-h-screen` 叠加 body 底部安全垫导致整页可上下滑动；③资产曲线 XAxis 弃用固定 `interval={4}`，改 `preserveStartEnd + minTickGap=20` 并把 `MM-DD` 缩写为 `M/D`，修手机端日期刻度严重重合。lint 与 build 通过。
- 2026-09-14 · 数据准确性与导入稳健性（服务端聚合）：数据页与总览页的趋势/资产曲线/收支汇总/分类占比改由服务端 RPC（`dashboard_snapshot` / `filtered_tx_stats` / `account_balances`）聚合，不再受 PostgREST 取数上限影响；数据页查询条件下推服务端、结果改为服务端前 200 笔，移除「只统计最近 5,000 笔」的截断提示（该提示因实际上限为 1000 而从未生效）；总览/数据/设置的月份与日界统一按 Asia/Shanghai；记账页停用账户的流水不再误显示「未知账户」（改用行内连接的账户名）；导入页新增 2000 笔上限前端守卫——超限时禁用「确认导入」并以 ember 警示「单次最多导入 2000 笔，当前 N 笔，请拆分文件再导」（沿用账房口吻）；登录页注册后若需邮箱确认，改为提示「注册成功，请到邮箱确认后再登录」并停留当前页（消除看似跳转回环）。无令牌/配色/动效变更；lint 与 build 通过。
- 2026-09-14 · 导航四项化与布局锁定：导航由 6 项减为 4 项（总览/记账/数据/设置），导入与账户并入设置页，以区块锚点 #accounts / #import 呈现（桌面顶栏与移动端底栏共用 LINKS 数组，一处改动）；header/footer 布局锁定——桌面顶栏改 fixed，三栏高度与 body 补偿统一走 CSS 变量（--nav-top-h / --nav-top-h-m / --nav-bottom-h，含 safe-area 与 1px 雾线），html 加 scrollbar-gutter: stable，杜绝字体替换/滚动条出现导致的内容加载期位移。lint 与 build 通过。
- 2026-09-14 · 设置页合并账户与导入（信息架构收敛）：原独立 `/accounts`、`/import` 两页并入 `/settings`——账户区（含总资产、余额口径说明、建户表单、启用/停用/删除）置于页首锚点 `#accounts`，导入区（含分类规则 chip、批次记录）随迁；导航从六项减为四项；总览页空账户引导链接改指「设置页」；`globals.css` 新增导航栏高度锁定变量（`--nav-top-h` / `--nav-bottom-h` 含 safe-area 与雾线边框）供 layout 与 site-nav 共用，并加 `scrollbar-gutter: stable` 防长页滚动条出现/消失引发横向抖动；桌面顶栏改 fixed + 变量高度，移动端顶栏/底栏高度同源锁定。布局令牌变更，无新配色/组件类。
- 2026-09-14 · 修改流水与调整余额（均为行内编辑 + 二次确认）：记账页每笔流水新增「修改」——行内展开编辑面板（类型 chip、日期/金额/账户/转入账户或分类/渠道/对方/备注，全部预填），提交前 `window.confirm` 二次确认「确认保存这笔流水的修改？修改后相关账户余额会同步更新」，成功自动收起；导入的流水同样可改（source 不变）。设置页每个启用账户新增「调整余额」——行内展开面板展示当前余额/期初/流水净变动，输入目标余额后二次确认（含账户名与前后金额、说明将同步调整期初余额），服务端按 `期初 += 目标 − 当前` 折算。编辑面板统一 `rounded-xl border border-fogline` 内嵌样式、44px 触控目标、灯色焦点环，账房口吻文案（「修改」「调整」）。lint 与 build 通过。
- 2026-09-14 · 表单可达性与导入确认修复（无视觉变更）：记账新建/修改与设置建户/分类/预算的全部 MUI Select 补 `InputLabel id` + `Select labelId` 配对（标签文案与行为不变，读屏可见标签与控件正确关联）；导入确认 Dialog 的「确认导入」按钮加 `form="import-form"`（表单补稳定 id）——Dialog 经 Portal 渲染到 body，原 `type=submit` 因不在表单 DOM 后代内无法提交，现可正常提交。修改面板的账户 select 仍不加原生 required（沿用服务端中文校验，避免隐藏原生 input 不可见阻断提交）。lint 与 build 通过。
