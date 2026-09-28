# WP-3 设计片段 —— `/data` 静态壳、播报与排版

供 DESIGN.md 吸收的条目。现有条目号沿用 DESIGN.md 原文编号，括号内是本次落点。

---

## 一、静态壳必须有内容（[D-05]）

### 现状

`/data` 用了 `useSearchParams()`。Next.js 在静态预渲染时会把**到最近 Suspense 边界为止**的客户端子树改为客户端渲染 —— 边界以内的内容不进产物 HTML。fallback 写 `null`，产物里这棵子树就是空的。

用户打开 `/data` 得到一个除了导航什么都没有的页面，直到 JS 拉起。路由级 `loading.tsx` 成了永不生效的死代码。

### 规则

> **凡是用了 `useSearchParams()` 的静态预渲染路由，Suspense 的 fallback 必须是真实结构骨架，不是 `null`。**
>
> 判据：产物 HTML 里，用户在 JS 到达前能看到的区域不应是空白。

### 骨架里放什么、不放什么

| 放 | 不放 |
|---|---|
| 灰块（`.skeleton`） | 任何**随时间或访问者变化**的值 —— 尤其日期 |
| 区块灰块 + sr-only 区块名 | 带 `href` 的链接（href 里往往藏着日期） |
| 页头真文案（若它静态） | 骨架占位符上的可见文字（DESIGN.md §七.2 既有契约） |

「页头放真文案」是有意的例外：页头是静态的（不依赖数据、不含日期），预渲染出来对 SEO 与读屏都有价值，且让首屏不是一整块灰。它不违反「骨架屏不放可见文案」—— 那条约束针对的是**骨架占位本身**。

### 日期必须来自访问日

静态壳这条修复带出一个更隐蔽的问题：即使 fallback 是骨架，组件里的日期仍可能来自构建。

> **凡是要进 `<a href>` 的日期，必须是访问时求值的，且求值位置不能被模块作用域污染。**
>
> 判据：产物 HTML 里，全文搜 `20\d\d-\d\d-\d\d` 应当零命中（除非页面本就展示静态历史数据）。

**结构性修法优先于注释**：把日期变成纯函数的入参（`buildPresets(today)`），而不是在函数内部调 `new Date()`。前者让「构建日」这个状态在类型层面不可表达；后者只能靠注释提醒，而注释一定会被后来者挪动的代码绕过。

本次的可执行判据：

```ts
// 构建后第 2 天访问，chips 仍指向「近 7 天」
const onBuild = buildPresets("2026-09-28").find(p => p.label === "近 7 天支出")!;
const onVisit = buildPresets("2026-09-29").find(p => p.label === "近 7 天支出")!;
assert.equal(onVisit.filter.to, "2026-09-29");   // 访问日
assert.notEqual(onVisit.filter.to, onBuild.filter.to);
```

**这条断言在旧代码形态下写不出来** —— 旧代码里「今天」不是任何函数的入参，测试无法注入「第二天的时钟」。能不能写出这条断言，比代码里有没有注释更能说明问题修没修到位。

---

## 二、一个区块的骨架只能有一份（[D-17]）

### 现状

同一种区块的骨架，历史上在两个地方各写一遍，已经漂移：区块顺序不同、间距不同、其中一处连播报都没有。读屏用户在等数据时得到的是完全静默的灰块。

### 规则

> **一个路由的「静态壳 fallback」「`loading.tsx`」「client 组件的 loading 分支」必须渲染同一个骨架组件。**
>
> 拆成两个导出：`XxxShell`（含 `<main>`）与 `XxxShellBody`（不含）。后者用于塞进 client 组件自己的 `<main>` —— 嵌套 `<main>` 是非法 HTML。

本包现状：`data-shell.tsx` 一份，`page.tsx` fallback / `loading.tsx` / `data-client.tsx` 三处引用。

### 待决策：根级 `loading.tsx` 与路由级 `loading.tsx` 的层级

`src/app/loading.tsx` 比 `src/app/data/loading.tsx` **更外层**，在预渲染产物里它占可见槽位，路由自己的骨架被推进内层（HTML 中标记为 `data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"`）。结果是 `/data` 首屏显示的是**总览页**的骨架（各账户余额 / 本月预算进度）。

