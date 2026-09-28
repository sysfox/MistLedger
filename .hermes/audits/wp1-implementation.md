# WP-1 · design-system 施工报告

**包**：WP-1 `design-system`（契约地基，派工要求先合）
**基线 commit**：`2447d67`
**文件所有权**：`globals.css` · `layout.tsx` · `template.tsx` · `error.tsx` · `global-error.tsx` ·
`loading.tsx` · `manifest.ts` · `site-nav.tsx` · `page-skeleton.tsx` · `section-error.tsx` ·
`mui-provider.tsx` · `mui-theme.tsx` · `format.ts` · `constants.ts` · `next.config.ts`
（外加新增 `mui-gate.tsx`、本目录下的报告）

**git 写操作**：本包全程未执行任何 `git add/commit/checkout/stash`。
**`next build`**：按指令未执行（会争用 `.next`）。

---

## 一、开工前的状态：断电留下的半成品

上一任 agent 在 WP-1 中途断电，工作区落盘了大量改动但未收尾、未验证、未写报告。
本次开工的第一步是对 `git diff HEAD` 逐行通读全部相关文件，判断每一项是否真的落地且正确。

### 1.1 确认合格（直接保留，未改动其设计决策）

| 项 | 位置 | 判断 |
|---|---|---|
| 对比度令牌拆出 `--color-fogline-strong` | `globals.css:43` | ✅ 正确。新增交互控件边界令牌，`fogline` 保持原值供装饰边框。实跑脚本 11/11 通过 |
| `.input` / `.chip` 换用 strong 令牌 | `globals.css:140,238` | ✅ 正确，SC 1.4.11 的目标控件 |
| 锚点滚动偏移统一为 `--nav-scroll-offset` | `globals.css:19,75-78` | ✅ 正确。`:target` + `section[id]` 双入口，`.input` 上那条无意义的 `scroll-margin: 96px` 已删 |
| `mist-in` 移除 `filter: blur` | `globals.css:356-365` | ✅ 正确，基准路径只动合成层 |
| 通配过渡移入 `@layer base` | `globals.css:454-462` | ✅ 正确，修复了「无层级规则抢占 `transition-transform`」的地雷 |
| `reduced-motion` 用 `animation: none` | `globals.css:440-447` | ✅ 正确且比原写法更彻底 |
| 字体字重收敛 | `layout.tsx:22,32` | ✅ 设计正确（但引出一个新缺陷，见 §2.1） |
| `metadataBase` + `openGraph` | `layout.tsx:42-60` | ✅ 正确 |
| `<noscript>` 中文兜底 | `layout.tsx:89-101` | ✅ 正确，四页都是 client-fetch 壳 |
| skip link | `layout.tsx:78-86` | ✅ 设计正确（接线未完成，见 §4） |
| `manifest` orientation `portrait`→`any` | `manifest.ts:14` | ✅ 正确 |
| `MUI_ROUTES` 条件挂载 + `next/dynamic` 拆包 | `mui-gate.tsx:29-41` | ✅ 正确。不建 route group 的理由（会移动三个目录、破坏其他包的文件所有权）站得住 |
| MUI 侧 `foglineStrong` + `prefers-contrast` 同步 | `mui-theme.tsx:24,136-159` | ✅ 正确，MUI 主题是 JS 常量读不到 CSS 变量，复刻覆盖值是必要且正确的 |
| `CHANNELS` 词汇表去重 | `constants.ts` | ✅ 正确，`value` 不变故无需数据迁移 |
| `formatSignedMoney` / `amountSign` 符号下沉 | `format.ts:34-59` | ✅ 正确，实跑 19/19 通过 |

### 1.2 发现并修复的半成品缺陷

上一任留下的问题里有 **3 个是真缺陷**（不是风格问题，是会出错的行为），已在本次收尾修掉。

---

## 二、本次新补的内容

### 2.1 [D-13] `next.config.ts` 安全响应头 —— 全新补完

**文件**：`next.config.ts:19-56`（新增 `securityHeaders` 常量 + `async headers()`）

此前 `next.config.ts` 只有一个 `experimental.staleTimes`，零安全响应头。

