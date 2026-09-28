# WP-1 · 设计契约增量（待追加到 DESIGN.md 变更记录）

> 本包只产出条目，**不直接改 DESIGN.md** —— 按派工规则，DESIGN.md 是六个包唯一有意的共享文件，
> 变更记录由各包在各自 commit 内追加，冲突按包序号串行合并（WP-1 先合）。
> 追加位置：`## 变更记录` 顶部（该节目前最新条目为 `2026-09-18`，新条目应排在其上）。
>
> 格式：`### <章节号> · <一句话概括>（ID: D-xx）`；正文为一段，说明改了什么、为什么、有什么代价。
> 若一条改动跨多章节，按最重要的那个章节归类，其余在正文里点名。

---

### 二 · 交互控件边界拆出 fogline-strong 令牌（D-27）

新增 `--color-fogline-strong: #5e6f8c`，仅供 `.input` / `.chip` 边框与 MUI `OutlinedInput`
的 `notchedOutline` 使用；`--color-fogline` 保持 `#28324a` 不变，继续供 `.panel` 等纯装饰边框。
动机：输入框/下拉框的边框是它们**唯一**的边界线索（veil 与 mist 只差 1.09:1，几乎不可辨），
原 `fogline` 对 veil 仅 1.22:1，低于 WCAG 2.2 SC 1.4.11 的 3:1；实测新值对 veil 3.05:1、
对 mist 3.49:1。代价：只提亮可交互控件的边，面板大面积边框不动，「雾」的层次得以保留。
第二节表格补一行 `--color-fogline-strong`；第七节 4 的 `prefers-contrast: more` 覆盖同步补
`--color-fogline-strong: #8b98b8`（对 veil 5.38:1 / 对 mist 6.16:1）。

### 三 · 字体字重按实际使用收敛（D-02）

`Noto Serif SC` 由 600/700/900 收敛为仅 600，`Noto Sans SC` 由 400/500/700 改为 400/500/600。
关键事实澄清（审计原描述的前提有误，此处记录实测结论）：next/font 的 `subsets` 只决定
「哪些 @font-face 加 preload」，传给 Google Fonts 的 css2 请求不含 subset 过滤，
返回的 CSS 里 CJK 区间（U+4E00…）一并被下载并自托管 —— 汉字码位本就覆盖，
「中文回落系统字体」并不成立。真正的问题是**字重**：Tailwind 的 `font-semibold` = 600，
而原声明 400/500/700 缺 600，全站 39 处 `font-semibold` 的中文正文全部由浏览器合成加粗
（fake bold）或回退到 500。补上 600 是修正，去掉 700/900 是省体积 ——
Google 对每个字重返回 101 个 CJK 分片，去掉两个未用字重即少 202 个 woff2 与约 186KB 字体 CSS。
第三节字阶表的字重列同步更新（数据字体 `Geist Mono` 保持不变）。

### 三 · global-error 补回字体变量（D-50）

`global-error.tsx` 替换根 layout 的 `<html>`，三个 next/font 的 CSS 变量随之消失，
`font-display` 落到 `var(--font-noto-serif-sc), serif` 的未定义分支 → 浏览器默认 serif
（Windows 上是宋体兜底），与全站排版不一致；`antialiased` 也一并失效。
本文件重新声明同一组 next/font 调用，字重数组与 layout.tsx 逐字相同
（next/font 按「字体 + 字重 + 子集」内容哈希去重产物，参数一致即复用同一批自托管 woff2）。
两处字重必须同步修改，已在代码注释中写明。

### 六 · 导航滚动监听按视口过滤 + 跳到主内容链接（D-26）

① `.scroll-edge` 的唯一消费者是移动端 sticky 顶栏（桌面 body 顶部已预留栏高，内容不进入栏下），
原先却在所有视口注册滚动监听，桌面端每次滚动都白跑一次 rAF + 读 `scrollY`，零收益。
现用 `useSyncExternalStore` 订阅 `(max-width: 639px)` 断点作为渲染期可见状态，
effect 以它为依赖：桌面端完全不注册监听，视口跨越断点时自动挂载/卸载。
② layout body 首位新增 skip link「跳到主内容」（WCAG 2.2 SC 2.4.1 Bypass Blocks）——
否则键盘用户每次进页面都要 Tab 过 词标 + 4 个导航项 + 退出共 6 次。
平时 `sr-only`，focus 时显形并带灯色焦点环（§十一 #9）。**前提是每个页面的 `<main>` 都有
`id="main"`** —— 该属性在各页面壳中的接线清单见 `wp1-implementation.md`，属其他包文件。

