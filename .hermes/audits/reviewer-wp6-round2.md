# WP-6 复审报告 · 第二轮（独立复审）

- 审核基线：`faca76b`
- 审核人：WP-6 复审审核员（第二轮，独立复审）
- 结论：**不通过 —— 1 个阻塞缺陷（护栏自测自身失败）+ 2 个非阻塞缺陷，不予提交**
- git 写操作：**本轮未执行任何 `git add` / `git commit`**（仅删除我自己的临时探针）

---

## 0. 必读材料 · 一处缺失

| 文件 | 状态 |
|---|---|
| `.hermes/audits/reviewer-wp6.md` | ✅ 已读（第一轮打回报告，基线 `2447d67`） |
| `.hermes/audits/wp6-fix-round2.md` | ✅ 已读（返工报告） |
| `.hermes/audits/wp6-guard-round3.md` | ❌ **不存在**。`ls .hermes/audits/` 全量 23 个文件，无此文件。任务描述称其为「护栏加固报告」，但该轮加固的证据只存在于 `eslint.config.mjs` 自身的注释与 `scripts/check-taboo-guard.mjs` 的用例里，没有独立报告。**本报告据代码与实跑证据独立判定，不依赖该文件。** |

---

## 1. 五维结论表

| 维度 | 结论 | 关键证据 |
|---|---|---|
| **1. 正确性** | ✅ 通过 | [WP6-01] **独立实测：修复后 4 个 panel 恰好 4 次请求；对照组 3 秒内 20004 次请求、撞探针上限不收敛。** [WP6-02] 11 个「真·未认证」样本全部 401、5 个「上游故障」样本全部 503、3 个合法会话全部 OK，**零误判**。session.ts 状态契约与原行为一致 |
| **2. 安全** | ✅ 通过 | `/api/*` 四条路径经 `isStaticAsset` 逐条实测 `false`，**完全不进 Cache Storage**。`isCacheableResponse` 只在 `networkFirstNavigation` 内生效。`setApiCacheOwner` 已删且不留悬空导出。**唯一问题见 [R2-02]（产物卫生，非安全）** |
| **3. 可访问性** | ✅ 通过 | `ChartFigure`（`dashboard-charts.tsx:96-104`）DOM 正确：`<figcaption>` 是 `<div role="img">` 的**兄弟**节点，不在 presentational 子树内；`aria-describedby` 指向 `useId()`。SW 更新条 `role="status"` + 两个原生 `<button>`。**本机 Chrome 无法启动（exit 3），未做真机读屏播报验证 —— 基于 DOM 静态核验** |
| **4. 代码质量与文档** | ❌ **不通过** | **[R2-01] 护栏自测自身失败：`npm run test:taboo-guard` 退出码 1**，「构造·map 回调体内拼接」用例实测逃逸。这是仓库自带的回归防护在自己报告失败 |
| **5. 测试** | ⚠️ **有条件通过** | 变异测试 **6/8 杀灭**。[WP6-04] 主体闭合。**[R2-03] M4 存活**（`client.ts` 的 503 分支可整段删除而全绿），[R2-04] M6 为等价变异体 |

---

## 2. 逐条缺陷复审

### [WP6-01] P0 · 401 自激请求风暴 —— ✅ **已闭合**

#### (a) 测试有没有被做弱？—— 没有

- **控制组仍在**：`401-storm.test.ts:92-100`「对照组：修复前的接线不收敛」，断言 `before.requests >= CONTROL_CAP`（200），即**要求它必须撞上限**。
- **cap 没有被人为调小来伪造收敛**：`CONTROL_CAP = 200`，而返工方自报对照组实测 **8004** 次。cap 从 2000 降到 200 **不影响任何断言**（断言是 `>=`，不是 `==`），只省时间。`api-cache.test.ts:86-106` 另有一条独立控制组，断言 `calls > 20`。
- **实验组断言具体值**：`assert.equal(after.requests, PANELS.length)` —— 恰好 4，等于 panel 数（理论下界），不是 `assert.ok(< 某阈值)`。

#### (b) 我自己另写的独立探针 —— 实测数字

探针：`%TMPDIR%/wp6-reviewer-storm-probe.mjs`（仓库外，跑完保留在 scratch）。**驱动真实模块** `client.ts` + `api-cache.ts`，只 stub `fetch` 与 `window.location.replace`。

```
[D] use-api-data.ts wires cache.reset({ silent: true }) : true
[A] control (non-silent), 3s window, cap 5000
      requests=20004  redirects=5000  hitCap=true  size=4
      => DID NOT CONVERGE (ran into the probe cap)
[B] fix arm (silent), 3s window, no cap
      requests=4  redirects=4  size=0
      => BOUNDED at one request per panel
[C] drift control, 1s window, cap 3000  -> requests=12004 redirects=3000 hitCap=true
      => probe discriminates: YES
[E] single panel, production seam: requests=1 sessionLostFires=1 size=0

VERDICT silentWired=true fixArmBounded=true
ALL CHECKS PASSED
```