```
securityHeaders（:19-28）
  X-Frame-Options        DENY
  Referrer-Policy        strict-origin-when-cross-origin
  X-Content-Type-Options nosniff
  Permissions-Policy     geolocation=(), camera=(), microphone=()

headers()（:38-56）
  source "/:path*"     → 上述 4 个头
  source "/api/:path*"  → 追加 X-Robots-Tag: noindex
```

**动手前先读了当前文档**：`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`（Next 16 自带）。三处决策据此而来：

1. **`headers` 可以是 async 函数**，返回 `{source, headers[]}` 数组 —— 确认无其它必填字段。
2. **同名 key 后者覆盖前者**（文档 "Header Overriding Behavior" 一节）。因此 `/api/:path*`
   规则放在 `/:path*` **之后**：4 个安全头自动继承，额外叠加一条 `X-Robots-Tag`。
3. **不引入完整 CSP**：文档明确 X-Frame-Options 已被 CSP 的 `frame-ancestors` 取代，
   但本仓的 MUI emotion 依赖运行时注入 `<style>`，一条 `style-src` 配错就是全站白屏。
   保留 `X-Frame-Options: DENY` 作为兜底 —— 所有目标浏览器都支持，且本应用没有任何
   需要被 iframe 嵌入的场景。这一取舍已写进代码注释，不是默默不做。

**路径匹配实测**（用 Next 自带的 `path-to-regexp` 实跑，不是照文档推测）：

```
source          /      /ledger  /api   /api/overview  /login  /settings
/:path*         true   true     true   true           true    true      ← 选它
/:path+         false  true     true   true           true    true
/api/:path*     false  false    true   true           false   false
```

`/:path*` 匹配根路径（`+` 不匹配），`/api/:path*` 精确覆盖 `/api` 本身与任意深度子路径。

**Referrer-Policy 与审计原文的差异**（已在注释中标注理由）：审计 [D-13] 写 `same-origin`，
任务书要求 `strict-origin-when-cross-origin`，取后者。`/data` 的查询条件走 URL searchParams
且页面本身可分享，收紧到 `same-origin` 只会让「从雾夜账跳去别处再跳回来」丢掉来源。

### 2.2 [D-06] `section-error.tsx` 重构

**文件**：`src/components/section-error.tsx`（19 行 → 64 行，整体重写）

**先 grep 确认死代码真的无引用**。`catchSection` / `SECTION_FAILED` 在 `src/` 内**零引用**，
仅存的命中在两处**非源码**位置：`.next/dev/server/chunks/ssr/*.js`（断电前留下的陈旧构建产物）
与 `.hermes/audits/round1-pm-audit.md`（审计报告本身在描述这个问题）。可安全删除。

**先读 `use-api-data.ts` 确认 `reload` 真实签名**，没有凭记忆接：

```ts
// src/lib/api/use-api-data.ts:54, 80-82
reload: () => void;
const reload = useCallback(() => { cache.reload(path, { silent: true }); }, [path]);
```

无参数、`() => void`，与 `onRetry?: () => void` 直接兼容。注意 WP-6 已重构过本文件
（新增 `resetApiCache` / `createApiCache` / `useSyncExternalStore`），签名与旧版不同，
按当前实现接而非按旧记忆接。

**新契约**：

| 项 | 实现 | 依据 |
|---|---|---|
| 删死代码 | 移除 `SECTION_FAILED` / `catchSection` | Suspense 流式时代遗留；四页改为静态壳 + client 取数后，失败发生在浏览器里，catchSection 无调用时机 |
| `role="alert"` | `section-error.tsx:40` | WCAG 2.2 SC 4.1.3 Status Messages —— 分区失败原先对读屏用户完全静默 |
| `onRetry?: () => void` | `section-error.tsx:33` | 接 `useApiData` 的 `reload` |
| 重试按钮 | `section-error.tsx:52-61`，`.btn-ghost` 风格 | **有 `onRetry` 才渲染** —— 没有可执行的补救动作时按钮是装饰不是控件 |
| 键盘可操作 | 原生 `<button type="button">` | 自带可聚焦 + Enter/Space 激活；`.btn-ghost` 自带 `:focus-visible` 灯色焦点环（`globals.css:211`）。**不需要**手写 `onKeyDown` |
| 文案「发生了什么 + 怎么办」 | `section-error.tsx:45-49` | DESIGN.md §十 |

