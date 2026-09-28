# WP-6 审核报告 · platform / 数据层包

- 审核基线：`2447d67`
- 审核人：WP-6 专职审核员（本轮**未做任何 git 写操作**）
- 结论：**不通过 —— 2 个阻塞缺陷 + 2 个非阻塞缺陷，不予提交**

---

## 0. 四道门（全部亲自实跑，非引用施工 agent 结论）

| 门 | 命令 | 真实输出 |
|---|---|---|
| ESLint | `npx eslint` | `ESLINT_EXIT=0`，零 error 零 warning |
| 类型 | `npx tsc --noEmit` | `TSC_EXIT=0`，零 error |
| 单测 | `npm test` | `tests 44 / suites 12 / pass 44 / fail 0` |
| 禁忌守卫 | `npm run test:taboo-guard` | `结果：全部 12 项通过，临时违规文件已删除` |
| 缓存专项 | `npm run test:api-cache` | `结果：全部通过`（含 [D-14] 5 次 reload 落在 #6、被取代请求 `aborted=5`） |
| 构建 | `npm run build` | `BUILD_EXIT=0`；12 条路由，`/` `/data` `/ledger` `/settings` `/login` 全 `○ (Static)` |
| 服务 | `npx next start -p 3200` | `✓ Ready in 136ms` |
| 匿名探针 | `curl` × 9 | 5 页 200；`/api/{overview,ledger,data,settings}` **全部 401** `{"error":"unauthenticated"}` |
| Bench | `npm run bench -- --base http://localhost:3200` | 真实跑通，API 四行标注 **`401(auth)`** + 底部 `--cookie` 提示 + warmup + 阈值断言（见 §5 注） |

> 构建锁：本包无锁需求，审核开始时 `.hermes/.build-lock` 不存在 → 取锁 → build → 释放，全程未与他方争用。审核结束时（12:45）检测到 12:42 有另一审核员持锁在跑 build，**未触碰**。

---

## 1. 五维结论表

| 维度 | 结论 | 关键证据 |
|---|---|---|
| **1. 正确性** | ❌ **不通过** | **[WP6-01]** 401 路径自激请求风暴（实跑 84 次请求 / 80 次 `location.replace`）；**[WP6-02]** D-12 的 503 分流在最常见的「令牌过期 + 上游抖动」场景下**仍返回 401**，`AuthRetryableFetchError` 是 `AuthError` 子类，满足 `session.ts:67` 的 `error` 条件 |
| **2. 安全** | ✅ 通过 | `set-cookie` 守卫删除后策略仍安全：`sw.js:191` RSC 短路、`:193` 仅 navigate、`:198/:203` 仅图标与静态前缀；`/api/*` **完全不进 Cache Storage**（无任何分支匹配）。xlsx 0.20.3 三处一致，20MB 上限在 `arrayBuffer()` **之前**（`import-parse.ts:256`）且有 `:262` 二次兜底。`resetApiCache` 调用点齐全（`site-nav.tsx:102` + `client.ts:69`） |
| **3. 可访问性** | ✅ 通过 | `ChartFigure`（`dashboard-charts.tsx:96-105`）DOM 结构正确：`<figcaption>` 是 `<div role="img">` 的**兄弟**而非子节点，`aria-describedby` 指向其 `useId()`；三处调用点全部改用。SW 更新条 `role="status"`（`service-worker-register.tsx:88`）可达、两个按钮均可聚焦 |
| **4. 代码质量与文档** | ⚠️ **有条件通过** | 守卫有效性经**反向探针**验证（对照组不误报、11 项违规全部命中）。**[WP6-03]** 守卫只扫 `Literal`/`TemplateElement`，模板插值逃逸；`files` 不含 `.css`。STRUCTURE.md 路径经脚本逐条核验，**0 失效**（`middleware.ts` 提及是「Next 16 已改名 `src/proxy.ts`」的正确说明，非失效条目） |
| **5. 测试** | ⚠️ **有条件通过** | 44 项断言均检查**具体值**而非拄本自比，无假通过。**[WP6-04]** 但测试恰好绕开了 [WP6-01] 的风暴场景（`reset()` 后不再复位），故绿灯不掩盖缺陷 |