**我的实测数字：修复后 4 次请求（= panel 数，理论下界）；对照组 3 秒 20004 次且撞上限。** 与返工方自报的 4 / 8004 同量级，方向一致。臂 C 证明探针有区分力（不是恒返回 4 的空探针）。臂 E 证明静默路径走的是真实 `apiGet` 的 401 分支，不是 stub。

> 补充观察：第一次跑臂 C 时我**没设 cap**，Node 直接 `FATAL ERROR: Ineffective mark-compacts near heap limit`（4GB 堆耗尽）。这本身就是「该循环无上界」最硬的证据 —— 2 秒静置窗口内就把 V8 堆吃干净了。

#### (c) 接线审查 —— **当前正确，但机制在、接线曾被回退**

**当前状态**：`src/lib/api/use-api-data.ts:23`

```ts
setSessionLostHandler(() => cache.reset({ silent: true }));
```

**已复核为正确**。上方 6 行注释（`:18-22`）与代码现在一致，`silent: true` 在位。

**回退原因判断：并行覆盖，不是有意改动。** 证据链：

1. **git 全历史无此状态**：`git grep "setSessionLostHandler(() => cache.reset())" $(git rev-list --all) -- src/lib/api/use-api-data.ts` → **空**。这个非静默接线**从未被任何 commit 记录过**，只存在于工作区，因此不可能是某次有意的提交级改动。
2. **无提交可回退**：`src/lib/api/use-api-data.ts` 的最近一次提交是 `206de52 feat(api): cookie-session route handler data layer`，那是**本轮之前**的旧架构（文件里还是内联 `entries` Map，不是 `createApiCache`）。本轮全部改动都在**未提交的工作区**里。
3. **`.r2bak` 备份文件就在旁边**：`src/lib/api/use-api-data.ts.r2bak`（mtime `15:39:06`），内容与当前文件**除行尾符外完全一致**（`diff <(tr -d '\r' …)` 无输出）。当前文件 mtime `16:36:34`。**说明有人（很可能就是我自己上游的那次并行改写）用「复制一份备份再原地编辑」的手法改过这个文件，而备份文件被遗忘了。**
4. **注释与代码脱节是覆盖的典型指纹**：注释「[WP6-01] `silent: true` is mandatory here, not an optimisation」是返工方写的、有 `client.test.ts:153-162` 的源码匹配断言守着。**有意回退的人不会留下矛盾注释，更不会留下会当场变红的断言。**
5. **断言确实能抓到**：我独立复现了这条变异（M1，见 §4）—— 把 `cache.reset({ silent: true })` 改成 `cache.reset()`，`npm test` 立刻 `pass 42→41, fail 0→1`。

**结论：这是流程漏洞，不是笔误。** 具体形态：多个 agent 并行写同一个未提交文件 → 「备份 + 原地改写」的手法 → 备份文件（`.r2bak`）遗留在源码树里 → 中间某一版把接线退回非静默，而守着的断言在**下一次有人跑 `npm test` 之前**没被触发。护栏（`client.test.ts:153-162` 的源码匹配）是有效的，它**抓到了**这次回退 —— 问题是**发现得太晚**：靠人偶然跑测试，而不是靠 CI 门禁。**建议：把 `npm test` 挂进 pre-commit / CI，否则这类回退只能靠运气发现。**（本轮我已复现该断言有效，见 [R2-03] M1。）

---

### [WP6-02] P1 · 503 分流 —— ✅ **已闭合，零误判**

#### (a) 判定顺序 —— ✅ 正确

`session-outcome.ts:59-64`：

```ts
if (isAuthRetryableFetchError(error)) {        // :59  先
  return { ok: false, status: 503, code: "service-unavailable" };
}
if (error || !claims?.sub) {                    // :62  后
  return { ok: false, status: 401, code: "unauthenticated" };
}
```

**顺序正确**，且 `session-outcome.test.ts:50-60` 不是靠 mock 而是先断言 `error instanceof Error === true`（即朴素写法必然误判），再断言结果为 503 —— 顺序一旦调换，这条**必然**变红。我用变异 M3 独立复现：调换顺序 → `pass 42→39, fail 0→3`。

#### (b) 有没有把真·未认证误判成 503 —— **没有。19 个样本实测，零误判**

我构造了真实 auth-js 错误类（不是 mock）：

| 类别 | 样本 | 结果 |
|---|---|---|
| **必须 401**（11 个） | 无 cookie / claims 无 sub / `sub:""` / `AuthSessionMissingError` / `AuthInvalidCredentialsError` / `AuthApiError 401` / `AuthApiError 400` / `AuthWeakPasswordError` / 普通 `Error` / `TypeError` / 字符串错误 | **11/11 = 401** ✅ |
| **必须 503**（5 个） | `AuthRetryableFetchError`（status 0 / 500 / 503 / 附带过期 sub）/ 深路径 `@supabase/auth-js` 同名类 | **5/5 = 503** ✅ |
| **必须 OK**（3 个） | 合法 claims / 数字 sub 被 `String()` 强转 / 带额外字段 | **3/3 = OK** ✅ |