文案对照 §十 逐条检查：「多半是网络断了，或登录已过期」= 发生了什么；
「点下面的「重试」再取一次，不会重复记账」= 怎么办（并说明重试安全，因为走 GET 不写库 ——
这是用户点按钮前真正在犹豫的事）。没有道歉（「抱歉」）、没有模糊表述（「暂时失败」）。
另加 `label` prop（默认「这一栏」）用于区分是哪一栏坏了 —— 六个一模一样的面板无法区分，
且读屏用户听到的「哪一栏坏了」目前是唯一线索缺失的。

### 2.3 `global-error.tsx` 字重数组与 layout 脱钩 —— 修复半成品缺陷

**文件**：`src/app/global-error.tsx:14-30`

上一任为修 [D-50]（global-error 丢失字体变量）在此重新声明了三组 `next/font` 调用，
但**字重数组是改动前的旧值**，与它同时改过的 `layout.tsx` 不一致：

| | Serif | Sans |
|---|---|---|
| `layout.tsx`（已改） | `["600"]` | `["400","500","600"]` |
| `global-error.tsx`（漏改） | `["600","700","900"]` | `["400","500","700"]` |

`next/font` 按「字体 + 字重 + 子集」的**内容哈希**去重产物。两处参数不同 → 哈希不同 →
**重新下载并自托管第二套字体**。更糟的是 Sans 缺 600：`global-error` 页面上的
`font-semibold` 会退化成浏览器合成加粗 —— 正是 [D-50] 要修的那个问题，在修复它的文件里又犯一遍。

已改为与 `layout.tsx` 逐字相同，并在注释中写明「两处字重必须同步修改」。

### 2.4 `site-nav.tsx` matchMedia 提前 return 是无效的 —— 修复半成品缺陷

**文件**：`src/components/site-nav.tsx:19-48, 55, 83, 143`

上一任为 [D-26] 第一节在 effect 里加了断点过滤：

```tsx
useEffect(() => {
  const mq = window.matchMedia("(max-width: 639px)");
  if (!mq.matches) return;   // ← 依赖数组是 []
  ...
}, []);
```

注释写着「视口跨越断点时重新挂载」，**但代码做不到**：effect 依赖是 `[]`，
它在挂载那一刻读一次 `matchMedia` 就再也不动了。用户把窗口从宽拖到窄（或手机横竖屏切换），
滚动监听永远不会挂载 —— `.scroll-edge` 在移动端顶栏下静默失效。

改用 `useSyncExternalStore` 订阅断点，把「是否移动端」提升为**渲染期可见的状态**，
effect 才能以它为依赖正确地挂载/卸载：

- `getServerSnapshot` 返回 `false`（服务端无 viewport）→ SSR 零副作用；
- 客户端 hydration 用的也是 `getServerSnapshot` → 首帧输出与服务端一致，无 hydration mismatch；
- 真正的 `true` 只在挂载后的订阅推送中出现。

顺带修掉一个我引入后被 lint 逮到的错误：初版我在桌面分支写了 `setScrolled(false)`，
`react-hooks/set-state-in-effect` 正确报错。确实该去掉 —— `data-scrolled` 的唯一消费者是
那个 `sm:hidden` 的移动端顶栏，桌面端根本渲染不出来，清理它没有可观察的效果。
改为渲染期派生：`const scrolledAttr = isMobileViewport && scrolled ? "true" : "false"`（:83）。

### 2.5 `page-skeleton.tsx` 重复的 SectionSkeleton —— 修复半成品缺陷

**文件**：`src/components/page-skeleton.tsx:17-49`

上一任新增 `SectionSkeleton` 时，**文件里出现了两份 `SectionSkeleton` 定义**
（原 `SkeletonPanel` 位置一份、新增一份），后者还与原 `SkeletonPanel` 逐字重复 ——
正是 [D-17] 抱怨的「同一种区块形状漂移」，只是换了个地方复发。
已删除重复定义，并让 `SkeletonPanel` 转发到 `SectionSkeleton`（:47-49），
使区块形状永远只有一个来源。新代码请直接用带 `title` 的 `SectionSkeleton`。