---

## 2. 阻塞缺陷

### [WP6-01] P0 · 401 路径自激请求风暴 —— A 登出后不刷新页面即陷入无限 401 循环

- **文件**: `src/lib/api/client.ts:66-73`（401 → `onSessionLost?.()`）↔ `src/lib/api/use-api-data.ts:17`（`setSessionLostHandler(() => cache.reset())`）↔ `src/lib/api/api-cache.ts:219-224`（`repumpAll` → `pump` → `startFetch`）
- **为什么是缺陷**:
  `apiGet` 收到 401 时先调 `onSessionLost()` → `cache.reset()`。`reset()` 的 `repumpAll()` 会**为每个仍有订阅者的 path 立刻重新发起取数**（`api-cache.ts:222`）。这些新请求带着已失效的 cookie 再发，服务端再回 401 → 再 `reset()` → 再 `repumpAll()`……

  设计上本该由 `commit()` 写入的 `snap.error` 充当断路器（`pump()` 在 `api-cache.ts:210` 检查 `entry.snap.error !== null` 即返回），但 `reset()` 走 `dropEntry()` 把 `snap` 重置为 `EMPTY_SNAPSHOT`，**错误态被同时抹掉，断路器永不锁存**。

  每轮每个 panel 各发一次请求，且每轮都执行一次 `window.location.replace("/login")`。
- **实跑证据**（`createApiCache` 真实模块，4 个订阅者，服务端恒 401）:
  ```
  4 mounted panels, every response is 401:
    total network requests issued  : 84
    sessionLost handler invocations : 80
    => SELF-SUSTAINING LOOP
  ```
  80 是探针主动设置的停止上限；**没有上限时该循环不收敛**。
- **与 D-01 的关系**: D-01 的目标（清空缓存防跨账号泄露）**是对的且必须保留**；缺陷在于「清空」与「立即重取」被绑在同一次 `reset()` 里。修复方向是让 session-lost 复位**不触发重取**。
- **精确修复步骤**:

  **步骤 1** — `src/lib/api/api-cache.ts`，给 `reset` 增加一个「静默」选项，并让静默复位跳过 `repumpAll`：

  在 `ApiCache` 类型（第 75-76 行）把
  ```ts
  /** Wipe every cached payload and re-drive live subscribers. */
  reset(): void;
  ```
  改为
  ```ts
  /**
   * Wipe every cached payload. Live subscribers are re-driven so they refetch,
   * UNLESS `silent` is set — a session-lost reset must not immediately re-issue
   * the requests that just failed with 401 (see [WP6-01]).
   */
  reset(opts?: { silent?: boolean }): void;
  ```

  在实现体（第 275-280 行）把
  ```ts
  reset() {
    for (const path of [...entries.keys()]) dropEntry(path);
    owner = null;
    // Live subscribers must observe the wipe, then the pump refetches.
    repumpAll();
  },
  ```
  改为
  ```ts
  reset(opts) {
    for (const path of [...entries.keys()]) dropEntry(path);
    owner = null;
    // [WP6-01] On session loss, only NOTIFY. Calling pump() here would
    // re-issue the very requests that just returned 401, and each one would
    // reset the cache again — a self-sustaining storm. The page is
    // navigating to /login, so nothing needs to repaint.
    for (const path of [...subs.keys()]) notify(path);
    if (opts?.silent) return;
    repumpAll();
  },
  ```

  **步骤 2** — `src/lib/api/use-api-data.ts:32-34`，把导出改为透传静默标志：
  ```ts
  export function resetApiCache(opts?: { silent?: boolean }): void {
    cache.reset(opts);
  }
  ```

  **步骤 3** — `src/lib/api/use-api-data.ts:17`，401 路径改为静默：
  ```ts
  setSessionLostHandler(() => cache.reset({ silent: true }));
  ```
  （`site-nav.tsx:102` 的主动登出**保持 `resetApiCache()` 不传参** —— 那里页面还会留在原地，重取是正确的。）

  **步骤 4** — 补回归测试，在 `src/lib/api/api-cache.test.ts` 的 `[D-01]` describe 内新增：
  ```ts
  it("[WP6-01] a 401 storm cannot re-arm the panels that just failed", async () => {
    let calls = 0;
    const cache = createApiCache({
      fetchJson: async () => {
        calls += 1;
        if (calls > 50) return { stop: true };
        // Mirror client.ts: session-lost handler runs BEFORE the throw.
        cache.reset({ silent: true });
        throw new Error("登录已过期，请重新登录");
      },
    });
    for (const p of ["/api/overview", "/api/ledger", "/api/data", "/api/settings"]) {
      cache.subscribe(p, () => {});
    }
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(calls, 4, "exactly one request per panel; no re-arm after 401");
  });
  ```