**误判风险结论：无。** 关键机制我进一步核实了 —— `isAuthRetryableFetchError` 的实现是
`isAuthError(error) && error.name === 'AuthRetryableFetchError'`（`node_modules/@supabase/auth-js/dist/module/lib/errors.js:222-224`），**基于 `name` 而非 `instanceof`**。这很重要：`@supabase/supabase-js` 与 `@supabase/auth-js` 两份构建产出的**类对象不是同一个**（我实测 `AuthRetryableFetchError === DeepRetry` 为 `false`），如果规则写成 `instanceof`，深路径那条会漏判。**用公开导出的 `isAuthRetryableFetchError` 而非 `instanceof` 是正确选择，且天然免疫重复模块实例。**

#### (c) 抽离后 session.ts 行为与原先一致 —— ✅

`session.ts:78-82` 用 `failure.status` / `failure.code` 拼 `NextResponse.json({error}, {status})`，与原先的 `{error:"unauthenticated"}, {status:401}` 字面量**逐字节等价**。`session.ts:46-51` 的状态契约注释已按审核员步骤 3 补全（同时描述 throw 与 return 两条 503 路径）。**`isApiSession` 判别式未受影响**（仍靠 `instanceof NextResponse`）。

---

### [WP6-03] P2 · eslint 禁忌守卫 —— ⚠️ **主体闭合，但存在逃逸，且** 🔴 **自测自身失败（阻塞）**

#### 我自己造的新一批反向攻击 —— 逐个实测

方法：每个用例**单独建文件**跑 `npx eslint`（避免多行文件的行号归属误判 —— 我第一版把 30 个用例塞一个文件，`diff` 行号偏移导致 5 个假逃逸，隔离后其中 3 个是**被拦住的**）。所有探针已删除。

**被拦下（30 个攻击中的绝大多数）：**

| 攻击路线 | 结果 |
|---|---|
| `+` 拼接（第一轮那个原始逃逸） | ✅ CAUGHT |
| 模板插值 `text-${RAMP}-500` | ✅ CAUGHT |
| `satisfies` / `as` 载体 | ✅ CAUGHT |
| const 对象成员 `TONE.ramp`、计算成员 `TONE["r"]` | ✅ CAUGHT |
| const 数组下标 `K[1]` | ✅ CAUGHT |
| 数组字面量 `.join("")`、const 数组 `.join("")` | ✅ CAUGHT |
| `String.raw`（含 / 不含插值） | ✅ CAUGHT |
| 右括号嵌套、括号内嵌、`+` 里嵌模板、模板里嵌 `+` | ✅ CAUGHT |
| `\|\|` 右臂、条件表达式**未走到分支** | ✅ CAUGHT |
| `cn(...)` 包裹、双层 `cn(cn(...))` | ✅ CAUGHT |
| 箭头函数体内拼接 | ✅ CAUGHT（报 `unresolvable`） |
| 对象属性 `{ class: ... }` 形式、**计算属性名** `["cl"+"assName"]` | ✅ CAUGHT |
| 变量间接引用（两跳 const） | ✅ CAUGHT |
| token 拆成三段字面量 `"te"+"xt-zi"+"nc-500"` | ✅ CAUGHT |
| `dark:` 经拼接 | ✅ CAUGHT |
| 非 className 位置（`data-x=`） | ✅ CAUGHT |
| `Object.keys(m).map(f).join(" ")` | ✅ CAUGHT（报 `unresolvable`） |
| IIFE `(function(){return "text-"+B+"-500"})()` | ✅ CAUGHT |
| `Object.freeze("text-"+B+"-500")` | ✅ CAUGHT |
| `let` 重赋值（报 `unresolvable`） | ✅ CAUGHT |

**逃逸（真实口子）：**

| # | 逃逸用例 | 说明 |
|---|---|---|
| E1 | `["text-zinc", "500"].map((s) => s).join("-")` | **`.map()` 出现在 `.join()` 之前即失效**。同样逃逸的变体：`.filter(f).join()`、`.reduce(...)`、纯 `.map()` 不接 join。**这就是 [R2-01] 那个红灯用例** |
| E2 | `"text-" + BASE + "-" + 500`（**数字色阶**） | `resolveStaticString` 对 `Literal` 只在 `typeof value === "string"` 时返回值，数字 `500` 变洞。`"-" + 500` 拼不出 `-500` 的正则形态。`500 as number`、三元 `(on?500:600)` 同样逃逸 |
| E3 | `cn(...K)`（K 为 const 数组，元素是拆开的片段） | `collectSegments` 遇 `SpreadElement` 直接 `return null` 整条放弃。**注意：内联数组 `cn(...["text-","zinc","-500"])` 反而被拦**（`Literal` 访问器兜住了），只有**跨 const 的展开**才漏 |
| E4 | `{...M}.a + {...M}.b` | 对象展开不在 `CLASS_REGION_NODES` 里 |
| E5 | `[...K].join("")`、`[[...]].flat().join("")`、`K.join("").toUpperCase()` | 数组方法链 / 方法链后缀 |

