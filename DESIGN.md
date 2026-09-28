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
| `--color-fogline` | `#28324A` | 雾线 | 纯装饰边框/分隔线（`.panel`、Dialog/Menu 纸面） |
| `--color-fogline-strong` | `#5E6F8C` | 界雾 | **仅交互控件边界**：`.input` / `.chip` 边框、MUI `notchedOutline`。对 veil 3.05:1 · 对 mist 3.49:1（WCAG SC 1.4.11 的 3:1）。与 `fogline` 分家是为了只提亮「看得见控件在哪」的边，不动大面积装饰边框，「雾」的层次得以保留 |
| `--color-dim` | `#8B93A7` | 远雾 | 次要文字、占位符 |

### 用色规则

1. **灯火只做点睛**：每屏常亮灯色不超过 3 处（导航激活灯线、关键数字的 ¥、主按钮）。大面积铺灯色 = 犯规。
2. 支出/收入一律用 `ember` / `jade`，禁止再引入其他红绿。
3. 边框一律 `fogline`（装饰）或 `fogline-strong`（交互控件边界），禁止纯灰 zinc/neutral。
   **需要「中性的一档」（图表第 N 槽、只读元信息）时用 `var(--color-dim)`，不写死 hex**——
   写死值不受 `prefers-contrast: more` 覆盖，等于在一处偷偷开后门（见 §九 饼图色板与 §十一 #6）。
4. 转账（中性）用 `ink`/`dim`，不染色。
5. 超支警示：`ember` + 文字「超支」，不用刺眼纯红。
6. `:root` 声明 `color-scheme: dark`；删除 prefers-color-scheme 媒体查询（常夜）。

---

## 三、字体系统

通过 `next/font/google` 加载，CSS 变量挂在 `<html>` 上：

| 角色 | 字体 | 变量 | 字重 | 用途 |
|---|---|---|---|---|
| 展示 | **Noto Serif SC** | `--font-display` | 600 | 页面标题、词标「雾夜账」、区块标题。宋体骨相 = 账簿。**克制使用**：正文和按钮不用它 |
| 正文 | **Noto Sans SC** | `--font-body` | 400 / 500 / 600 | 全部 UI 文字、表单、说明 |
| 数据 | **Geist Mono** | `--font-geist-mono` | 400 / 600 | **所有金额**。必须 `tabular-nums` |

> **字重按实际使用点声明，且必须覆盖所有被用到的字重。** Tailwind 的 `font-semibold` = 600，
> 若 `Noto Sans SC` 未声明 600，该类会退化成浏览器合成加粗（fake bold），不是设计要的真字重。
> 收敛原则是「零使用点的字重不下载」（Google 对每个 CJK 字重返回 101 个分片，去掉一个字重即少 101 个 woff2），
> 但**用到的字重一个都不能少**。`layout.tsx` 与 `global-error.tsx` 两处声明必须逐字相同
> （next/font 按「字体+字重+子集」内容哈希去重，参数不同会重新下载并自托管第二套字体）。

### 字阶

| 层级 | 规格 |
|---|---|
| 页面主标题（hero 数字除外） | serif 600 · 20–30px · `letter-spacing: -0.02em` · `line-height: 1.2` |
| Hero 大数字（总资产） | mono 600 · 40–48px · `tabular-nums` · `tracking-tight` · `leading-none` |
| 区块标题 | serif 600 · 16–17px · `letter-spacing: -0.01em` · `line-height: 1.3` |
| eyebrow 小标 | sans 500 · 11px · `letter-spacing: 0.2em` · `dim` 色 |
| 正文 | sans 400 · 14px · `ink` |
| 次要说明 | sans 400 · 12–13px · `dim` |
| 金额 | mono · 13–15px · `tabular-nums` · `letter-spacing: -0.01em` |

**字距随字号变化，不用固定值**（固定字距必然在某个字号上出错）：字号越大字越显散，故越大越负——
`h1/h2/h3` 由 `globals.css` 的 `@layer base` 统一收紧（-0.02em / -0.01em）并用 `text-wrap: balance` 均衡折行；
`.money` 基础字距 -0.01em（照顾 12–15px 小金额），hero 大数字再由页面叠加 `tracking-tight` 单独收紧。
行高同理：标题紧、正文松（正文走 Tailwind 默认 1.5）。

### 金额书写铁律

- 金额一律 `.money` 类（mono + tabular-nums）。
- 支出前缀 `−`（U+2212）、收入前缀 `+`、转账前缀 `⇄`，¥ 紧跟其后。
- 保留两位小数，`toLocaleString("zh-CN")`。

**调用点写法**（[D-08]）：金额渲染一律经 `formatSignedMoney(n, kind)` / `amountSign(n, kind)`
（`src/lib/ledger/format.ts`），**调用点不手写 `¥`**：

- 余额 / 总资产 / 上限等中性数字 → `formatSignedMoney(n)`（默认 `neutral`，正数不带 `+`）；
- 收支流水行 → `formatSignedMoney(n, "expense" | "income" | "transfer")`；
- hero 需要把 `¥` 单独染成灯色时 → `amountSign(n, kind)` + `YUAN` + `formatMoney(Math.abs(n))` 三段拼接。

**为什么符号要下沉到格式化层而不是留在调用点**：把「符号 + 币种 + 数字」拼一遍再抄一遍，
就是上一轮负数符号出错的土壤——`¥−12.50`（符号夹在 `¥` 之后、且是 ASCII hyphen）
是复制粘贴的必然产物，而不是有人写错了。`formatSignedMoney` 在 `n < 0` 时吞掉 kind 前缀
只留一个 U+2212，因此即使 RPC 意外返回负值也不会叠出 `−−¥`。可见文本与
`aria-valuetext`（预算进度条）必须复用**同一个**格式化结果：两处各写一遍，正是同一个 bug
的第二个藏身处。

**符号与 `¥` 之间的空格是 bug，不是排版。**