- **复验命令**:
  ```bash
  npm test && npm run test:api-cache && npx tsc --noEmit && npx eslint
  ```
  预期：`tests 45 / pass 45 / fail 0`，其余全绿。

---

### [WP6-02] P1 · D-12 的 503 分流在最常见故障场景下失效 —— 上游抖动仍被当成登出

- **文件**: `src/lib/api/session.ts:59-69`
- **为什么是缺陷**: 施工报告称「`getClaims` 抛 → 503」已闭合 D-12。代码走查只覆盖了 `throw` 分支，**遗漏了 `{ error }` 分支同样会吞掉上游故障**这一事实。

  读 `@supabase/auth-js` 源码确认了三段行为：
  1. `lib/fetch.js:28` — 任何传输层失败（ECONNREFUSED/DNS/超时）被包装成 `throw new AuthRetryableFetchError(msg, 0)`；`:43` — 上游 5xx 同样是 `AuthRetryableFetchError`。
  2. `GoTrueClient.js:4041-4044` — `_refreshAccessToken` 的 catch：`if (isAuthError(error)) return this._returnResult({...error})`，即**转成返回值而不是继续抛**。
  3. `GoTrueClient.js:5569-5575` — `getClaims` 的最外层 catch 同样 `if (isAuthError(error)) return this._returnResult({ data: null, error })`。

  而 `AuthRetryableFetchError instanceof AuthError === true`（实跑验证：`instanceof AuthError = true`，`isAuthError = true`）。

  于是**令牌过期 + 上游抖动**（Supabase 最常见的真实故障组合）时，`getClaims()` **不抛**，而是返回 `{ data: null, error: AuthRetryableFetchError }`，直接命中 `session.ts:67` 的 `if (error || ...)` → **401**。用户仍被 `window.location.replace("/login")` 踢出，正在填的表单全丢 —— 正是 D-12 要求消灭的行为。`session.ts` 的 `try/catch` 只对「非 AuthError 抛出」有效，而那几乎不会发生。
- **实跑证据**:
  ```
  name                    = AuthRetryableFetchError
  instanceof AuthError    = true
  isAuthError(e)          = true
  => session.ts:67  if (error || !claims || !claims.sub) return 401
     an AuthRetryableFetchError satisfies "error" => 401, NOT 503
  ```
  源码定位：`node_modules/@supabase/auth-js/dist/module/lib/fetch.js:28,43`、`GoTrueClient.js:4041-4044`、`GoTrueClient.js:5569-5575`。