### 七 · 雾散转场只动合成层（D-22）

`@keyframes mist-in` 移除 `filter: blur(8px)`，基准路径只保留 `opacity` + `translateY`
（二者均可交给合成器）。原实现把 blur 写进同一条关键帧：blur 不可合成，每次导航都要
380ms × 全页 Paint，低端安卓上是可感知的掉帧来源。
「雾散」的模糊质感改为可选增强层：新增 `@keyframes mist-in-blur`（blur 4px），
仅在 `@media (min-resolution: 2dppx)`（Retina/2dppx+，GPU 负担得起）**且**
`prefers-reduced-motion: no-preference` 时叠加。本节 1 的代码块需同步更新为新的关键帧。

### 七 · 通配过渡移入 @layer base（D-23）

`* , ::before, ::after` 的 150ms 颜色过渡原为无层级声明。无层级规则的优先级高于一切
`@layer` 内的规则，于是任何人写 `transition-transform` 都会被这里的 `transition-property`
抢占 —— 一颗隐形的全局样式地雷。移入 `@layer base` 后工具类与组件类都能按需覆盖它，
按钮/chip/链接的 150ms 颜色过渡观感不变。

### 七 · reduced-motion 降级一步到位（D-30）

降级块由分写 `animation-duration: 0s` + `animation-iteration-count: 1` 改为 `animation: none !important`。
原写法有一个静默缺陷：`iteration-count: 1` 不会让雾静止，而是让 `alternate` 的 `fog-drift`
跳到 `to` 态后停住（雾平移 48px/32px 后定住），与本节 4「雾静止」的字面承诺不符；
`none` 同时清掉 animation-name / duration / iteration-count / fill-mode。

### 八 · 区块骨架收敛为 SectionSkeleton 组合件（D-17）

`page-skeleton.tsx` 新增 `SectionSkeleton`（区块级组合件：eyebrow 小标 + serif 标题 + 可选主体，
`title` 进 sr-only 供读屏区分「正在等哪一栏」）与 `SkeletonStatus`（`role="status" aria-busy`
+ sr-only「掌灯中…」的外壳）。`SkeletonPanel` 改为 `SectionSkeleton` 的无 title 转发，
不保留第二份实现 —— 本节抱怨的正是「同一种区块形状漂移」，两个组件各写一遍 section 头
只会让漂移换个地方复发。

### 八 · 渠道受控词汇表去重（D-29）

`CHANNELS` 原有两个语义重叠的选项（`direct: "其他方式"` 与 `other: "其他"`），
下拉里并排出现两个几乎一样的选项等于没得选，违反第十节「禁止同义漂移」。
改按「是否经由第三方支付」这一条轴线划分，两两不重叠：
`alipay 支付宝` / `wechat 微信支付` / `direct 现金`（现金、银行柜台、银行转账等不经第三方的直接支付）/
`other 其他渠道`。**`value` 保持 `direct` / `other` 不变**（数据库已有数据无需迁移），只改展示文案。

### 十一 · 禁忌清单自检结论（本包范围内）

本包 16 个文件对 §十一 十条逐条扫描：标准色 / zinc-slate-neutral 灰阶 / `dark:` 变体 /
非令牌边框 / 编号装饰 / emoji 均为 0 命中；`.money` 覆盖全部金额（金额铁律未破）；
`outline: none` 的 5 处 CSS 与若干工具类用法**每一处都配了灯色 `ring-lamp/60` 替代环**（#9）；
单次转场 380ms，`fog-drift` / `lamp-breathe` / `skeleton-pulse` 三个环境类均受
`prefers-reduced-motion` 约束静止（#8）。仓库自带的 `scripts/check-taboo-guard.mjs`
（[D-25] 建的 lint 守卫自测）实跑 12/12 通过。

---

## 属于其他包、本包未做的 DESIGN.md 变更

- **第八节 `.chip` 契约行**：`border-fogline` → `border-fogline-strong`。本包已改 CSS 实现，
  但该表格行的文案同步属文档所有权（WP-6），请 WP-6 在合并时一并更新。
- **第十三节 6（注入顺序）**：`MuiProvider` 不再无条件包裹全站，改为按 pathname 条件挂载
  （`src/components/mui-gate.tsx`）。第十三节 6 需要补一句作用域约束。
- **第十二节标题错标**：`DESIGN.md:163` 与 `globals.css` 注释都写「第十二节材料」，
  但材料那段在 §六。属 WP-6 文档所有权。