**计数不是金额**：笔数 / 条数 / 个数走 `.num`（仅 tabular-nums，不改字体），不套 `.money`
—— 见 §八「`.money` / `.num` / `.tag` 的语义边界」。[D-44]

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
- **总览页 hero 是这条规则的唯一例外（[D-49] 裁定）**：hero 只有 eyebrow + 灯下大数字，
  **没有** serif 标题行——线框图比通则更具体，冲突时以线框图为准。理由有二：
  ① 总览 hero 承担的是「本月账是多少」这一件事，页名「总览」对它没有信息量；其余三页
  的 serif 标题都在回答「我在哪」（记账 / 曲线与查询 / 设置），是导航锚点而非装饰。
  ② hero 上方再压一行 serif 标题会把灯下大数字挤到首屏折线以下，而大数字是本页唯一
  需要被一眼看到的东西。**唯一要求**：hero 的 eyebrow 同时是 `<h1>`（可见文本，不是
  `sr-only` + `aria-hidden` 的两份文本），四个分支（加载 / 错误 / 有数据）都有 h1，
  且加载分支的 h1 **不含月份**（该分支会进静态预渲染 HTML，取「今天」会造成
  构建日 ≠ 访问日的 hydration 不一致）。
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
- 移动端（<sm）双层导航：顶部 sticky 品牌栏（词标「雾夜账」+「退出」，`pt-[env(safe-area-inset-top)]` 撑开刘海/挖孔区，滚动时内容从雾面下穿过）+ 固定底部 tab 栏（4 项导航，safe-area 底距由 body padding 预留）。桌面仍是单层顶栏。
- **导航是浮在内容上的一层雾，不是横幅**（第十二节材料）：三栏统一 `.material-bar`（夜空 80% + `backdrop-filter: blur(20px) saturate(180%)`），深雾线硬边框换成极轻落影（`.material-bar-top` / `.material-bar-bottom`），高度变量随之去掉 `+1px`。只有移动端顶栏会真的压住内容，故仅它启用 `.scroll-edge`——`site-nav` 在 `scrollY > 4` 时置 `data-scrolled="true"`，交界处显出一段 18px 夜空→透明渐变，内容从雾中化开；回到顶部完全隐去，栏与夜空融成一片。桌面因 body 顶部预留而内容不进入栏下，不加边缘。
- `.material-bar` 与 `.scroll-edge` 一并受 `prefers-reduced-transparency: reduce` 约束：转实底、关模糊、渐变改实色，落影分隔保留。
- **确认框让背后的世界起雾后退**：MUI `Backdrop` 用夜空 70% + `blur(6px)` 把背景压暗推远，焦点交给雾面纸；`prefers-reduced-transparency: reduce` 下去模糊、压暗加到 85%。导航四项为总览/记账/数据/设置，导入与账户并入设置页，以区块锚点 #accounts / #import 呈现。
- 数据页（/data）：曲线与查询的账房档案柜。结构自上而下：近 12 个月收支趋势 → 总资产曲线（30/90/180 天 chip 切换，选中态用 `chip-active`）→ 常用查询（chip 预设链接）→ 自定义查询表单（可见小标签 + `.input`）→ 查询结果（汇总行 + 流水列表 + 支出构成饼图）。查询条件全部走 URL searchParams，可分享、可后退。

---

## 七、动效系统

动效只讲一个故事：**雾散**。内容不是"飞进来"的，是"从雾里显影"的。

### 1. 路由转场「雾散显影」

`src/app/template.tsx` 包裹 children，每次导航重新挂载并播放：

```css
@keyframes mist-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page-enter {
  animation: mist-in 380ms cubic-bezier(0.22, 0.68, 0.32, 1) both;
}
```

- 时长 380ms，宁短勿长。
- **只用合成层属性**（`opacity` / `transform`）。`filter: blur` 不可合成，一旦写进关键帧，每次导航都要 380ms × 全页重绘，低端安卓上是可感知的掉帧来源。
- 「雾散」的模糊质感是**可选增强层**，不是基准路径：另有一组 `mist-in-blur`（blur 4px，上限比原先的 8px 更收敛），仅在 `@media (min-resolution: 2dppx)`（Retina/2dppx+，GPU 负担得起）**且** `prefers-reduced-motion: no-preference` 时叠加。
- 禁止离场动画（App Router 无此必要，加了只会拖慢感）。

### 2. 路由级结构骨架屏

每个路由配 `loading.tsx`，用**结构骨架屏**镜像真实页面布局（`src/components/page-skeleton.tsx` 提供零件）：

- 骨架全部基于 `.skeleton` 类（veil 色块 + `skeleton-pulse` 2s 透明度脉动），不自定义颜色；禁用 lamp-dot 与 `.lamp-line`（灯属于内容，不属于等待）。
- 布局镜像真实页面：main 容器类与页面完全一致（如总览 `mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6`），区块顺序、双列网格、行高对齐真实内容，杜绝加载完成后的布局跳动。
- 图表占位固定 220px（与图表容器一致）；每个 loading.tsx 根节点 `role="status" aria-busy="true"` + `<span class="sr-only">掌灯中…</span>`，骨架不放可见文案、不放 emoji。
- `prefers-reduced-motion` 下骨架静止（全局降级规则覆盖 `skeleton-pulse`）。

#### 三条硬规则

1. **不设根级 `src/app/loading.tsx`。** 根级 `loading.tsx` 比任何路由级 `loading.tsx`
   **更外层**：在 App Router 里它包裹的是整个 `children`，于是它在预渲染产物中**占据
   可见槽位**，而路由自己的骨架被推进内层。实测（`.next/server/app/*.html` 的 `<main>`
   逐字节比对，删除前）：`/`、`/data`、`/settings` 三者 `<main>` 的 SHA-256 **完全相同**
   （`340ad480728c`，3893 字符），即 `/data` 与 `/settings` 的首屏显示的是**总览页**的
   骨架——`/data` 上写着「各账户余额 / 本月预算进度」，`/settings` 上同样，而这两页都
   没有这两个区块；`/data` 另带 `BAILOUT_TO_CLIENT_SIDE_RENDERING` 标记，即真实内容
   被推到客户端渲染之后才出现。删除根级文件后复测：五条路由的 `<main>` 哈希**两两不同**
   （`/data` `58d7b867fc48`、`/settings` `29be8f92ca75`、`/ledger` `de43cc4d903d`），
   且各自带上真实 h1（「总览」/「曲线与查询」/「记账」/「雾夜账」），
   `/data` / `/settings` 各自渲染自己的 `掌灯中…` 骨架。**四页形状各异，根级那份必然
   是某一页的复制品**，而复制品在别的路由上就是错的。
2. **一个区块的骨架只能有一份。** 同一路由的「静态壳 Suspense fallback」「`loading.tsx`」
   「client 组件的 loading 分支」必须渲染**同一个骨架组件**。拆成两个导出：
   `XxxShell`（含 `<main>`）与 `XxxShellBody`（不含），后者用于塞进 client 组件自己的
   `<main>` —— 嵌套 `<main>` 是非法 HTML。
3. **骨架里不得含随时间或访问者变化的值，尤其日期。** 判据：产物 HTML 全文搜
   `20\d\d-\d\d-\d\d` 应当零命中（页面本就展示静态历史数据的除外）。凡是要进
   `<a href>` 的日期必须是**访问时求值**，且求值位置不能被模块作用域污染——
   把日期做成纯函数的入参（`buildPresets(today)`），而不是在函数内部调 `new Date()`。
   前者让「构建日」这个状态在类型层面不可表达；后者只能靠注释提醒，而注释一定会被
   后来者挪动的代码绕过。**能不能写出「构建后第 2 天访问，chip 仍指向今天」这条断言，
   比代码里有没有注释更能说明问题修没修到位。**