**误报（对照组）：** 干净。`text-ink` / `border-fogline` / `darkness-500` / `archived:bg-veil` / `text-${BASE}-ember` 全部不报。**唯一一处「误报」实为正确**：`{"text-" + BASE + "-100"}` 报了 grayscale —— `text-zinc-100` 确实是 Tailwind 真实类名且确实在禁用灰阶里，**报得对**。

**`.css` 边界**：`files` 仍是 `["src/**/*.{ts,tsx,js,jsx}"]`，`globals.css` 不在扫描范围。这**已如实写进 `eslint.config.mjs:19-52` 的「Known boundaries」章节**，措辞准确（不再声称 machine-enforced 覆盖一切）。判定：**接受**，符合审核员第一轮给的「轻量方案」。

---

### [WP6-04] P2 · 测试覆盖 —— ⚠️ **主体闭合，一处覆盖缺口**

见 §4 变异测试。8 个变异体杀灭 6 个。

- **[WP6-04] 原缺口已闭合**：401 风暴对偶用例在 `api-cache.test.ts:69-84` + `:128-138` + `401-storm.test.ts` 三个层次都在，且**带对照组**。
- **[R2-03] 残留缺口**：`client.ts:75-78` 的 503 分支可整段删除而测试全绿（M4 存活）。原因见 §4 分析。
- **[R2-04] M6 是等价变异体**，不是覆盖缺口 —— `dropEntry` 里 `entry.snap = EMPTY_SNAPSHOT` 之后紧跟 `entries.delete(path)`，entry 已从 Map 移除，快照清不清都不可观测。**不构成缺陷**，记录备查。

---

## 3. 阻塞缺陷

### 🔴 [R2-01] P1 · 禁忌守卫的自测脚本自身失败，且失败的是一个真实逃逸

- **文件**：`scripts/check-taboo-guard.mjs:228-232`（用例定义）、`eslint.config.mjs:399-428` + `:249-254`（根因）
- **实跑证据**（`npm run test:taboo-guard`，真实退出码）：

```
  ✗ 构造·map 回调体内拼接（整串在箭头函数里组装） —— lint 未报错，实际输出：
      （无任何 ESLint 报错 —— 守卫失效）
  ...
结果：1 个守卫未生效
REAL_EXIT=1
```

同一文件里 40 个用例，**39 个 ✓、1 个 ✗**。**这是仓库自带的回归防护在报告自己失败**，而返工报告 §5 声称 `TABOO_EXIT=0`。注意 npm 会把 `TABOO_EXIT` 吞掉（`npm run` 自身返回 0），必须直接看脚本退出码才能发现。

- **为什么是缺陷（两层）**：
  1. **逃逸是真的**。我隔离复现：`["text-zinc","500"].map((s)=>s).join("-")` → 零 ESLint 消息。同族逃逸：`.filter(f).join()`、`.reduce()`、纯 `.map()`。
  2. **更严重的是流程**：一个断言「这条必须被拦住」的守卫用例**处于失败状态被提交**。要么是这轮加固没跑完就交报告（`wp6-fix-round2.md` §5 的 `TABOO_EXIT=0` 与实际不符），要么是明知红灯仍交付。**无论哪种，「机器强制」的声明当前不成立。**
- **根因（已定位到行）**：`collectJoinSegments`（`eslint.config.mjs:261-291`）第 267 行调用
  `resolveConstArray(node.callee.object, scope)`。对 `X.map(f).join(sep)`，`node.callee.object` 是 **`X.map(f)` 这个 CallExpression**，不是 ArrayExpression；`resolveConstArray`（`:249-254`）只接受 `Identifier` 或 `ArrayExpression`，于是返回 `null` → `collectJoinSegments` 返回 `null` → 回落到通用 `CallExpression` 分支（`:411-426`），而该分支**只遍历 `node.arguments`**，`.map(f)` 藏在 `callee.object` 里，**永远走不到**。整个数组的内容因此从未被扫描。