- **精确修复步骤**:

  **步骤 1** — `src/lib/api/session.ts`，在文件顶部 import 区（第 1-3 行之后）加：
  ```ts
  import { AuthRetryableFetchError } from "@supabase/auth-js/dist/module/lib/errors.js";
  ```
  > 若该深路径在类型解析上报错，改用 `import { isAuthApiError } from "@supabase/supabase-js"` 判定亦可；判定条件等价 —— 只要 `error` 表示「传输/上游」而非「凭据无效」。

  **步骤 2** — `src/lib/api/session.ts:66-69`，把
  ```ts
  const claims = data?.claims;
  if (error || !claims || !claims.sub) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return { userId: claims.sub, supabase, refreshed };
  ```
  改为
  ```ts
  // [WP6-02] A retryable fetch error is an UPSTREAM fault, not a credential
  // decision. auth-js returns it as `{ error }` rather than throwing, so it
  // arrives here just like a genuine "no claims" — without this branch an
  // expired token plus a Supabase blip logs the user out and discards the
  // form they were filling in, which is exactly what [D-12] forbids.
  if (error instanceof AuthRetryableFetchError) {
    return NextResponse.json({ error: "service-unavailable" }, { status: 503 });
  }

  const claims = data?.claims;
  if (error || !claims || !claims.sub) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return { userId: claims.sub, supabase, refreshed };
  ```

  **步骤 3** — 同步更新 `session.ts:37-44` 的状态契约注释，把 503 的触发条件补全为「`getClaims` 抛出，**或** 返回 `AuthRetryableFetchError`」。

- **复验命令**:
  ```bash
  npx tsc --noEmit && npx eslint && npm run build
  ```
  手工复验：把 `NEXT_PUBLIC_SUPABASE_URL` 指向不可达主机后 `curl -i localhost:3200/api/overview`，期望 `503` + `{"error":"service-unavailable"}`；恢复后无 cookie 期望 `401` + `{"error":"unauthenticated"}`。

---

## 3. 非阻塞缺陷（建议同轮修，不阻塞提交之外的判断）

### [WP6-03] P2 · 禁忌守卫可被模板插值绕过，且不覆盖 CSS

- **文件**: `eslint.config.mjs:62`（`files: ["src/**/*.{ts,tsx,js,jsx}"]`）、`:106-112`（只挂 `Literal` / `TemplateElement`）
- **实跑证据**（反例探针，写入后已删除）:
  ```tsx
  const RAMP = "zinc";
  export const C = () => <p className={`text-${RAMP}-500`}>x</p>;
  ```
  → `messages: 0`（**未拦截**）。规则文档声称能拦「模板字符串中的禁忌类名」，`test:taboo-guard` 的第 12 项只覆盖了**字面量**在模板里的情况（`` `border-red-500 text-ink` ``），未覆盖**插值**。
  另：`src/app/globals.css` 不在 `files` 内，ESLint 直接 `File ignored because no matching configuration was supplied`。
- **为什么重要**: 这是 D-25 唯一的执行机制。当前实现能挡住 99% 的手写失误（动态拼类名在本项目里几乎不出现），但「机器强制」的措辞略强于实际能力。
- **修复步骤（二选一，10 分钟内可完成）**:
  - **轻量**：把 `eslint.config.mjs` 头注释里「Machine-enforced version of DESIGN.md §十一」改为如实描述，并补一句已知边界：动态拼接的类名与 `.css` 文件不在扫描范围。**推荐这条** —— 与其加一条覆盖不到的规则，不如把契约写准。
  - **彻底**：在 `scan()` 里对 `TemplateElement` 额外检测「相邻 quasi 之间存在 `${` 且该表达式标识符可在同文件解析为禁忌色名」的情况；并把 `globals.css` 纳入一个用 `no-restricted-syntax` 无法覆盖的补充检查（需引入 `postcss-value-parser`，成本较高，不建议本轮做）。

### [WP6-04] P2 · 测试恰好绕开了 [WP6-01] 的风暴场景

- **文件**: `src/lib/api/api-cache.test.ts:51-67`（`reset() drops the payload and a live subscriber refetches`）
- **为什么是缺陷**: 该测试断言「`reset()` 后活着的订阅者**必须**重新取数」—— 这条断言**正是 [WP6-01] 风暴的成因之一**。测试是对的（对 sign-out 场景），但缺少「session-lost 场景不得重取」的对偶用例，导致 44 项全绿却漏掉 P0。
- **修复步骤**: 随 [WP6-01] 步骤 4 一并补上对偶用例即可（已给出代码）。