### 2.6 `loading.tsx` 缩进破损 + `#main` 锚点

**文件**：`src/app/loading.tsx:11-77`

上一任的编辑留下了 `SkeletonStatus` 的子元素**完全未缩进**（第 15 行与第 14 行齐平），
可读性受损。已重排。同时把该文件里混用的 `SkeletonPanel` / `SectionSkeleton` 统一为
`SectionSkeleton`，并给每一栏补上真实的区块名（`title` 走 sr-only，不产生可见文案，
不违反 DESIGN.md §七.2 的骨架契约）。

### 2.7 `error.tsx` / `global-error.tsx` 补 `id="main"` + `role="alert"`

**文件**：`src/app/error.tsx:19`、`src/app/global-error.tsx:57-61`

两处 `<main>` 都没有 `id="main"`，而 layout 的 skip link 指向它 —— **skip link 在这两个
错误态下是死链**。已补上 `id="main"` 与 `role="alert"`（整页崩溃必须打断读屏用户的当前播报）。

---

## 三、验证：真实命令与输出

全部命令在 `C:\Users\imagi\Documents\Project\MistLedger` 下实跑。**未执行 `next build`**（争用 `.next`）。

### 3.1 ESLint（本包 15 个 ts/tsx 文件）

```
$ npx eslint --no-warn-ignored src/app/layout.tsx src/app/template.tsx src/app/error.tsx \
    src/app/global-error.tsx src/app/loading.tsx src/app/manifest.ts \
    src/components/site-nav.tsx src/components/page-skeleton.tsx src/components/section-error.tsx \
    src/components/mui-gate.tsx src/components/mui-provider.tsx src/components/mui-theme.tsx \
    src/lib/ledger/format.ts src/lib/ledger/constants.ts next.config.ts

ESLINT_EXIT=0
（无任何输出 = 0 error 0 warning）
```

> `globals.css` 不在此列 —— ESLint 配置未给它匹配规则，直接传入只会得到
> `File ignored because no matching configuration was supplied` 警告。CSS 另用 §3.4 验证。
> 中途 `site-nav.tsx` 曾报 `react-hooks/set-state-in-effect`，已按 §2.4 修复。

### 3.2 TypeScript（`--incremental false` 强制全量，绕过缓存）

```
$ npx tsc --noEmit --incremental false
TSC_EXIT=0
（无任何输出）
```

**关于任务书提到的「api/data/route.ts 的 8 个报错」：本次实测为 0。**
`tsc --listFiles` 确认 `src/app/api/data/route.ts` **在编译范围内**（不是被 tsconfig 排除），
且全量编译无任何诊断输出。基线 `2447d67` 时期存在的这批报错，应已被 WP-3/WP-6 在工作区中修复。
本包未触碰该文件，也未做任何 git 操作去比对历史 —— 如需确认，可用 `git stash` 之外的方式
（如 `git show 2447d67:src/app/api/data/route.ts`）单独核对。

### 3.3 两个遗留校验脚本实跑

`.hermes/audits/contrast-check.mjs` 与 `format-check.mjs` 是上一任留下的。
**两者都仍然成立**（断言与当前实现逐条对得上，无需修改）：

**contrast-check.mjs** —— `node .hermes/audits/contrast-check.mjs`，`CONTRAST_EXIT=0`

```
── 对比度实测 ──
┌─────┬────────────────────────────────────┬───────────┬───────────┬─────────┬──────┐
│ 组合 │              前景                  │   背景     │   比值     │  下限   │ 判定 │
├─────┼────────────────────────────────────┼───────────┼───────────┼─────────┼──────┤
│  0  │ fogline-strong on veil（.input 边框）│ #5e6f8c  │ #1b2436   │ 3.05:1  │ PASS │
│  1  │ fogline-strong on mist（.chip 边框） │ #5e6f8c  │ #111826   │ 3.49:1  │ PASS │
│  2  │ fogline on mist（.panel 装饰边框）   │ #28324a  │ #111826   │ 1.39:1  │ PASS │
│  3  │ fogline on veil（.panel 装饰边框）   │ #28324a  │ #1b2436   │ 1.22:1  │ PASS │
│  4  │ more: fogline-strong on veil        │ #8b98b8  │ #1b2436   │ 5.38:1  │ PASS │
│  5  │ more: fogline-strong on mist         │ #8b98b8  │ #111826   │ 6.16:1  │ PASS │
│  6  │ more: fogline on mist（装饰线）      │ #46516e  │ #111826   │ 2.25:1  │ PASS │
│  7  │ 焦点环 lamp@60% on night             │ #8c712f  │ #0a0e14   │ 4.16:1  │ PASS │
│  8  │ 焦点环 lamp@60% on mist              │ #8f7536  │ #111826   │ 4.03:1  │ PASS │
│  9  │ ink on night（正文）                 │ #e9e4d8  │ #0a0e14   │ 15.25:1 │ PASS │
│ 10  │ dim on night（次要文字）             │ #8b93a7  │ #0a0e14   │ 6.29:1  │ PASS │
└─────┴────────────────────────────────────┴───────────┴───────────┴─────────┴──────┘

结论：11/11 通过，0 失败
```