- **精确修复步骤**：

  **步骤 1** — `eslint.config.mjs`，在 `resolveConstArray`（`:249-254`）之前新增一个解包函数，把「数组上的纯映射方法链」剥掉：

  ```js
  /**
   * `X.map(f).filter(g).join(sep)` — the array is still statically knowable, but
   * it is no longer the direct `callee.object`, so `resolveConstArray` cannot
   * see it. Peel array-method calls off the front. A method whose callback
   * cannot be folded is NOT unwrapped: `X.filter(pred)` may drop elements, so
   * the surviving set is unknown and the honest answer is still a hole.
   */
  function peelArrayMethods(node, scope, depth) {
    let current = node;
    // Bound the peel so a pathological chain cannot spin.
    for (let hops = 0; hops < 8; hops++) {
      if (current.type === "Identifier" || current.type === "ArrayExpression") {
        return current;
      }
      if (current.type !== "CallExpression") return current;
      const callee = current.callee;
      if (callee.type !== "MemberExpression" || callee.computed) return current;
      const method = callee.property.name;
      const passthrough = method === "map" || method === "flat" || method === "slice";
      const filtering = method === "filter" || method === "reverse" || method === "sort";
      if (!passthrough && !filtering) return current;
      // `.map(f)` is only order-preserving-and-complete when f is the identity;
      // `[a,b].map(x => x)` is, `[a,b].map(x => x + "!")` is not a join of the
      // original pieces. Require a provably identity callback, else stay a hole.
      if (method === "map") {
        const callback = current.arguments[0];
        if (!callback || (callback.type !== "Identifier")) return current;
        // `x => x` (single param, body is that same param) is the only fold
        // we accept without evaluating the callback.
        if (callback.body.type !== "Identifier" || callback.body.name !== callback.params[0]?.name) {
          return current;
        }
      }
      if (current.arguments.length > 1) return current;
      current = callee.object;
    }
    return current;
  }
  ```

  **步骤 2** — `eslint.config.mjs:267`，把
  ```js
  const elements = resolveConstArray(node.callee.object, scope);
  ```
  改为
  ```js
  const elements = resolveConstArray(peelArrayMethods(node.callee.object, scope, depth), scope);
  ```
  并让 `resolveConstArray`（`:251`）也接受解包后的节点：
  ```js
  const target =
    node.type === "Identifier" ? resolveConstInitializer(node.name, scope) : node;
  if (!target || target.type !== "ArrayExpression") return null;
  return target.elements;
  ```
  （`peelArrayMethods` 已在返回前保证是 Identifier 或 ArrayExpression，故此处无需再改逻辑。）

  **步骤 3** — 复跑 `npm run test:taboo-guard`，确认
  `构造·map 回调体内拼接` 转 ✓，且
  `构造·map 回调体内槽位拼接（报无法静态解析）`（`check-taboo-guard.mjs:234-238`）**仍报 `无法静态解析` 而非被误判为已解析** —— 这一步很重要，它证明修复没有把「不可解析」降级成「静默放过」。

  **步骤 4** — 把 R2-01 的另外四个逃逸（E2 数字色阶、E3 跨 const 展开、E4 对象展开、E5 方法链后缀）**至少如实写进 `eslint.config.mjs:19-52` 的 Known boundaries**，并说明 `.map()` 的哪些形态仍不可解析。当前该章节声称「normalises **every construction route**」，而 E1-E5 证明这句话**过强**。若选择继续补规则，则 E2 的最小修法是在 `resolveStaticString` 的 `Literal` 分支（`:461-463`）对 `typeof value === "number"` 也返回 `String(value)`。

- **复验命令**：
  ```bash
  npm run test:taboo-guard; echo "REAL_EXIT=$?"   # 必须 REAL_EXIT=0
  npx eslint; echo "ESLINT_EXIT=$?"               # 必须 0
  npm test
  ```
  预期：`REAL_EXIT=0`、`全部 40 项通过`、`ESLINT_EXIT=0`、`tests 126 / fail 0`。

---

## 4. 变异测试（[WP6-04] 有效性审查）

方法：注入缺陷 → 跑 `src/lib/api/*.test.ts`（**限定我的范围**，因为全量 `npm test` 会被别的 agent 在飞的 `src/app/ledger/type-picker.test.ts` 污染）→ 还原。基线 `pass 42 / fail 0`。

| # | 注入的缺陷 | 结果 |
|---|---|---|
| M1 | `use-api-data.ts` 静默 → 非静默（你报告的那次回退） | ✅ **CAUGHT** `pass 42→41, fail 0→1` |
| M2 | 删掉 `if (opts?.silent) return;` | ✅ CAUGHT `fail 0→4` |
| M3 | 调换 `session-outcome` 的 503/401 顺序 | ✅ CAUGHT `fail 0→3` |
| M4 | 删掉 `client.ts` 的 503 分支 | ❌ **存活** |
| M5 | `client.ts` 不调 `onSessionLost()` | ✅ CAUGHT `fail 0→4` |
| M6 | `dropEntry` 不清 error 态 | ❌ 存活（**等价变异体**，见下） |
| M7 | `reset` 里删掉 `notifyAll()` | ✅ CAUGHT `fail 0→3` |
| M8 | `startFetch` 删掉 `abort()` | ✅ CAUGHT `fail 0→1` |

**结论：6/8 杀灭。测试是有效的**（M1 尤其重要 —— 它证明 [WP6-01] 的接线漂移守卫真的能抓到那次回退）。M6 是等价变异体（`entries.delete(path)` 已使快照不可观测），**不构成缺陷**。