需要全局决定其一：
1. 不设根级 `loading.tsx`，由各路由自备（推荐：四页形状各异，根级那份必然是某一页的复制品）
2. 根级只放与路由无关的极简壳
3. 接受首屏骨架跨页串味

选 1 之前，规则应写成：**根级 `loading.tsx` 不得假设任何具体区块**。它是兜底，不是模板。

---

## 三、播报：骨架屏与错误屏的契约（[D-17] / [D-06]）

### 骨架屏

统一走 `SkeletonStatus`：

```tsx
<div role="status" aria-busy="true" className="flex flex-col gap-6">
  <span className="sr-only">掌灯中…</span>
  {children}
</div>
```

- `role="status"` + `aria-busy` + 一句 sr-only：三者缺一，灰块对读屏就是静默的
- 区块级灰块另给 sr-only 区块名（「近 6 个月收支趋势」），否则「正在等哪一栏」没有答案
- **文案是「掌灯中…」而不是「加载中」** —— 后者是系统术语，前者是本产品的语言（DESIGN.md §一 灯是本产品的隐喻）

### 错误屏

统一走 `SectionError({ onRetry, label })`：

- `role="alert"`：分区一失败就播报，不等用户去发现
- `onRetry` 有值才渲染按钮 —— 没有可执行补救动作时，按钮是装饰不是控件
- `label` 必传：N 个一模一样的「这一栏暂时加载失败」无法让用户判断是哪一栏坏了
- 文案说清「发生了什么 + 怎么办」，不道歉不模糊

### 一条更上位的规则

> **一次请求失败 = 一张错误面板，不是一栏一张。**

`/data` 整页只有一次 `/api/data` 请求，所以四个区块的 loading/error 状态在代码里是**同一个布尔值渲染四遍**。这正是「6 个一模一样的错误面板」的成因 —— 重复不是因为设计失误，是因为把「分区」当成了错误粒度，而真实的失败粒度是「请求」。

按请求粒度收敛后，本包顺带接上了 WP-6 新增的重试能力（`useApiData` 的 `reload` 此前全站零调用点）。

---

## 四、排版：计数不是金额（[D-44]）

### 现状

`DESIGN.md` §八 把 `.money` 定义为「一切金额」（mono 字体 + tabular-nums）。但代码里笔数也套了 `.money`：

```tsx
共 <span className="money text-ink">{count}</span> 笔
```

于是「128 笔」在数据页是等宽、在设置页是正文体。同一产品里同一个概念两种排版。

### 规则

> **`.money` 只给金额。计数（笔数、条数、账户数）用 `.num`。**
>
> `.num` = `font-variant-numeric: tabular-nums`，**不改字体**。
>
> 区别在于：计数需要的是**数字等宽**（多行列表逐行对齐），不是**字族等宽**。把中文标签（「笔」）和数字一起塞进 mono 是浪费 —— mono 的价值在对齐数字，不在渲染汉字。

```css
.money { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.num   { font-variant-numeric: tabular-nums; }   /* 新增 */
```

计数同时应带千分位（`toLocaleString("zh-CN")`）：`1200` 读作「一千二」远慢于「1,200」，而计数是要被快速扫读的。

> 待接线：本包因 `globals.css` 非本包所有权，先用 Tailwind 内置 `tabular-nums` 顶替（语义正确，即刻可用）。`.num` 落地后本包改 1 处，设置页改 1 处。清单见 `wp3-implementation.md` §5①。

---

## 五、锚点偏移：单一来源（[D-43]）

### 规则

> **`scroll-margin-top` 只在 `globals.css` 定义一次。页面组件不得自写 `scroll-mt-*`。**

```css
:root { --nav-scroll-offset: 96px; }
:target, section[id] { scroll-margin-top: var(--nav-scroll-offset); }
```

`#results` 是 `<section id="results">`，已被 `section[id]` 覆盖。

自写值有两重危害：
1. **覆盖变量** —— 改了 `:root` 也不生效，配置成了谎言
2. **数值本身错** —— 本次删掉的 `scroll-mt-20`（80px）不足以避开 iPhone 上约 99px 的移动端顶栏（`env(safe-area-inset-top)` + 52px）。点「重置」跳 `#results` 会被压在顶栏下面，而这类 bug 只在真机上出现