---

## 4. 五维详细记录（含正面结论）

### 维度 1 · 正确性

**通过项（逐条实测）**

- **模块作用域 Map 会不会在 RSC 里跨请求串数据？—— 不会，已证实。**
  `use-api-data.ts:1` 是 `"use client"`，`cache` 只在客户端 bundle 实例化。实测 `grep -rl "createApiCache" .next/server/ --include="*.js"` → **空**（只命中 `.js.map` sourcemap，不进服务端产物）。且 `curl http://127.0.0.1:3200/` 的静态 HTML 中 `grep -oE '¥[0-9,]+\.[0-9]{2}'` → **空**，无任何账务数据随 SSR 落盘。**结论：无跨请求污染。**
- **[D-14] 竞态**：`startFetch` 的 `seq` 单调 + `commit` 的 `entry.seq !== seq` 丢弃（`api-cache.ts:137`）+ `dropEntry` 也 `seq += 1`（`:108`），三重保险。测试「5 次 reload 落在 #6」「忽略 abort 信号的旧请求也不覆盖新数据」均为**具体值断言**，非拄本自比。
- **[D-32] LRU+TTL**：`evictIfNeeded` 按 `lastAccess` 排序且跳过有订阅者的 path（`:150`）；上限在 insert 时执行（`:125`）而非惰性。测试「200 组合后 size ≤ 100」「TTL 到期 swept=100 size=0」有效。
- **[D-31] render 纯度**：`peek` 只读 + 返回冻结的 `EMPTY_SNAPSHOT`，缺失 path 时快照 identity 稳定（测试 `assert.equal(cache.peek("/api/a"), cache.peek("/api/b"))` 通过）—— 这条对 `useSyncExternalStore` 是**硬要求**，做对了。
- **内存泄漏 / 订阅者计数**：`subs` 在最后一个监听者退订时 `delete`（`:248`），`entries` 由 TTL + LRU 双重封顶。未见泄漏。
- **[D-33] `readServerError` 中文过滤会误吞吗？—— 不会误吞真实文案，但规则本身偏窄。**
  实跑 11 个样本：`unauthenticated` / `service-unavailable` / `Invalid JWT signature` 全部正确丢弃；四条 route 的 502 中文文案全部保留。**边界**：`/[一-鿿]/` 只覆盖 U+4E00–U+9FFF（表意文字），**不含中文标点**（实测 `，` U+FF0C、`。` U+3002、`；` U+FF1B、`！` U+FF01、`？` U+FF1F、`「` U+300A 均 `in-range=false`）。当前所有真实文案都含表意文字，故**实际无误吞**；仅当某条错误文案纯标点时才会被丢。判为可接受，记此备查。
- **[D-37] 删掉 skipWaiting 后更新流程是否可用？—— 可用，三路检测齐全。**
  `service-worker-register.tsx` 覆盖 ①`reg.waiting` 已存在（`:30`）②`updatefound` → `statechange` → `installed && controller`（`:36-42`）③其他标签页换主 → `controllerchange`（`:56-58`）。`SKIP_WAITING` 字符串在 `sw.js:50` 与 `service-worker-register.tsx:79` **完全一致**（已 grep 比对）。cleanup 移除全部三个监听器 + `load` 一次性监听（`:67-72`），无泄漏。
- **[D-36] 缓存策略安全性**：`/api/*` 不会被缓存 —— fetch handler 的四条分支（navigate / icon+manifest / static prefix / RSC 短路）**没有任何一条匹配 `/api/*`**，因此 `event.respondWith` 不介入，`/api/*` 走浏览器默认网络栈。`isCacheableResponse` 只在 `networkFirstNavigation` 内被调用（`:122`），作用面仅限 5 个静态壳页面。四个页面实测 `Cache-Control: s-maxage=31536000`，**不含 `no-store`/`private`**，故会被存入 Cache Storage —— 但它们是**无数据的静态壳**（已验证 HTML 中无金额），不构成会话泄露。`/login` 由 `sw.js:113` 显式排除。