> **为什么「更具体的线框」在这里不够**：`/data` 用 `useSearchParams()`，静态预渲染时
> Next.js 会把到最近 Suspense 边界为止的客户端子树改为客户端渲染，fallback 写 `null`
> 就会让这棵子树在产物里**完全是空的**（用户打开 `/data` 只看到导航，直到 JS 拉起）。
> 所以 fallback 必须是真实结构骨架，**且必须是这条路由自己的那一副**。

### 2.8 长列表与大数据的渲染

超过约 200 行的列表：

1. 行元素加 `content-visibility: auto` + `contain-intrinsic-size`（**必须成对**）——后者不给，
   滚动条长度会随渲染进度抖；
2. 视口外的行用**固定值**占位，不用 `<Skeleton>` —— 一旦随滚动进出视口就开始闪；
3. **大数组不通过 DOM 传递**：hidden input 的 value 每次 change 都要重算 + 重写，实测在
   移动端是明显的主线程长任务来源（导入 2000 行时，改任一行的分类会触发全量
   `JSON.stringify`）。改用 `useRef` 持有最新数组，在提交那一刻 `formData.set()` 注入；
   预览只渲染前 200 笔。

判据不是「行数」而是**「滚动时会不会重排 + 每次 change 要不要重写全量」**：一个 2000 行的
静态表格（滚动期间不重排）不需要 `content-visibility`，一个 30 行但每行都触发全量重算的
列表同样需要修。

### 2.5 离线兜底（PWA Service Worker）

断网时的页面兜底由 `public/sw.js` 内联 HTML 提供，视觉复用「掌灯」语言：夜空底色 + 呼吸灯点（受 reduced-motion 约束）+ 文案「雾太浓了，暂时连不上账房」与提示「等雾散了再试一次」。不新建路由页（登录墙内页面无法被可靠预缓存），兜底样式以行内 CSS 写死并保持与令牌一致。

### 3. 微交互

- **即时响应（pointer-down）**：所有可交互面在按下的**那一帧**给反馈，不等抬起、不等 `click`。
  `.btn-primary` / `.btn-ghost` / MUI Button·Chip 用 `:active` 位移或缩放（`transform` 不在全局过渡属性内 → 无过渡、即时）；
  `.chip` 为内联元素（位移不生效）改用底色即时变化（`.chip:active` 提亮纱底，`.chip-active:active` 加深灯底）；
  导航链接用 `active:opacity-60`。悬停态仍走 150ms 颜色过渡，按压态不走。
- 面板/行 hover：背景 `mist → veil`，150ms。行本身不可点则**不加** hover（避免假 affordance），
  反馈只给真正可点的元素（按钮在行内时由按钮自身给）。
- **「只读还是可交互」是选型的判据，不是「要不要加 hover」的细节**：按二选一，不存在第三种。
  - **可交互** → `.chip` / `.btn-*` / `.link-subtle`，给 hover + active + 焦点环；
  - **只读** → `.tag`（或等价的静态工具类），**零反馈**：没有 `:hover`、没有 `:active`、
    不进 Tab 序列。[D-07] [D-42]

  「加了 hover 却点不动」比没有反馈更糟：用户会以为漏了实现，而不是以为这里不可点。
- 焦点环：一律 `ring-lamp/60`（键盘可见焦点，灯色）。禁止 outline-none 裸奔。
- 按钮 active：`translate-y-px`。
- 金额数字不做滚动/计数动画（账要稳，不要炫）。

### 4. 降级

三个**独立**的偏好信号，组件内自带、不靠运行时开关：

- `prefers-reduced-motion: reduce`——所有 animation/transition 时长归零，雾静止，内容直接显影。实现用 `animation: none !important` 一步到位（`none` 同时清掉 name / duration / iteration-count / fill-mode）；**不要**改写成 `animation-duration: 0s` + `animation-iteration-count: 1`——后者会让 `alternate` 的 `fog-drift` 跳到 `to` 态后停住（雾平移 48px/32px 后定住），不是「雾静止」。
- `prefers-reduced-transparency: reduce`——`.material-bar` 转实底并关模糊，`.scroll-edge` 渐变改实色，MUI `Backdrop` 转更实的夜空并去模糊；落影分隔保留。
- `prefers-contrast: more`——`--color-fogline` 提亮到 `#46516e`、`--color-fogline-strong` 提亮到 `#8b98b8`、`--color-dim` 提亮到 `#b6bed1`，边框与次要文字更实（令牌覆盖写在无层级 `:root`，优先于 `@theme` 的 theme 层）。MUI 主题是 JS 常量读不到 CSS 变量，`mui-theme.tsx` 须复刻同一组覆盖值。

---

## 八、组件契约（globals.css 中定义，页面直接使用）

| 类名 | 定义 | 用途 |
|---|---|---|
| `.panel` | `bg-mist border border-fogline rounded-xl` + `box-shadow: inset 0 1px 0 rgba(233,228,216,0.03), 0 1px 2px rgba(0,0,0,0.4)` | 所有卡片容器（内边距用 Tailwind 另加） |
| `.input` | `bg-veil border border-fogline-strong rounded-md px-3 py-2 text-sm text-ink placeholder:text-dim/70 focus:ring-2 focus:ring-lamp/60 focus:border-lamp/60 outline-none` | 所有 input/select/textarea（边框用 `fogline-strong`：输入框的边框是它唯一的边界线索，须满足 SC 1.4.11） |
| `.btn-primary` | `bg-lamp text-night rounded-md px-4 py-2 text-sm font-medium hover:brightness-110 active:translate-y-px focus:ring-2 focus:ring-lamp/60` | 主操作（保存/创建/确认导入/登录） |
| `.btn-ghost` | `text-dim hover:text-ink rounded-md px-3 py-2 text-sm` | 次要操作 |
| `.link-subtle` | `text-dim underline underline-offset-4 hover:text-ink` | 行内链接 |
| `.chip` | `border border-fogline-strong bg-veil text-dim rounded-full px-3 py-1 text-sm` | 分类标签、单选组未选中态（边框用 `fogline-strong`：chip 边框是它识别「可点」的视觉线索） |
| `.chip-active` | `border-lamp/70 bg-lamp/10 text-lamp` | 单选组选中态（支出/收入/转账、数据来源） |
| `.eyebrow` | `text-[11px] tracking-[0.2em] text-dim font-medium` | 区块小标 |
| `.money` | `font-mono tabular-nums tracking-tight` | **一切金额**。mono + tabular + 紧字距 |
| `.num` | `tabular-nums`（**无** `font-family`） | **一切计数**（笔数、条数、个数）。只要数字等宽，沿用正文字族 |
| `.tag` | 与 `.chip` 同外形，**无** `:hover` / `:active` / `:focus-visible` | **只读标签**（关键词→分类规则、纯展示的元信息） |
| `.lamp-line` | 见第四节 | 签名灯线 |