第 2、3 行是**回归护栏**（`下限 0.0:1`）：装饰边框不得被一起提亮，否则大面积变亮破坏「雾」的层次。

**format-check.mjs** —— `node .hermes/audits/format-check.mjs`，`FORMAT_EXIT=0`

```
┌────┬──────────────────────────────────────────────┬──────────────┬──────────────┬──────┐
│用例│                  期望                         │     实际      │    期望      │ 判定 │
├────┼──────────────────────────────────────────────┼──────────────┼──────────────┼──────┤
│  0 │ formatSignedMoney(-12.5)                       │ −¥12.50      │ −¥12.50      │ PASS │
│  1 │ formatSignedMoney(-1234)                       │ −¥1,234.00   │ −¥1,234.00   │ PASS │
│  2 │ formatMoney(-12.5) 单独使用                     │ −12.50       │ −12.50       │ PASS │
│  3 │ formatSignedMoney(-1) 的负号为 U+2212           │ U+2212       │ U+2212       │ PASS │
│  4 │ formatMoney(-1) 的负号为 U+2212（非 ASCII）      │ U+2212       │ U+2212       │ PASS │
│  5 │ 旧调用点 expense 支出行渲染                     │ −¥12.50      │ −¥12.50      │ PASS │
│  6 │ 旧调用点 income 支出行渲染                      │ +¥12.50      │ +¥12.50      │ PASS │
│  7 │ 旧调用点 transfer 支出行渲染                    │ ⇄¥12.50      │ ⇄¥12.50      │ PASS │
│  8-10│ 三种类型无双符号                               │ 无双符号      │ 无双符号      │ PASS │
│ 11-13│ 迁移前后一致：expense/income/transfer         │ 一致          │ 一致          │ PASS │
│ 14  │ formatSignedMoney(1234.56) neutral            │ ¥1,234.56    │ ¥1,234.56    │ PASS │
│ 15  │ formatSignedMoney(-1234.56) neutral           │ −¥1,234.56   │ −¥1,234.56   │ PASS │
│ 16  │ formatSignedMoney(-12.5, expense) 不出 −−      │ −¥12.50      │ −¥12.50      │ PASS │
│ 17  │ formatSignedMoney(0) neutral                  │ ¥0.00        │ ¥0.00        │ PASS │
│ 18  │ formatSignedMoney(-0.004) 仍带负号            │ −¥0.00       │ −¥0.00       │ PASS │
└────┴──────────────────────────────────────────────┴──────────────┴──────────────┴──────┘

结论：19/19 通过，0 失败
```

> **一处需要后续注意的局限**：该脚本把 `format.ts` 的实现**原样抄了一份**在文件头部
> （注释里自称 "sync"）。这意味着 `format.ts` 改动后若不同步脚本，脚本仍会通过 ——
> 它现在验证的是「抄本与自己一致」加「固定期望值」，不是「真实实现」。
> 本次已逐行核对抄本与 `format.ts:1-59` **逐字一致**，故结论有效。
> 根治要靠真测试运行器（[D-25]，WP-6 已在建 `npm test`），建议后续把此脚本迁到 `src/**/*.test.ts`。

### 3.4 CSS 语法与关键规则验证