**[R2-03] 非阻塞 · M4 覆盖缺口**：`client.ts:75-78` 的 503 分支可整段删除而测试全绿。原因是该分支与通用 `!res.ok` 分支（`:79-81`）**行为几乎重合** —— 唯一差别是文案：

| | 503 分支在位 | 503 分支被删 |
|---|---|---|
| `status` | 503 | 503 |
| `retryable` | true | true |
| `message` | `账房暂时联系不上，稍后再试一次` | `数据加载失败，请稍后重试` |

现有测试只断言 `status === 503 && retryable`（`client.test.ts:70`），没断言文案，所以删掉分支照样绿。**该分支不是死代码**（文案确有区分价值），只是**缺一条文案断言**。

**修复步骤** — `src/lib/api/client.test.ts:61-74` 的 503 用例内追加一行：
```ts
assert.match(
  String((err as ApiError).message),
  /联系不上|稍后再试/,
  "503 must surface the retryable upstream copy, not the generic fallback",
);
```
（需把 `assert.rejects` 的回调改成先捕获 error 对象再断言。）

**复验命令**：`node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs --test "src/lib/api/*.test.ts"` → 预期 `pass 43 / fail 0`；再注入 M4 → 预期 `fail ≥ 1`。

---

## 5. 回归核实

### 5.1 `api-cache.ts` 的 `reset()` 语义变更

我另写探针（`%TMPDIR%/wp6-reviewer-cache-probe.mjs`）逐条实测，**14/14 全过，0 失败**：

| 检查 | 结果 |
|---|---|
| **非静默路径行为未变**：`reset()` 同步清空 payload、owner 归 null、活着的订阅者**被重新驱动**（请求数增加） | ✅ PASS |
| **静默路径**：清空 ✅、通知 ✅、**不重取** ✅ | ✅ PASS |
| `notifyAll` 通知**每一个**已订阅 path（含无缓存的），退订后不再通知 | ✅ PASS |
| **`dropEntry` 抹掉 error 态的老问题真解决**：reset 后 `stats().size === 0`（entry 是**被移除**而非原地置空），`peek` 返回冻结哨兵 | ✅ PASS |
| **静默标志确实是承重的**：非静默路径仍会自激（`calls > 10`） | ✅ PASS |
| 20 次订阅/退订后 entry 受上限约束、reset 后归零，无泄漏 | ✅ PASS |

关于「`dropEntry` 抹掉 error 态的老问题」：**原问题是断路器永不锁存**。现在的解法不是修复断路器，而是**让 session-lost 路径根本不调 `pump()`** —— 断路器因此不再被需要。这比修复断路器更彻底（少一个必须正确的不变量）。**判定：真解决。**

### 5.2 `setApiCacheOwner` 是否已删 + 删除理由是否站得住

**已删**：`grep -rn "setApiCacheOwner" src/ scripts/` → 仅命中注释与审计报告，**零导出、零调用点**。不留悬空导出。✅

**删除理由评估**（`use-api-data.ts:45-66`）：

| 论据 | 评估 |
|---|---|
| ①「`site-nav.tsx` 在 `resetApiCache()` 跑完之后才知道 id，那时缓存已空，打标签守不住任何东西」 | ✅ **成立，且可核验**。`reset()` 把 `owner` 也置 `null`（`api-cache.ts:292`），之后 `setOwner(id)` 只会走 `else` 分支「adopt」，对空 Map 无事可做 |
| ②「换账号场景已被两条 reset 路径覆盖」 | ✅ **成立**。D-01 的两条路径（显式登出、401）都无条件清空。第一轮审核员 §5 也已判定此项完成 |
| ③「未使用的导出是维护负债，[D-25] 的立场正是『文档声称有效』必须可机器核验；留一个已死的安全钩子恰是该审计要防的失败模式」 | ✅ **成立，且是三条里最有价值的一条**。它与 [D-25] 的论证结构一致 |

**`cache.setOwner()` 保留在接口上**（`api-cache.ts:76`）的理由也站得住：`scripts/api-cache-check.mjs:32,52,62,68-69` 确实把它当 owner 打标签不变量在驱动（该脚本实跑通过），**不是死代码**。

**判定：三条理由全部成立，删除决策正确，文档与实现一致。** 这段注释的价值在于它**记录了一个被否决的方案及理由**，正是 D-25 想要的那种可审计痕迹。

### 5.3 `public/sw.js` 安全性

逐条实测 `isStaticAsset` 对四条 API 路径：

```
prefixes: ["/_next/static/","/icons/","/_next/image"]
  /api/overview -> isStaticAsset = false
  /api/ledger   -> isStaticAsset = false
  /api/data     -> isStaticAsset = false
  /api/settings -> isStaticAsset = false
  /_next/static/x.js -> isStaticAsset = true
```