需要跳转到锚点时，**删掉页面的自写值**就是修复动作；若确实存在全局规则覆盖不到的锚点（非 `section`、非 `:target`），才在页面加，并在注释里写明为什么全局规则不够。

---

## 六、查询参数：一份规则，两端共用（[D-11] / [D-35]）

### 规则

> **会进入数据库查询的 URL 参数，校验规则必须是客户端与服务端共用的同一个纯函数。**
>
> 判据：`route.ts` 与页面组件都从同一处 import 解析函数。两侧各写一份时，STRUCTURE.md 里「same rules the page used」这句话就是假的。

### 校验失败即丢弃，不报错

地址栏参数允许被手工编辑、被书签、被分享。`?acc=<坏值>` 的正确反应是**忽略这个条件**，像没传过一样：

```ts
assert.deepEqual(parseQueryFilter({ acc: "not-a-uuid" }), parseQueryFilter({}));
```

报错是最差选择 —— 用户改错了地址栏，页面不该为此拒绝服务；且丢掉一个条件时其余条件仍应照常生效。

### 进 `.or()` / LIKE 的值必须转义（这是真正的注入面）

UUID 校验不是洁癖。PostgREST 的 `.or()` 是一条**逗号分隔的过滤器 DSL**：

```ts
listQuery.or(`account_id.eq.${filter.account},to_account_id.eq.${filter.account}`)
// ?acc=1,or(id.not.is.null)  →  注入额外的 or 分支
```

未校验的输入让用户自己决定查询形状。LIKE 同理，且更隐蔽：

```ts
`%${q}%`  //  q = "%"  →  "%\%%"  →  匹配全部行
```

两层转义，**顺序固定**：

1. `escapeLikePattern`：`\` `%` `_`（先转 `\` 再转 `%`/`_`，否则被二次处理）
2. `escapeOrValue`：给 `.or()` 参数加引号并转义 `\` 与 `"`（否则一个引号就能拆开参数列表）

### 参数顺序固定

同一个 filter，无论键的插入顺序如何，序列化结果必须逐字符相同。否则「链接上的 qs」与「发给 API 的 qs」无法用断言比对，而这种漂移会让缓存键、测试、分享链接集体失准。

---

## 七、日期算术：纯日历运算（[D-05] 附带）

### 规则

> **日期加减只做纯日历运算，全部用 UTC 字段构造与读取（`Date.UTC` / `getUTC*`）。**
>
> 判据：同一段算术在 `TZ=Asia/Shanghai` / `America/New_York` / `Pacific/Kiritimati` 下答案相同。

```ts
// ✗ 本地字段 + 夏令时切换会掉一天
new Date(y, m - 1, d + delta).toISOString().slice(0, 10)

// ✓
const t = new Date(Date.UTC(y, m - 1, d + delta));
return t.toISOString().slice(0, 10);
```

**月末不要手写分支。**「某月最后一天」用 `new Date(Date.UTC(y, m, 0)).getUTCDate()` 读天数，闰年交给 `Date`：

```ts
// ✗ 本次修掉的真实 bug：2 月返回 2 月 2 日
shiftDays(`${key}-01`, m)

// ✓
const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
return shiftDays(`${key}-01`, daysInMonth - 1);
```

---

## 八、本次改动对既有条目的补充

| 既有条目 | 补充 |
|---|---|
| §七.2 骨架屏契约 | 补：骨架里不得含随访问变化的值（尤其日期）；补：一条路由的三条 loading 路径必须同源；补：根级 `loading.tsx` 不得假设具体区块 |
| §八 排版 | 补 `.num` 一行；补「`.money` 只给金额」；补计数带千分位 |
| §十 错误文案 | 补：错误粒度 = 请求粒度，不等于区块粒度；补 `label` 必传 |
| §十一 无障碍 | 补：`.num` 与 `.money` 的可访问性差异（数字等宽 vs 字族等宽） |
| §二 静态预渲染 | 补：fallback 不得为 `null`；补锚点偏移单一来源 |
| 结构 §路由与边界 | 补：客户端与服务端共用参数校验纯函数 |