```
$ node -e "lightningcss.transform(globals.css, errorRecovery:false)"
lightningcss parse: OK, output bytes = 8225
  contains scroll-margin-top   => true
  contains transition-property => true
  contains fogline-strong      => true
  contains mist-in-blur        => true
  contains prefers-contrast    => true
  contains prefers-reduced-motion => true

$ 括号配平检查
final brace depth: 0 BALANCED
```

嵌套 `@media`（`prefers-reduced-motion` 嵌在 `min-resolution` 内）与 `@layer base` 均被
lightningcss 正确解析。用的是 Tailwind v4 自带的 lightningcss，与实际构建同一套解析器。

**关键规则落地核对**（脚本逐条扫描 `globals.css`）：

```
transition-property 声明数: 1（globals.css:458，位于 @layer base 内）
   另一处命中是 L451 的注释文本，非声明
   → 满足 [D-23] 的「grep -c ≤ 2」验收标准 ✓

scroll-margin 声明数: 1（globals.css:77，:target + section[id] 统一规则）
   .input 块内含 scroll-margin: False（已正确删除）✓

雾线令牌使用点：
   L131  var(--color-fogline)        <- .panel    （装饰，保持低对比 ✓）
   L140  var(--color-fogline-strong) <- .input    （交互，3.05:1 ✓）
   L238  var(--color-fogline-strong) <- .chip     （交互，3.49:1 ✓）
```

### 3.5 DESIGN.md §十一 禁忌 10 条自检

**先跑仓库自带的 lint 守卫自测**（[D-25] 由 WP-6 建的 `scripts/check-taboo-guard.mjs`）：

```
$ node scripts/check-taboo-guard.mjs
DESIGN.md §十一 lint 守卫自测

  ✓ 对照组：panel / border-fogline / text-ink / text-ember / .money 无误报
  ✓ §十一#6 zinc 灰阶          ✓ §十一#6 slate 灰阶        ✓ §十一#6 neutral 灰阶
  ✓ §十一#1 标准色 red-500     ✓ §十一#1 标准色 blue-600    ✓ §十一#1 标准色 indigo-500
  ✓ §十一#5 dark: 变体
  ✓ §十一#5 dark: 前缀不误报（darkness-500 / archived:）
  ✓ 外部标准色板 import
  ✓ window.confirm
  ✓ 模板字符串中的禁忌类名

结果：全部 12 项通过，临时违规文件已删除
```

**再对本包 16 个文件逐条正则扫描**：

| §十一 条目 | 扫描结果 |
|---|---|
| #1 新的红/绿/蓝标准色（red/green/blue/amber/indigo/…-\d+） | **0 命中** |
| #2 大面积灯色 | **0 命中**（本包无大面积 lamp 背景新增） |
| #3 常亮灯线 > 每屏 1 条 | 本包未新增任何 `.lamp-line` 使用点 |
| #4 渐变按钮 / 渐变进度条 / 发光大标题 | **0 命中** |
| #5 `dark:` 变体 | **0 命中** |
| #6 zinc/neutral/slate/gray 灰阶 | **0 命中** |
| #6' 非令牌灰黑白（`bg-gray/black/white`、`border-*`） | **0 命中** |
| #7 非 mono 字体的金额 | 本包未新增金额渲染点；`format.ts` 不涉及字体 |
| #8 单次动画 > 500ms / reduced-motion 下仍会动 | mist-in 380ms ✓；`fog-drift`/`lamp-breathe`/`skeleton-pulse` 三者均在 `@media (prefers-reduced-motion: reduce) { animation: none !important }` 覆盖范围内 ✓ |
| #9 焦点环被移除或换成非灯色 | `outline: none` 共 9 处，**逐处核对均配灯色替代环**：globals.css 的 145/170/212/233/273 各有 `box-shadow: 0 0 0 2px lamp@60%` 紧随；layout.tsx:83 skip link 有 `focus-visible:ring-2 ring-lamp/60`；site-nav.tsx:16/134/157 有 `focus-visible:ring-2 ring-lamp/60` ✓ |
| #10 编号装饰 / emoji / 拟物阴影堆叠 | 编号装饰 **0 命中**。emoji 扫描曾命中 `global-error.tsx:14` 的 `⚠` —— 位于**代码注释**内、非渲染 UI，仍已改为纯文字以保持 grep 守卫干净。拟物阴影：本包未新增 box-shadow 堆叠 |