四条 fetch 分支（`sw.js:187-205`）中，navigate / icon+manifest / static 三条都不匹配 `/api/*`，RSC 短路在 `:191`。**`/api/*` 完全不进 Cache Storage**，无分支响应。`isCacheableResponse` 只在 `networkFirstNavigation`（`:118`）内被调用，作用面仅限 5 个静态壳页面；`/login` 由 `:113` 显式排除。**判定：通过。**

---

## 6. 产物卫生

| 项 | 状态 |
|---|---|
| 两条 `git rm` | ✅ **已正确生效**。`git diff --cached --name-status` 显示 `D .hermes/audits/wp6-401-storm-repro.mjs`、`D .hermes/audits/wp6-taboo-guard-probe.mjs`；两文件已从磁盘消失。返工报告 §3 的处理（401 风暴探针转正为 `src/lib/api/401-storm.test.ts`、一次性禁忌探针删除）**判断正确** |
| `eslint.config.mjs` | ⚠️ 主体合理（Known boundaries 章节措辞准确），但 `:34-36` 声称「normalises **every construction route**」**过强**，与 E1-E5 实测矛盾。见 [R2-01] 步骤 4 |
| `.gitignore` | ✅ 新增 4 条按**命名约定**（`*-probe.mjs` / `*-repro.mjs` / `*.tmp.mjs` / `__probe__*`）而非整目录，**不会误伤 `reviewer-*.md` / `wp*-fix-*.md` 报告**。注释说清了「有价值的探针该去哪」，是好的文档 |
| `package.json` | ✅ 新增 4 个 npm script 与 5 个模块实现一致；`xlsx` 改用官方 CDN tarball（0.20.3，与第一轮审核员核实的三处一致结论相符）。**注意 `jsdom` 进了 devDependencies 但 `src/lib/api/**` 无任何测试用它** —— 属其它 agent 范围，不阻塞 |
| **临时产物** | 🔴 **`src/lib/api/use-api-data.ts.r2bak` 未被忽略**（`git check-ignore` → NOT IGNORED）。见 [R2-02] |

---

## 7. 非阻塞缺陷

### [R2-02] P2 · `.r2bak` 备份文件残留在源码树里，且不在 `.gitignore` 覆盖范围内

- **文件**：`src/lib/api/use-api-data.ts.r2bak`（4554 字节，mtime `15:39:06`）
- **实跑**：`git check-ignore -v src/lib/api/use-api-data.ts.r2bak` → **无输出 = NOT IGNORED**。`git status` 显示 `?? src/lib/api/use-api-data.ts.r2bak`。
- **为什么是缺陷**：内容与当前 `use-api-data.ts` **除行尾符外完全相同**，是一份**过期快照**。`.gitignore` 新增的 4 条规则**只覆盖 `.hermes/**` 下的 `*.mjs`**，管不到 `src/` 里的 `.r2bak`。它同时是 [WP6-01](c) 那次并行覆盖的**物证**。
- **修复步骤**：
  1. `rm src/lib/api/use-api-data.ts.r2bak`（内容已确认无独有信息，删除安全）
  2. 在 `.gitignore` 的编辑器备份区块加一条：`*.[0-9]*bak`、`*.r2bak`、`*.orig`（若尚未有）
- **复验命令**：`git status --porcelain | grep -c bak` → 预期 `0`

### [R2-03] P2 · `client.ts` 的 503 分支缺文案断言（变异 M4 存活）

见 §4。**不阻塞**：该分支不是死代码，只是断言不够具体。

### [R2-04] 记录备查（非缺陷）· M6 是等价变异体

`dropEntry` 中 `entry.snap = EMPTY_SNAPSHOT` 后紧跟 `entries.delete(path)`，快照清理不可观测，删掉它测试不会红。**不是覆盖缺口**，无需修复。

### [R2-05] 记录备查 · 禁忌守卫剩余逃逸（E1–E5）

除 E1（阻塞，已列 [R2-01]）外的四个逃逸：数字色阶 `"-" + 500`、跨 const 的数组展开 `cn(...K)`、对象展开 `{...M}.a`、方法链后缀 `K.join("").toUpperCase()`。**当前代码未在 Known boundaries 中如实列出这些**（只笼统写了「无法静态解析的运行时值」）。建议随 [R2-01] 步骤 4 一并写准。

---

## 8. 我亲跑的门（全部真实执行）

