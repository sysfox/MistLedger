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
│ 雾夜账          总览 记账 导入 账户 设置    │ ← 激活项下有灯线
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

### 2. 加载态「掌灯」

`src/app/loading.tsx`（路由级）与图表骨架：一枚**呼吸的灯点**（amber 圆点 + 呼吸辉光 keyframe `lamp-breathe`，2s ease-in-out 无限）+ 文案「掌灯…」。图表加载骨架为 `veil` 色块 + 轻微 pulse，高度与图表一致（220px），禁止布局跳动。

### 3. 微交互

- 面板/行 hover：背景 `mist → veil`，150ms。
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
- 界面词汇表（全站一致）：账户、分类、流水、期初余额、上限、入账账户、转入账户。禁止同义漂移（如"记录/条目"混用）。
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
8. ❌ 动画时长 > 500ms；reduced-motion 下仍会动的元素。
9. ❌ 焦点环被移除或换成非灯色。
10. ❌ 编号装饰（01/02/03）、emoji 图标、拟物阴影堆叠。

---

## 十二、实施与验收

- 技术栈：Next.js 16 App Router + Tailwind v4（`@theme` token）+ Recharts。改动 Next 约定前先查 `node_modules/next/dist/docs/`。
- 每次界面改动后：`npm run lint` 与 `npm run build` 必须通过。
- 验收动作：键盘 Tab 走一遍（焦点环可见）、`prefers-reduced-motion` 开启走一遍（无动画）、375px 宽度走一遍（不横向滚动）。

## 变更记录

- 2026-09-13 · 初版：确立「雾里点灯看账」理念、常夜模式、灯线签名、雾散转场、组件契约。