**不通过项**：见 [WP6-01]、[WP6-02]。

### 维度 2 · 安全

- `resetApiCache` 调用点核查（`grep -rn`）：`site-nav.tsx:102`（主动登出，**已在 `await signOut()` 之前**调用，注释说明了为何必须在 await 前——signOut 抛错时用户仍登录态，先清最安全，逻辑正确）+ `client.ts:69`（401 分支，跳转前清除）。**两条路径均已闭合，D-01 的最后一块拼图已由 WP-1 补上，本包该项可判定为完成。**
- xlsx 0.20.3：`package.json:27`、`package-lock.json:21,8018`、`npm ls xlsx` → `xlsx@0.20.3` **三处一致**。20MB 上限在 `file.arrayBuffer()` **之前**（`import-parse.ts:256` 先查 `file.size`），且 `:262` 有 `assertFileSize(buf.byteLength)` 二次兜底（防 `file.size` 撒谎）。`import("xlsx")` 动态导入在大小检查之后。
- 未发现硬编码密钥、反序列化、路径穿越。

### 维度 3 · 可访问性

- `ChartFigure`（`dashboard-charts.tsx:96-105`）DOM 结构**符合 D-09 验收标准**：
  ```jsx
  <figure>
    <div role="img" aria-label={label} aria-describedby={summaryId}>{children}</div>
    <figcaption id={summaryId} className="sr-only">{summary}</figcaption>
  </figure>
  ```
  `figcaption` 是 `role="img"` 的**兄弟节点**，不在其子树内 → 不会被 presentational 化；`aria-describedby` 指向它 → 读屏会播报数据摘要。三处调用点（`TrendChart:118` / `AssetChart:151` / `ShareChart:212`）全部走 `ChartFigure`；无数据时退回无 `role` 的 `<figure>`，不会播报空图。
  > 注：本环境 Chrome 无法启动（`Chrome exited early, exit code 3`），未能做真机 NVDA/VoiceOver 播报验证；结论基于 DOM 结构静态核验。
- SW 更新提示：`role="status"`（隐含 `aria-live="polite"`）+ 两个 `<button>`（原生可聚焦、可键盘操作）+ 文案动词在前（「刷新」「稍后」）。`fixed inset-x-0 bottom-0` 不遮挡主内容。**无 a11y 缺陷。**
- 对比度：`AXIS_LINE` 已从 `var(--color-fogline)`（mist 上 1.39:1）改为 `var(--color-dim)`（≥3:1），`GRID` 保留雾线作装饰 —— D-28 判定**正确**，区分了功能性轴线与装饰性网格。

### 维度 4 · 代码质量与文档

- **eslint 守卫有效性（反向验证，非仅看自测脚本通过）**：
  - 对照组（`panel / border-fogline / text-ink / text-ember / .money`）→ **0 误报**。
  - 11 项违规（zinc/slate/neutral/red-500/blue-600/indigo-500/`dark:`/tailwindcss-colors import/window.confirm/模板字面量）→ **全部命中**。
  - 负例（`darkness-500`、`archived:bg-veil`）→ **正确不误报**，证明 lookbehind 有效。
  - 真实项目文件跑 `npx eslint` → 零 error 零 warning，无误伤。
  - 已知边界见 [WP6-03]。