> **`.money` / `.num` / `.tag` 的语义边界**（三者互不替代，改错即为契约违规）：
>
> - **`.money` 只给金额。** 金额需要 mono：它要在表格、汇总行、hero 大数字之间
>   保持同一套「账房笔笔清楚」的骨架。
> - **`.num` 只给计数**（笔数 / 条数 / 个数）。计数需要的是**数字等宽**（多行逐行
>   对齐），不是**字族等宽** —— 把中文量词「笔」和数字一起塞进 mono 是浪费，mono 的
>   价值在对齐数字，不在渲染汉字。计数同时应带千分位（`toLocaleString("zh-CN")`）：
>   `1200` 读作「一千二」远慢于「1,200」，而计数是要被快速扫读的。[D-44]
> - **`.tag` 只给不可点的标签。** `.chip` 在本项目语义里 =「可点的选择器/标签」，
>   它的 `:hover` 转纸墨是一次明确的 affordance 承诺；给只读元素套 `.chip` 就是假
>   affordance —— 它亮一下却点不动，用户只会以为漏了实现。`.tag` 外形同 `.chip`，
>   但**零反馈**：没有 hover / active / 焦点环，也不在 Tab 序列里。[D-42]
>
> 判定依据是**元素本身是否可交互**，而不是「它在一个看起来像列表/像标签的容器里」。

**CSS 优先级纪律**：组件类只定义自身属性，页面用 Tailwind 工具类补充间距/字号；禁止在页面里用元素选择器覆盖组件类。

**已批准的例外**（仅以下三处，其余一律按契约执行）：