| 门 | 命令 | 真实结果 |
|---|---|---|
| 类型 | `npx tsc --noEmit` | `TSC_EXIT=0` |
| Lint | `npx eslint` | `ESLINT_EXIT=0`（零 error 零 warning） |
| 单测（我的范围） | `node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs --test "src/lib/api/*.test.ts"` | `tests 42 / suites 10 / pass 42 / fail 0` |
| 禁忌守卫 | `npm run test:taboo-guard` | 🔴 **`REAL_EXIT=1`，40 项中 1 项未生效** |
| 缓存专项 | `npm run test:api-cache` | `结果：全部通过` |
| 构建 | `npm run build`（取锁 → build → 释放） | `BUILD_EXIT=0`；13 条路由，`/` `/data` `/ledger` `/settings` `/login` 全 `○ (Static)` |
| 401 风暴（我的独立探针） | `%TMPDIR%/wp6-reviewer-storm-probe.mjs` | 修复组 **4** 次 / 对照组 **20004** 次（3s，撞上限） |
| 分流判定（我的独立探针） | `%TMPDIR%/wp6-reviewer-outcome-probe.mjs` | 11×401 + 5×503 + 3×OK，**零误判** |
| reset 语义（我的独立探针） | `%TMPDIR%/wp6-reviewer-cache-probe.mjs` | 14/14 PASS |
| 变异测试 | 8 个变异体，限定 `src/lib/api/*.test.ts` | **6/8 杀灭** |

**全量 `npm test` 说明（如实记录）**：`tests 128 / pass 126 / fail 2`，两条失败均来自 `src/app/ledger/type-picker.test.ts` —— 该文件是**另一个并行 agent 正在写的未跟踪文件**（`git status` 显示 `?? src/app/ledger/type-picker.test.ts` + `type-picker.tsx`，mtime `16:33/16:34`），**不属于本包审核范围**，与 WP-6 无关。我已用限定范围的运行隔离确认本包 42/42 全绿。

---

## 9. 未验证清单（如实声明）

1. **真机 a11y 播报**：本机 Chrome 启动失败（`Chrome exited early, exit code 3`）。`ChartFigure` 的 `role="img"` / `aria-describedby` / `figcaption` 兄弟关系、SW 更新条的 `role="status"` 均**仅经 DOM 静态核验**，未做 NVDA/VoiceOver 实测，也未跑 axe。
2. **`npm run test:taboo-guard` 红灯的成因归属**：我确认了**现象**（用例失败、退出码 1）与**根因**（`collectJoinSegments` 取不到 `.map()` 链下的数组），但**无法判定**它是「加固未完成」还是「明知红灯仍交付」—— `wp6-guard-round3.md` 缺失，无从查证。
3. **503 端到端 HTTP 验证**：未按第一轮建议把 `NEXT_PUBLIC_SUPABASE_URL` 指向不可达主机后 `curl -i localhost:3200/api/overview`。`session.ts` import `next/server`，Node 无法在 Next 构建外加载（这正是抽出 `session-outcome.ts` 的原因），故我的分流验证止于**纯函数层** + 真实 auth-js 错误类，**未穿过 HTTP 边界**。
4. **`scripts/bench.mjs`**：本轮未实跑（`--base` 需指向实际服务端口，且第一轮已判定其 Windows 环回阈值问题与本包无关）。
5. **`scripts/ts-resolve-hooks.mjs` / `register-ts-resolve.mjs`**：第一轮已判定「接受，不算缺陷」，本轮未重新评估，仅确认它们是 `npm test` 正常运转的前提。

---

## 10. 结论与复审路径

**不予提交。** 五维中「代码质量与文档」不通过（[R2-01] 阻塞）。

[R2-01] 之所以是阻塞而非「记录备查」：禁忌守卫是 D-25 **唯一的执行机制**，而仓库自带的自测脚本此刻正以退出码 1 报告「1 个守卫未生效」，且失败项是一个我已隔离复现的真实逃逸。在这种状态下宣称「机器强制」不成立 —— 这与第一轮打回 [WP6-03] 的理由是同一类。

修复 [R2-01] 后请重跑：

```bash
npm run test:taboo-guard; echo "REAL_EXIT=$?"   # 必须 0
npx tsc --noEmit && npx eslint && npm test
node --experimental-strip-types --import ./scripts/register-ts-resolve.mjs --test "src/lib/api/*.test.ts"
npm run test:api-cache && npm run build
```

**全部转绿后**再提交。提交时请注意：

1. **先删 `src/lib/api/use-api-data.ts.r2bak`**（[R2-02]），否则会被 `git add` 扫进去。
2. **显式逐条 `git add`，禁止 `-A` / `.`** —— 工作区里有大量其它 agent 的在飞文件（`src/app/**`、`src/lib/ledger/**`、`src/components/confirm-submit-button*`、其它审计报告），`-A` 会把它们一并提交。
3. **提交前确认 `src/app/ledger/type-picker.test.ts` 的失败已由其 owner 解决**（否则 `npm test` 会红）。
4. 建议把 `npm test` 挂进 pre-commit —— [WP6-01](c) 的接线回退就是靠这个才能被及时发现。

**本审核员未执行任何 `git add` / `git commit`，未修改任何业务代码。** 仅在仓库根与 `src/` 下临时写入探针文件用于验证，**全部已 `rm` 删除**（`git status` 已确认无 `__rev*` / `__reviewer_*` 残留）；仓库外的探针保留在 `%TMPDIR%` 供复核。