- **`ts-resolve-hooks.mjs` 脆弱性评估（施工 agent 自认的 hack）**：
  - **正确性**：✅ 优秀。`remap()` 只在 **`.ts` 目标真实存在时**才改写（`:45` 的 `existsSync`），写错的路径照常抛真错 —— 不会把「拼写错误」伪装成「静默跳过」。`parentURL` 非 `file:` 一律放行。同步 `registerHooks` 与异步 `register` **共用同一段 `remap` 逻辑**（`:42`），不会两条路径行为漂移。
  - **Node 版本升级风险**：**低**。`module.registerHooks` 是同步 API，若未来移除，回退分支 `moduleApi.register` 仍在；两者逻辑同源。`--experimental-strip-types` 在 Node 23+ 已稳定，Node 26.7（本机实跑）仍需该 flag 但行为一致。
  - **更轻的正解？** 有，但没有更好。改测试文件为 `./x-cache.ts` 需要 `allowImportingTsExtensions`（tsconfig 不在本包所有权，且会把测试关注点泄漏进应用编译配置）；`new URL()` + 动态 `import()` 会丢掉静态类型。**放在解析层是正确选择，判定：接受，不算缺陷。**
- **文档一致性（D-39）**：脚本提取 STRUCTURE.md 全部反引号路径逐条 `test -e`，**0 失效**。初筛的 21 个「缺失」经复核**全部是我正则的假阳性**（裸文件名如 `sw.js`→`public/sw.js`、`overview-client.tsx`→`src/app/overview-client.tsx`、npm 包名、路由名）。`middleware.ts` 的两处提及是「**Next 16 已改名为 `src/proxy.ts`**」的正确说明（`src/proxy.ts` 实测存在），非失效条目。README 功能列表与 5 条实际路由一致。**判定：通过。**

### 维度 5 · 测试

亲跑：`npm test` 44/44、`test:taboo-guard` 12/12、`test:api-cache` 全通过。
**测试有效性审查**（是否假通过）：
- `api-cache.test.ts` 全部使用 `assert.equal` / `assert.notEqual` / `assert.deepEqual` 对**具体值**断言 —— 如「5 次 reload 后 data = #6」「`lastResolved === 1` 证明最慢的确实最后 resolve」「`completed === 1` 证明 4 个被取代」「`rejections` 为空数组」。**无「拄本与拄本一致」式空断言。**
- `stats.test.ts` 覆盖 `accountBalances` 转账分支、`monthlyTrend` 丢弃窗口外数据、`assetCurve` 前置日并入期初总额等，均为行为断言。
- **但**：见 [WP6-04]，缺少 session-lost 静默复位的对偶用例，导致 P0 漏网。这是**覆盖缺口**而非**断言造假**。

---

## 5. 施工 agent 自认未完成项 · 逐条判定