---

## 四、仍未完成项 & 待接线清单

### 4.1 ⚠ `id="main"` 接线未完成 —— skip link 目前在四个页面上是死链

layout.tsx 的 skip link 指向 `#main`（`layout.tsx:82`），但**页面壳的 `<main>` 在其他 agent 的文件里**。
按指令**未擅自修改**，列出清单：

| 文件 | 行 | 归属包 | 需要的改动 |
|---|---|---|---|
| `src/app/overview-client.tsx` | 323 | **WP-2** | `<main className=...>` → 加 `id="main"` |
| `src/app/ledger/ledger-client.tsx` | 175 | **WP-4** | 同上 |
| `src/app/data/data-client.tsx` | 350 | **WP-3** | 同上 |
| `src/app/settings/settings-client.tsx` | 333 | **WP-5** | 同上 |
| `src/app/login/page.tsx` | 52 | **WP-5** | 同上 |
| `src/app/data/loading.tsx` | 12 | WP-3 | 同上（路由级骨架） |
| `src/app/ledger/loading.tsx` | 5 | WP-4 | 同上 |
| `src/app/settings/loading.tsx` | 5 | WP-5 | 同上 |
| `src/app/login/loading.tsx` | 5 | WP-5 | 同上 |

**本包已在自己拥有的三个文件里补齐**：`error.tsx:19`、`global-error.tsx:57`、`loading.tsx:13`。
注意 `loading.tsx` 只覆盖根路由（`/`），`/ledger` `/data` `/settings` `/login` 各有自己的 `loading.tsx`。

**影响评估**：这是 WCAG 2.2 SC 2.4.1 的验收条件。在接线完成前，
skip link 存在但点击无效（浏览器找不到锚点，焦点不移动）。**不是崩溃，但功能未达成。**
建议在各包收尾时优先处理（每处一个属性）。

### 4.2 `SectionError` 的 4 个调用点未接 `onRetry` —— 属其他包

`onRetry` / `label` 已实现，但调用点传不到 `reload`：

| 文件 | 行 | 归属包 |
|---|---|---|
| `src/app/overview-client.tsx` | 337,338,340,341,343,344 | WP-2 |
| `src/app/ledger/ledger-client.tsx` | 195,203 | WP-4 |
| `src/app/data/data-client.tsx` | 366,399,428,452,468 | WP-3 |
| `src/app/settings/settings-client.tsx` | 349,350,375,394 | WP-5 |

每个调用点接法：`{onRetry={reload} label="本月支出占比"}` ——
`reload` 直接来自同处已有的 `useApiData(...)` 解构。
**注意**：不接 props 也不会编译失败（两个 prop 都是可选的），
但 [D-06] 的验收标准「出现带可点「重试」的错误面板」就仍未达成。

### 4.3 `formatMoney` 负数语义变更的调用点迁移 —— 属 WP-2/3/4/5

`formatMoney(-12.5)` 的行为已变：原 `"-12.50"`（ASCII hyphen）→ 现 `"−12.50"`（U+2212 前置）。
对**正数**调用点零影响（body 完全相同），已由 format-check.mjs 的 19 个用例覆盖。
但**存量手写 `¥{formatMoney(v)}` 的调用点**（约 15 处）在传入负数时，
会把 `−` 渲染到 `¥` 之后（如 `¥−1,234.00`）——**这正是 [D-08] 要修的问题本身**。
这些调用点分属：

- `overview-client.tsx:168,248`（hero、总资产、各账户余额）— WP-2
- `settings-client.tsx:78,92,96,205`、`adjust-balance-button.tsx:79,80,81,117` — WP-5
- `dashboard-charts.tsx:54` 另有一份**本地** `formatMoney` 副本，未 import 库函数 — WP-6

**建议**：这些调用点改用 `formatSignedMoney(n, kind)`（符号已含 `¥`，
调用点不再手写 `¥`），或 `amountSign()` + `formatMoney()` 组合以把 `¥` 单独染成灯色。
派工单已注明「先合 WP-1，再各自改调用点」，顺序正确。

### 4.4 `formatBudget` 仍是死代码