- 设置页分类列表 `chip + text-ink`：已创建的分类是用户资产的一部分，用 `text-ink` 提高可读，对比度优先于“未选中态用 dim”的默认规则。
- 设置页导入区块文件选择 `input + border-dashed`：文件拖放/点选区用虚线雾线边框以表达“可投放”，hover 时 `border-lamp/60`；焦点环仍为灯色不变。
- 设置页导入预览表格 `bg-gradient-to-l` 横滑遮罩（[D-11 审计禁忌 #4]，此前未登记）：表格右侧的渐变遮罩是**「右边还有内容、可以横滑」的方向提示层**，不是渐变按钮也不是渐变进度条（§十一 #4 禁的是后两者），故不违规。它是 `pointer-events-none` + `aria-hidden` 的纯装饰，`md` 以上不渲染。**边界**：此例外只授权「单向指示还有更多内容」的遮罩渐变；不得用于任何可点元素本身、不得改为双向、不得承载文案。

**「已批准的例外」清单本身的纪律**：新增例外必须写明**为什么它是必要的**、**边界在哪**、以及**为什么它不违反被引的那条禁忌**。只写「已批准」而不写边界的例外，等于把禁忌开了一个没有形状的口子——下一个人会照着它做第二件事。

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
| 饼图色板（按序循环） | `#E3B341` `#6FBF8F` `#E2574C` `#7EA2D6` `#B48BE0` `#5CC8C0` `#D98A4B` `var(--color-dim)` |

图表容器高度 220px；加载骨架见第七节。

> **第 8 槽由 `#94A3B8` 改为 `var(--color-dim)`（`#8B93A7`）**——原值是 Tailwind
> `slate-400` 的字面值，与 §十一 #6「禁 zinc/neutral/slate 灰阶」**字面自相矛盾**：
> 一份契约不能一边禁灰阶、一边在自己的色板里写死一个灰阶色值。改用既有令牌而非换
> 一个「新灰」，因为令牌同时带来两件白名单做不到的事：① 它受 `prefers-contrast:
> more` 覆盖（`#b6bed1`，对 mist 9.54:1），写死的 hex 不受；② 它是契约的一部分，
> 换主题时跟着走。对比度实测 `#8B93A7` 对 mist 5.78:1 · 对 night 6.29:1 · 对 veil
> 5.05:1，均高于图形对象 3:1 的下限（原 `#94A3B8` 为 6.93 / 7.54 / 6.20:1 —— 唯一
> 的变化是比值略降，离下限仍有一倍以上余量）。与相邻槽的色相距离：距 #7 `#D98A4B`
> RGB 距离 121、距 #1 `#E3B341` 138、距 #5 `#B48BE0` 71，均**大于**原 `#94A3B8` 的
> 对应值（25 / 31 / 42），相邻切片更易分辨而非更难。

---

## 十、文案语调

记账工具的文案 = 账房先生的口吻：**平实、动词开头、不寒暄、不卖弄**。

- 按钮 = 动作本身：「保存」「创建」「确认导入 128 笔」，禁止「提交」「确定」。
- 动作前后同名：点「导入」→ 结果提示「导入完成：新增 128 笔」。
- 错误文案说清**发生了什么 + 怎么办**，不道歉不模糊：「有 3 笔转账没选转入账户，请先补齐」。
- **错误粒度 = 请求粒度，不是区块粒度。** 一次请求失败就是**一张**错误面板，不是一栏一张：
  N 个一模一样的「这一栏暂时加载失败」既让用户判断不出是网络、鉴权还是服务端，也把同一个
  `role="alert"` 播报 N 遍。`SectionError` 的 `label` 必传（否则读屏用户听到的还是
  「某处失败了」），`onRetry` 有值才渲染按钮——没有可执行补救动作时，按钮是装饰不是控件。
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
6. ❌ zinc/neutral/slate 灰阶——用 night/mist/veil/fogline/dim。**这条对色值同样生效，不只对类名**：写死一个 Tailwind 灰阶的字面值（如 `slate-400` = `#94A3B8`）与写一个 `slate-400` 类名是同一件事，只是绕过了 eslint 守卫的字符串匹配。需要「中性的一档」时用 `var(--color-dim)`（#8B93A7），它受 `prefers-contrast: more` 覆盖，且本身就是 §二 的既有令牌。
7. ❌ 非 mono 字体的金额。
8. ❌ 单次转场/微交互动画 > 500ms；reduced-motion 下仍会动的元素。`fog-drift` / `lamp-breathe` / `skeleton-pulse` 为持续环境类豁免（不计入 500ms 上限），但必须受 `prefers-reduced-motion` 约束静止。
9. ❌ 焦点环被移除或换成非灯色。
10. ❌ 编号装饰（01/02/03）、emoji 图标、拟物阴影堆叠。

---

## 十二、实施与验收

- 技术栈：Next.js 16 App Router + Tailwind v4（`@theme` token）+ Recharts。改动 Next 约定前先查 `node_modules/next/dist/docs/`。
- 每次界面改动后：`npm run lint` 与 `npm run build` 必须通过。
- 验收动作：键盘 Tab 走一遍（焦点环可见）、`prefers-reduced-motion` 开启走一遍（无动画）、375px 宽度走一遍（不横向滚动）。
- **每页 `<main>` 必须有 `id="main"`**，否则根 layout 的 skip link 静默失效——不报错、不可见，只是跳不过去。慢网络下用户面对的是骨架屏，故 `loading.tsx` / 静态壳里的 `<main>` 也要有。
- **锚点滚动偏移只在 `globals.css` 定义一次**（`:root { --nav-scroll-offset }` + `:target, section[id] { scroll-margin-top }`）。页面组件不得自写 `scroll-mt-*`：自写值既覆盖了变量（改了 `:root` 也不生效，配置成了谎言），数值本身也容易错（80px 不足以避开 iPhone 上约 99px 的顶栏）。
- **构建产物抽查**（`next build` 后读 `.next/server/app/*.html`）：① 各路由 `<main>` 的内容互不相同（根级 `loading.tsx` 串味的判据，见 §七.2）；② 静态壳里搜 `20\d\d-\d\d-\d\d` 零命中（日期烤进产物 = 构建日泄漏）。

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
   **作用域约束**：provider 由 `src/components/mui-gate.tsx` 按 pathname **条件挂载**，
   只在 `/ledger` `/settings` `/login` 渲染；`/` 与 `/data` 直接透传 children，
   emotion 与整份主题不进入这两条路由的 client chunk（构建产物实测：`/` 与 `/data`
   引用其 13 个 chunk 中含 0 个 MUI/emotion chunk，而三个 MUI 路由各含 3–4 个）。
   不建 `(ledger)/(settings)/(login)` route group 的理由：建 group 要整体移动三个目录，
   会改变其它修复包的文件所有权。`pathname === null`（客户端尚未就绪的极短暂窗口）
   时按「需要 MUI」渲染——宁可多发一次 provider，也绝不让 MUI 三路由首帧丢样式，
   因为样式丢失是**可见回归**，而 `/` `/data` 多一层 provider 只是无用 DOM。
7. 依赖仅 `@mui/material` `@emotion/react` `@emotion/styled` `@mui/material-nextjs`
  （不装 `x-date-pickers`，保持最小）。
8. **嵌在紧凑容器（`.chip`、表格行）内的 MUI Button，44px 触控目标一律配 `margin:` 负值**
   收回视觉撑开——触控目标与视觉尺寸**可以不一致**：前者管可达性（WCAG SC 2.5.5），
   后者管密度。把 chip 内的 32px 按钮提到 44px 而不收负边距，chip 会被视觉撑高一行。
9. `/settings` 的导入预览表格内紧凑 `select`、来源单选 chip、文件拖放虚线 `label`
   仍按第八节契约类实现（预览区逐行控件保持原生以维持 44px 触控与紧凑密度），
   仅区块级触发按钮（确认导入）与各二次确认迁移到 MUI Dialog/Button。

## 变更记录

- 2026-09-28 · WP-2 总览页（金额符号下沉 / 错误态收敛 / h1 统一）：**① 金额符号下沉（D-08）**——hero 总资产、账户余额、本月收支、预算进度（含 `aria-valuetext`）四处迁到 `formatSignedMoney`；hero 的 `¥` 需单独染灯色，用 `amountSign()` + `YUAN` + `formatMoney(Math.abs())` 三段拼接。可见文本与 `aria-valuetext` 复用同一格式化结果——两处各写一遍正是上一轮负数符号出错的土壤。hero 负号用 `dim`（灯色只留给 `¥`）。**② h1 统一（D-49，裁定见上条契约收口）**——原 `sr-only` h1 + `aria-hidden` eyebrow 是读屏与视觉两套文本，改为单一可见 `<h1 class="eyebrow">`；加载分支用 `sr-only` 且**不带月份**（该分支会进静态预渲染 HTML，取「今天」会造成构建日 ≠ 访问日的 hydration 不一致）。**③ 不可点的行不加 hover（D-07）**——账户余额行删除 `hover:bg-veil` 与冗余 `transition-colors`。**④ 错误态收敛为整页面板（D-06）**——一次 `/api/overview` 失败渲染 6 个一模一样的分区错误面板（用户分不出网络/鉴权/服务端，且整个错误态没有 h1），现为 1 个整页面板 + 接 `useApiData` 的 `reload` 的「重试」；`.btn-ghost` 是重试按钮的合适载体（灯色焦点环、44px 触控），无需新增类。**⑤ `<main id="main">`（D-26）**——总览的 `<main>` 写在 client 组件里，skip link 此前在总览页落空。lint、tsc 通过；禁忌清单自检 0 命中。

- 2026-09-28 · WP-3 数据页（静态壳有内容 / 骨架同源 / 计数排版 / 参数校验两端共用）：**① 静态壳必须有内容（D-05）**——`/data` 的 `<Suspense fallback={null}>` 改为 `fallback={<DataShell />}`：`useSearchParams` 让静态预渲染时该子树整体转为客户端渲染，fallback 为 `null` 时产物 HTML 里这棵子树**完全是空的**，用户打开 `/data` 只看到导航。`data-shell.tsx` 一份，`page.tsx` fallback / `loading.tsx` / `data-client.tsx` 三处引用（拆 `DataShell` 含 `<main>` 与 `DataShellBody` 不含两个导出，避免嵌套 `<main>`）。**② 日期来自访问日（D-05）**——预设 chips 的日期改为纯函数入参 `buildPresets(today)` 而非函数内 `new Date()`，让「构建日」在类型层面不可表达；判据是产物 HTML 搜 `20\d\d-\d\d-\d\d` 零命中。日期算术改用 UTC 字段（`Date.UTC` / `getUTC*`），月末用 `new Date(Date.UTC(y, m, 0)).getUTCDate()` 而不手写分支。**③ 播报契约（D-17 / D-06）**——骨架统一走 `SkeletonStatus`（`role=status` + `aria-busy` + sr-only「掌灯中…」+ 区块名），错误走 `SectionError({onRetry, label})`；`/data` 只有一次请求，故四个区块的 loading/error 是同一个布尔值渲染四遍，按请求粒度收敛为一张面板。**④ 计数不是金额（D-44）**——笔数改用 `tabular-nums`（语义正确，即刻可用；`globals.css` 非本包所有权，`.num` 落地后换类，见上条契约收口）。**⑤ 锚点偏移单一来源（D-43）**——删掉数据页自写的 `scroll-mt-20`（80px 不足以避开 iPhone 上约 99px 的顶栏）；⚠️ **待接线**：`settings-client.tsx:92`（`#accounts`）与 `:414`（`#import`）仍有两处 `scroll-mt-20`，它们覆盖了 `:root` 的 `--nav-scroll-offset`，改了变量也不生效（配置成了谎言），需一并删除。**⑥ 参数校验两端共用（D-11 / D-35）**——`query-params.ts` 纯函数被 `api/data/route.ts` 与 `data-client.tsx` 同时 import；校验失败即丢弃条件而非报错（用户改错地址栏不该被拒绝服务），参数序列化顺序固定。进 `.or()` / LIKE 的值两层转义且顺序固定（先 `escapeLikePattern` 转 `\ % _`，再 `escapeOrValue` 给 `.or()` 参数加引号）——`?acc=1,or(id.not.is.null)` 与 `?q=%` 是真实的注入面，UUID 校验不是洁癖。

- 2026-09-28 · WP-4 记账页（确认组件收敛 / 单选组键盘契约 / 日期口径）：**① `<ConfirmSubmitButton>`（D-04）**——六份逐字复制的「拦截 submit → 弹 Dialog → `requestSubmit()` → `armedRef` 复位」（约 300 行）收敛为一处；P1 bug 正是在这种复制里被复制了六次。三个不显然点：派生状态而非命令式旗标（「这一跳是不是用户点了确认」是事件的客观属性，组件无中间状态可错位，且不存在绕过确认的提交路径——回车隐式提交的 `submitter` 是 `null`，照样被拦）；触发按钮改 `type="button"` 后自行 `reportValidity()`，把校验时机补回与改造前逐字一致；确认按钮用 `form={formId}` 原生关联而非 `requestSubmit()` 命令式旁路（Dialog 经 Portal 渲染到 body，不在表单 DOM 后代内）。props 只暴露「决策」不暴露「机制」；`confirmColor?: "primary" | "error"` 让「可逆操作不能选 error」从口头规范变成编译期约束。**② `<TypePicker>`**——旧实现宣告 `role="radiogroup"` 却只实现语义未实现键盘契约（三个 chip 各自 `tabIndex=0`、方向键全无响应），选**补齐 APG 契约**而非撤掉语义（radiogroup 正是表达单选的语义，降级会丢失「三选一」）。roving tabindex + 方向键移动并选中（APG 对单选组的规定）+ Home/End；焦点环未触碰任何 outline 样式，`:focus-visible` 对程序化 `.focus()` 同样命中，故方向键移动焦点时灯环照常出现。视觉零变化。**③ `<main id="main">`**——`/ledger` 的 client 组件与 `loading.tsx` 两处补齐（骨架屏先于数据到达被看到）。**④ 空态文案指向存在的门（D-21）**——原文案「先去「账户」页建一个账户」指向已并入设置页的 `/accounts`（一个通向 404 的邀请不是邀请），改为可点的 `/settings#accounts`。**⑤ 日期（D-45）**——`useEffect` 里写 `el.defaultValue` 改为 `defaultValue` + `suppressHydrationWarning`（DOM 归 React）；时区由浏览器本地归全站 `shanghaiDate()`（Asia/Shanghai，访问日求值而非模块级常量，否则静态预渲染会冻成构建日）——日期是账本主键，跨端不一致等于记错账。**⑥ 渠道默认值（D-46）**——默认「支付宝」等于系统替用户断言这笔钱走支付宝，污染统计口径；改为 `direct`（现金/线下，四种渠道里最中性的一种），与 `actions.ts` 的服务端兜底三处统一。**⑦ 类型逃逸（D-15）**——`as unknown as` 从类型上讲本就不必要（`Array.isArray` 的真分支已收窄），收进 `relationName()` 后三种嵌入关系在一处判别，断言归零且未引入 `any` / `@ts-ignore`。

- 2026-09-28 · WP-5 设置页与导入（只读标签 / 长列表渲染 / 触控目标与视觉密度解耦）：**① 只读标签（D-42）**——设置页「归类规则（关键词 → 分类）」是只读展示却套了 `.chip`（其 `:hover` 转纸墨是明确的假 affordance），先以等价静态工具类顶替，`.tag` 落地后换类（见上条契约收口）。**② 计数排版（D-44）**——三处笔数先与数据页对齐视觉（`.money` + 千分位），`.num` 落地后换类。**③ 金额调用点迁移（D-08）**——`settings-client.tsx` ×4 · `adjust-balance-button.tsx` ×5 · `import-client.tsx` ×1 迁到 `formatSignedMoney`。**④ 长列表渲染（D-24）**——2000 行的导入预览此前每次改任一行分类都全量 `JSON.stringify` 并写进 hidden input（移动端明显的主线程长任务来源）：预览行加 `content-visibility: auto` + `contain-intrinsic-size`（成对，否则滚动条抖），全量数据改由 `useRef` 持有、提交那一刻 `formData.set()` 注入，预览只渲染前 200 笔。**⑤ 触控目标与视觉尺寸解耦（D-41）**——`delete-category-button` 的 32px 提到 44px 后 chip 内的 `×` 会视觉撑高 chip，用 `margin: "-6px -14px"` 负边距把多出的 12px 收回来，触控高度与 chip 视觉高度与改前完全一致。**⑥ 登录页播报强度（D-20）**——「注册成功」此前走 error state（ember + `role=alert` assertive），但 ember 在本项目只表示支出与危险；拆为 notice（jade + `role=status` polite）与 error（ember + `role=alert`）两个独立 state，让颜色与播报强度跟着语义走。**⑦ 补登 §八 例外**——导入表格 `bg-gradient-to-l` 横滑遮罩（见上条契约收口）。

- 2026-09-28 · 契约收口（横跨 WP-2/3/4/5 的文档合并 + 四项裁定）：**① 删除根级 `src/app/loading.tsx`（§七.2 硬规则 1）**——实测 `.next/server/app/*.html` 的 `<main>` 逐字节比对，删除前 `/`、`/data`、`/settings` 三者 SHA-256 **完全相同**（`340ad480728c`）：根级 `loading.tsx` 比路由级更外层，在预渲染产物里占据可见槽位，于是 `/data` 与 `/settings` 的首屏显示的是**总览页**的骨架（两页都写着「各账户余额 / 本月预算进度」，而它们没有这两个区块），`/data` 另带 `BAILOUT_TO_CLIENT_SIDE_RENDERING` 标记。删除后复测：五条路由 `<main>` 哈希**两两不同**，各自带真实 h1（「总览」/「曲线与查询」/「记账」/「雾夜账」），四页仍全为静态 `○`。WP-1 审核通过的是「根级骨架镜像总览」这个局部判断，遗漏的是它对**其它路由**的溢出——四页形状各异，根级那份必然是某一页的复制品，而复制品在别的路由上就是错的。**② §九 饼图色板第 8 槽 `#94A3B8` → `var(--color-dim)`（PM 标记的「契约内部矛盾」裁定）**——`#94A3B8` 是 Tailwind `slate-400` 的字面值，与 §十一 #6「禁 slate 灰阶」字面冲突。裁定**改色板、不加例外**：一份契约不能一边禁灰阶一边在自己的色板里写死灰阶色值；受控例外会把一条可机器执行的禁忌变成一句需要人来判断的散文。选 `var(--color-dim)` 而非另找一个「新灰」，因为令牌额外带来两件事——受 `prefers-contrast: more` 覆盖（`#b6bed1`，对 mist 9.54:1，写死 hex 不受）、且随主题走。对比度实测对 mist 5.78:1 / night 6.29:1 / veil 5.05:1（图形对象下限 3:1，原值 6.93/7.54/6.20），且与相邻槽的 RGB 距离（121 / 138 / 71）**大于**原值（25 / 31 / 42），相邻切片更易分辨。§十一 #6 同步补「这条对色值同样生效，不只对类名」——写死 `slate-400` 的字面值与写 `slate-400` 类名是同一件事，只是绕过了 eslint 守卫的字符串匹配。**③ [D-49] 裁定：总览 hero 沿用线框图，不加 serif 标题（§六）**——线框图比「区块头部统一 eyebrow + serif 标题」更具体，冲突时以线框图为准。理由：总览 hero 回答的是「本月账是多少」，页名「总览」对它没有信息量（其余三页的 serif 标题是导航锚点，回答「我在哪」）；且 hero 上方再压一行会把灯下大数字挤到首屏折线以下。保留的唯一硬要求是 eyebrow 同时作 `<h1>`（不是 `sr-only` + `aria-hidden` 两份文本）、四分支都有 h1、加载分支不含月份（避免构建日 ≠ 访问日）。WP-2 按线框图执行是**正确**的，此处把隐含判断写成明文。**④ 新增 `.num` 与 `.tag` 两个组件类（§八）**——`.num` = `tabular-nums` 但不改字体（计数要的是数字等宽，不是字族等宽：把中文量词「笔」和数字一起塞进 mono 是浪费），`.tag` = `.chip` 的静态版且零反馈（只读元素套 `.chip` 是假 affordance）。**⑤ 补登 §八 第三条已批准例外**——设置页导入表格的 `bg-gradient-to-l` 横滑遮罩此前未登记（[D-11 审计禁忌 #4] 标记至今）。它是 `pointer-events-none` + `aria-hidden` 的方向提示层，不是渐变按钮也不是渐变进度条；例外写明了边界（不得用于可点元素、不得改双向、不得承载文案），并给「例外清单」本身加了纪律：新增例外必须写明为什么必要 / 边界在哪 / 为什么不违反被引的那条禁忌。**⑥ WP-2/3/4/5 正文同步**：§三 金额铁律补调用约定（不手写 `¥`、符号下沉到 `formatSignedMoney`、可见文本与 `aria-valuetext` 复用同一结果）与「计数不是金额」；§七.3 把「不可点的行不加 hover」从「不要做」升级为「怎么做」（可交互 → `.chip`/`.btn-*`/`.link-subtle`；只读 → `.tag`，二选一）；§七 新增 2.8「长列表与大数据的渲染」；§十 补「错误粒度 = 请求粒度」与 `label` 必传；§十二 补「每页 `<main>` 必须有 `id="main"`」「锚点偏移单一来源」「构建产物抽查」；§十三 补「紧凑容器内 MUI Button 的 44px 触控目标配负边距」。§七.2 重写为三条硬规则（不设根级 loading / 一个区块的骨架只能有一份 / 骨架里不得含随访问变化的值），并附上产物哈希作为可复现的判据。**未在本包落地、留给接线方的**（见 `.hermes/audits/integration-report.md` 待接线清单）：`.num` / `.tag` 的调用点（`data-client.tsx` / `settings-client.tsx` / `import-client.tsx` 属并行审核中的包）、`dashboard-charts.tsx` 色板第 8 槽的代码值。本包未新增任何令牌值、未新增动效、灯线白名单未越位；`tsc --noEmit` 0 错、`eslint` 0 error 0 warning、`next build` 通过且四页仍全为静态 `○`、`contrast-check` 11/11、`format-check` 13/13 全绿。

- 2026-09-28 · WP-1 design-system（契约地基：可访问性边界、安全响应头、只动合成层的转场、金额铁律符号下沉）：**① 交互控件边界拆出 `--color-fogline-strong`（D-27）**——`.input` / `.chip` 边框与 MUI `notchedOutline` 改用它（`#5E6F8C`，对 veil 3.05:1 · 对 mist 3.49:1，达 SC 1.4.11 的 3:1），`--color-fogline` 保持 `#28324A` 继续供 `.panel` 等纯装饰边框：只提亮「看得见控件在哪」的边，大面积表面不动，「雾」的层次得以保留。**② 字体字重按实际使用收敛（D-02）**——`Noto Serif SC` 600/700/900 → 仅 600，`Noto Sans SC` 400/500/700 → 400/500/600。关键事实澄清：next/font 的 `subsets` 只决定哪些 `@font-face` 加 preload，css2 请求本身不含 subset 过滤，汉字分片（U+4E00…）本就下载并自托管（构建产物实测 304 条 `@font-face`），「中文回落系统字体」不成立；真正的问题是**字重**——`font-semibold` = 600 而原声明缺 600，全站该类中文正文在 fake bold。`global-error.tsx` 重声明同一组字重（与 `layout.tsx` 逐字相同，next/font 按内容哈希去重，参数不同会重新自托管第二套字体；产物实测两处引用同一批 101 个 woff2）修 [D-50] 的字体变量丢失。**③ 四个安全响应头 + `/api/*` noindex（D-13）**——`next.config.ts` 加 `async headers()`：`X-Frame-Options: DENY` · `Referrer-Policy: strict-origin-when-cross-origin` · `X-Content-Type-Options: nosniff` · `Permissions-Policy: geolocation=(), camera=(), microphone=()`，全站 `/:path*`（实测覆盖根路径）+ `/api/:path*` 叠加 `X-Robots-Tag: noindex`（实测 9 条路由全部返回四个头，页面路由不误带 noindex）。**有意不引入 CSP**：MUI emotion 运行时注入 `<style>`，一条 `style-src` 配错即全站白屏，收益远小于风险；`X-Frame-Options: DENY` 作为点击劫持兜底。**④ 雾散转场只动合成层（D-22）**——`mist-in` 移除 `filter: blur(8px)`，基准路径只留 `opacity` + `translateY`；模糊质感改为可选增强层 `mist-in-blur`（4px），仅在 `min-resolution: 2dppx` 且 `prefers-reduced-motion: no-preference` 时叠加。**⑤ 通配过渡移入 `@layer base`（D-23）**——`*, ::before, ::after` 的 150ms 颜色过渡原为无层级声明，优先级高于一切 `@layer` 内规则，任何人写 `transition-transform` 都会被抢占；移入 base 层后工具类与组件类可按需覆盖。**⑥ reduced-motion 改 `animation: none !important`（D-30）**——原写法 `iteration-count: 1` 不是让雾静止，而是让 `alternate` 的 `fog-drift` 跳到 `to` 态后停住（平移 48px/32px 后定住）。**⑦ 跳到主内容 skip link + 导航滚动监听按视口过滤（D-26）**——`layout.tsx` body 首位加 skip link（WCAG SC 2.4.1），平时 `sr-only`，focus 时显形并带灯环（§十一 #9）；`.scroll-edge` 的唯一消费者是移动端 sticky 顶栏，故滚动监听改用 `useSyncExternalStore` 订阅 `(max-width: 639px)` 断点作为渲染期可见状态，桌面端完全不注册监听、视口跨断点时自动挂载/卸载（`getServerSnapshot` 返回 `false` 保证 hydration 首帧一致）。**⑧ MUI 只在用它的路由发货（D-10）**——新增 `mui-gate.tsx` 按 pathname 条件挂载 provider，产物实测 `/` 与 `/data` 的 13 个 client chunk 中含 0 个 MUI/emotion chunk，三个 MUI 路由各含 3–4 个且首帧已带 emotion 样式（无 FOUC）。**⑨ 金额符号下沉（D-08）**——`format.ts` 新增 `formatSignedMoney(n, kind)` 与 `amountSign(n, kind)`：符号逻辑下沉，负数一律 U+2212 前置且**吞掉 kind 前缀**（不出 `−−¥`），`¥` 紧跟其后；调用点不再手写 `¥{formatMoney(v)}`。**⑩ 分区错误面板可重试（D-06）**——`section-error.tsx` 重写：删 `catchSection`/`SECTION_FAILED` 死代码、加 `role="alert"`（SC 4.1.3）、加可选 `onRetry`（有值才渲染按钮——没有可执行补救动作时按钮是装饰不是控件）与 `label`（区分是哪一栏坏了），文案说清「发生了什么 + 怎么办」。**⑪ 区块骨架收敛为组合件（D-17）**——`page-skeleton.tsx` 新增 `SectionSkeleton`（区块头组合件，`title` 进 sr-only 供读屏区分正在等哪一栏）与 `SkeletonStatus`（`role="status" aria-busy` + sr-only「掌灯中…」外壳），`SkeletonPanel` 改为转发不保留第二份实现。**⑫ 渠道词汇表去重（D-29）**——`CHANNELS` 原有两个语义重叠项（`direct: 其他方式` 与 `other: 其他`）按「是否经由第三方支付」重新划分为 `alipay 支付宝` / `wechat 微信支付` / `direct 现金` / `other 其他渠道`，**`value` 不变**（数据库无需迁移），只改展示文案。**⑬ 其余**——锚点滚动偏移统一为 `--nav-scroll-offset`（`:target` + `section[id]` 单一入口，删掉 `.input` 上无意义的 `scroll-margin: 96px`，D-43）；`manifest` `orientation` 由 `portrait` 改 `any`（D-40）；`layout.tsx` 补 `metadataBase` + `openGraph` 与 `<noscript>` 中文兜底（四页都是 client-fetch 壳，禁用 JS 时原本是四个空白页）；删除 `formatBudget` 死代码（D-25）。第二、三、七、八、十三节表格与正文已按上述变更同步。无令牌基准值删除、无新配色、无渐变按钮、灯线白名单未越位。lint、tsc、`npm test`(57)、`test:taboo-guard`(12)、`test:api-cache`(15)、`contrast-check`(11)、`format-check`(13) 全绿；`next build` 通过且四页路由仍全为静态 `○`；`next start` 后 `curl -I` 实测四个安全头。审核报告见 `.hermes/audits/reviewer-wp1.md`。

- 2026-09-18 · 首屏静态壳 + API 取数（性能架构）：四页（总览/记账/数据/设置）由「服务端 Suspense 流式」改为「静态预渲染骨架壳 + 前端从 `/api/*` Route Handler 取数渲染」——构建期产出静态骨架 HTML（build 路由表四页全 ○），首字节不再被 proxy 的 Supabase getUser 往返（实测 auth RTT ≈ 209ms avg / 518ms p95）与页内 `getClaims` 门禁串行阻塞；数据由 client 组件经 `useApiData`（`useSyncExternalStore` 外部 store，同源 cookie 会话，401 由客户端跳 `/login`）取数填充，骨架兜底与分区错误面板与原流式版完全一致（视觉零变化）。`proxy.ts` 门禁收窄到仅 `/login`（登录用户弹回）；`/api/*`（overview/ledger/data/settings）为新的鉴权边界（`requireApiSession` + getClaims + RLS，令牌刷新经 `sessionResponse` 回写）；增删改成功经 `notifyDataChanged()` 触发静默重取（不闪骨架）。文案、配色、动效、aria 均无变化。lint 与 build 通过；基准见 `scripts/bench.mjs`。
- 2026-09-15 · 偏好降级补全（透明/对比）：第七节 4 降级由「仅 reduced-motion」扩为三个独立信号。MUI `Backdrop` 由纯夜空 70% 改为夜空 70% + `blur(6px)`——确认框背后的世界「起雾」后退，焦点交给雾面纸（原有 `prefers-reduced-transparency` 降级：去模糊、压暗加至 85%）。新增 `@media (prefers-contrast: more)`：`--color-fogline` 提亮到 `#46516e`、`--color-dim` 提亮到 `#b6bed1`，边框与次要文字更实；令牌覆盖写在无层级 `:root`（已核验排在 `@layer theme` 之后，优先生效）。§六补确认框起雾说明。无令牌基准值变更（仅偏好覆盖）。lint 与 build 通过。
- 2026-09-15 · 字号相关字距与行高（排版）：标题不再是无字距/无行高的裸字号。`globals.css` 新增 `@layer base`：`h1` `letter-spacing: -0.02em` + `line-height: 1.2`，`h2/h3` `-0.01em` + `1.3`，并统一 `text-wrap: balance`（折行更均衡，避免孤字）。`.money` 基础字距由 `-0.025em` 放宽到 `-0.01em`——原先一刀切在 12–15px 的小金额上过紧；hero 大数字本就叠加 `tracking-tight`，仍保持收紧，从而「字距随字号变化」。MUI `MuiTypography` 类选择器优先级高于元素选择器，Dialog 标题不受影响。第三节字阶表补字距/行高并列明规则；无令牌/配色/组件类变更。lint 与 build 通过。
- 2026-09-15 · 导航转为浮动雾面材料 + 滚动边缘（材料与深度）：三栏去掉 `border-b/t border-fogline` 硬边框，改 `.material-bar`（夜空 80% + `blur(20px) saturate(180%)`）与极轻落影（`.material-bar-top`/`.material-bar-bottom`）——内容在栏下化开而非被一条线切断；`.panel`/`.input`/`.chip` 的雾线边框与桌面内容预留不变（内容本就不进入桌面栏下，硬线在主栏下毫无信息量）。新增 `.scroll-edge`（`::after` 18px 夜空→透明渐变，200ms 淡入）只给移动端 sticky 顶栏：`site-nav` 用 rAF 节流滚动监听、仅在跨过 `scrollY > 4` 阈值时 `setState`，`data-scrolled` 驱动显隐——内容真正经过栏下才出现边缘，回到顶部即隐去。高度变量 `--nav-top-h`/`--nav-top-h-m`/`--nav-bottom-h` 去掉 `+1px`（不再有边框），预留学 = 栏高仍严格相等。新增 `prefers-reduced-transparency: reduce` 降级：`.material-bar` 实底、关模糊，`.scroll-edge` 渐变改实色，落影保留。§六补材料说明；无令牌/配色/文案变更。lint 与 build 通过。
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