| # | 项 | 判定 |
|---|---|---|
| 1 | **D-01 跨账号泄露最后一块拼图** | ✅ **已闭合**。`site-nav.tsx:102` 已有 `resetApiCache()`，且位置正确（在 `await signOut()` 之前，附完整理由注释）。**WP-6 自身判定为完成**，无需再接线。`setApiCacheOwner` 仍未接线，但它是可选的第二道防线，非必需 |
| 2 | **测试基建靠 hack（ts-resolve-hooks）** | ✅ **接受**。`existsSync` 守卫 + 双实现同源逻辑，Node 升级风险低；替代方案都更差。详见维度 4 |
| 3 | **D-35 LIKE 元字符未转义** | ✅ **归属 WP-3 正确**。实跑 `grep` 确认 `src/app/api/data/route.ts:22 escapeOrValue` 只转义 `\` 与 `"`，`:99-100` 的 `%${filter.q}%` 确实原样透传 `%`/`_`。该文件属 WP-3（`src/app/data/**` + `api/data/route.ts`）。**接线说明**：在 `escapeOrValue` 之后、`%${q}%` 拼接之前，对 `q` 先做 LIKE 元字符转义（`%`→`\%`、`_`→`\_`，PostgREST 的 `ilike` 需配合转义后的反斜杠），并补一条 `?q=%25` 返回 0 笔的用例 |
| 4 | **D-11 acc/cat UUID 校验未做** | ✅ **归属 WP-3 正确**。`route.ts:55-56` 实测 `category: sp.get("cat") ?? undefined` / `account: sp.get("acc") ?? undefined`，无任何 UUID 正则（`grep UUID_RE` 0 命中）。**接线说明**：`route.ts:9` 附近加 `const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`，`:55-56` 改为不匹配即 `undefined`（丢弃条件而非报错），`cat` 额外放行 `"none"` |
| 5 | **D-03 xlsx 升级核实** | ✅ **全部核实通过**。`npm ls xlsx` → `0.20.3`；package.json / package-lock.json / node_modules 三处一致；20MB 上限在 `arrayBuffer()` **之前**（`import-parse.ts:256`）且有二次兜底（`:262`）；`import("xlsx")` 动态导入在检查之后。新版本 API（`XLSX.read` / `sheet_to_json`）用法未变，兼容 |
| 6 | **D-15 as unknown as 数量核实** | ✅ **数量核实：代码中 3 处，注释中 4 处**。真实代码残留全部集中在 `src/app/ledger/ledger-client.tsx:56,59,63`（PostgREST 一对多返回形状硬转），属 **WP-4**。`overview-client.tsx:328` 与 `settings-client.tsx:51` 的注释明确声称已清零（实测其文件内确无真实断言）。**接线清单**：WP-4 需清 `ledger-client.tsx` 的 3 处，建议抽一个 `relationName<T>(v): string | null` 工具函数（数组取 `[0]`、对象直取、其余 `null`），一次消掉三处重复的三元表达式 |
| 7 | **D-39 文档与代码一致性抽查** | ✅ **通过（超出 10 条）**。脚本逐条核验 STRUCTURE.md 全部反引号路径，**0 失效**；`middleware.ts` 的提及经核实是 Next 16 改名的正确说明；README 与 5 条实际路由一致 |
| 8 | **bench 从未实跑** | ✅ **本轮已实跑**。见下方注 |

**Bench 实跑说明（如实记录）**：`npm run bench -- --base http://localhost:3200` 真实执行，输出表格 9 行、API 四行标注 **`401(auth)`**、底部打印 `--cookie` 提示、超阈值逐条列出并 `exit 1`。D-38 的三项要求（401 标注 / warmup / `--json` + 阈值）**均已验证存在且工作**。

> **阈值为何全部超限**：报出的 p95 ≈ 2.4s 看似严重，但**与被测服务无关**。已用对照实验证伪：用一个只返回 `<h1>ok</h1>` 的 8 行 Node http server 复现同样数字（紧循环 1-2ms，插入 100ms 间隔后跳到 378-2418ms）；而 `curl` 直连同一 Next 服务仅 4-16ms，Node `fetch` 紧循环亦仅 6-8ms。**成因是 Windows 环回 + Node undici 在请求间存在 ~100ms 空档时的连接行为**，非 MistLedger 缺陷。
> **建议（不阻塞）**：`bench.mjs:99` 的 `await new Promise(r => setTimeout(r, 100))` 间隔是触发条件。若要让 bench 在 Windows 本机可用，应改为可配置间隔（`--gap`，默认 0）或改用 keep-alive agent。**注意：脚本的默认 base 是 `:3000`**，本轮服务跑在 `:3200`，故必须显式传 `--base`，否则直接 ECONNREFUSED 退出 1 —— 这一点值得在 STRUCTURE.md 的验证流程里写明。

---

## 6. 结论

**不予提交。** 五维中「正确性」不通过（[WP6-01] P0、[WP6-02] P1），按判定规则任何一维不通过即不准提交。

修复上述 2 个阻塞缺陷后，请重跑：

```bash
npm test && npm run test:taboo-guard && npm run test:api-cache && npx tsc --noEmit && npx eslint && npm run build
```

全部转绿后即可按显式路径 `git add` 提交。**[WP6-03] / [WP6-04] 建议同轮处理**（WP6-04 随 WP6-01 一并解决；WP6-03 至少把注释改准确）。

**本审核员未执行任何 `git add` / `git commit`，未修改任何业务代码**（仅在仓库根临时写入探针文件用于验证，均已 `rm` 删除；`git status` 已确认工作区无残留探针）。