`format.ts:61` 的 `formatBudget` 全仓无调用点（`grep` 确认）。审计 [D-25] 已列出。
**未删**：`format.ts` 属 WP-1 所有权（可删），但 [D-25] 归属 WP-6，
且 `stats.ts` 的死代码清理（`monthlyTrend` 等）与它同属一条验收标准
（`grep -rn "formatBudget|catchSection|monthlyMonthlyTrend" src` 返回 0）。
留给 WP-6 一并处理更干净，避免两个包为同一条验收标准各动一次。
本包已清掉本文件内自己负责的那半（`catchSection` / `SECTION_FAILED`）。

### 4.5 `[D-40]` 图标双源未清理

`src/app/icon.png` + `apple-icon.png`（文件约定）与 `public/icons/*.png`（manifest 引用）仍并存。
清理需**删除 public 下的文件**，属写操作且与本包的「无 git 写操作」约束及
可能的其它包引用相冲突，**未动**。`manifest.ts` 侧只改了 `orientation`。
建议 WP-6 处理（该条的 `所属域` 是 `pwa / design-system`，跨界部分归 WP-6）。

### 4.6 未执行 `next build`（按指令）

DESIGN.md §十二 要求「每次界面改动后 `npm run lint` 与 `npm run build` 必须通过」。
`lint` 已通过；`build` **未执行**（任务书明确禁止，会争用 `.next`）。
因此以下几项**未经运行时验证**，需在合并前由能跑 build 的人补验：

- `MuiGate` 的条件挂载：需确认 `/` 与 `/data` 的 client chunk 清单中确实不含 `emotion` / `@mui`
  （[D-10] 的验收标准），且三个 MUI 路由首帧无 FOUC。
- 字体字重收敛：需确认产物中 woff2 数量与字体 CSS 体积确实下降，
  且 `document.fonts.check('600 20px "Noto Sans SC"', '掌灯中…')` 为 true。
- `next/font` 内容哈希去重：需确认 `layout.tsx` 与 `global-error.tsx` 现在**确实只产出一套字体**
  （§2.3 的修复依赖这个性质）。
- `site-nav.tsx` 的 `useSyncExternalStore` 断点订阅：需确认 hydration 无警告。

---

## 五、涉及文件清单

**本包拥有、本次修改**（12 个）：

| 文件 | 本次动作 |
|---|---|
| `next.config.ts` | **新增** `async headers()` + 4 个安全响应头 + `/api/*` 的 X-Robots-Tag（[D-13] 全新补完） |
| `src/components/section-error.tsx` | **重写**（[D-06]）：删死代码、加 `role="alert"`、加 `onRetry`/`label`、改文案 |
| `src/app/global-error.tsx` | 修字重数组与 layout 脱钩（§2.3）；补 `id="main"` + `role="alert"` |
| `src/components/site-nav.tsx` | 修 matchMedia 提前 return 无效（§2.4）；`useSyncExternalStore` 断点订阅 |
| `src/components/page-skeleton.tsx` | 删重复的 `SectionSkeleton`；`SkeletonPanel` 改为转发（§2.5） |
| `src/app/loading.tsx` | 修缩进；统一用 `SectionSkeleton` + 补区块名；加 `id="main"` |
| `src/app/error.tsx` | 加 `id="main"` + `role="alert"` |
| `.hermes/audits/wp1-design-fragment.md` | **新建**（待追加到 DESIGN.md 的 changelog 条目，中文） |
| `.hermes/audits/wp1-implementation.md` | **新建**（本文件） |

**本包拥有、上一任已合格、本次未改**（6 个）：
`globals.css` · `src/app/layout.tsx` · `src/app/template.tsx` · `src/app/manifest.ts` ·
`src/components/mui-gate.tsx` · `src/components/mui-provider.tsx` ·
`src/components/mui-theme.tsx` · `src/lib/ledger/format.ts` · `src/lib/ledger/constants.ts`

**未触碰**（其他包所有）：`api/data/route.ts` 及全部 `api/*` · `use-api-data.ts` · `client.ts` ·
`session.ts` · `supabase/*` · 四个页面壳与 login 目录 · `dashboard-charts.tsx` · `eslint.config.mjs` ·
`package.json` · `DESIGN.md`（只产出 fragment，未直接改）。
