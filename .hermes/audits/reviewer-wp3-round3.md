# WP-3 复审报告（round 3，终审）

- 复审员：专职复审审核员（只审查/验收/提交，不写业务代码）
- 复审对象：`wp3-fix-round3.md` 声称已闭环的 D-4-a / D-4-b / D-4-c，及自查新增的 D-5
- 审核基线：`97fa76d`
- 结论：**不通过**。D-4 三条**确已真实闭环**（全部由我独立复现），
  D-5 的登记也**如实**。但本轮新增的**核验脚本本身**存在 **3 处可复现的假 PASS**
  （`wp3-coverage-check.mjs:222-224`），其中一个正是「对错误注释报 PASS」——
  即施工方自己认定「比没有检查更危险」的那一类缺陷，**换了个位置复发**。
  本次不提交。

> **基线声明**：工作区存在 WP-6 护栏等其它包的未提交改动（`eslint.config.mjs`、
> `src/lib/api/**`、`scripts/**`、`.githooks/` 等），**不在本包范围**，未触碰，
> 不计入本报告任何缺陷。它们的产物被包含在下文的全量 build / 全量 test 结果里。

---

## 0. 五维结论表

| 维度 | 结论 | 一句话 |
|---|---|---|
| 1 正确性 | **通过** | D-4-a/b/c 三条缺陷经我独立 grep 复现为已闭合；`stats.ts` 对 HEAD 是 **116 增 0 删**（= 43 行新头注释 + 73 行 D-05 日期段，均为前轮成果），HEAD 原有 164 行代码逐字节保留（md5 `500dce2a…` 双向一致） |
| 2 安全 | **通过** | 本轮未触碰任何注入防护代码；静态壳产物 0 处构建日泄漏（`20\d\d-\d\d-\d\d` 0 命中、「近 7 天支出」0 命中） |
| 3 可访问性 | **通过** | 干净 build 的 `data.html`（47128 B）实测 `id="main"`、`role="status"`、`aria-busy="true"`、sr-only「掌灯中」均在位 |
| 4 代码质量 | **通过** | 注释改为逐符号可解析清单，**16 个导出无一遗漏**；4 处「无测试覆盖」经我实测**全为真**，无谎报 |
| 5 测试与验证 | **不通过** | **D-6**：`wp3-coverage-check.mjs` 存在 3 处可复现假 PASS，其中 2 处能放过**注释内容错误**，1 处能放过**注释漏项**。GUARD 只防「解析到 0 条」，不防「解析少了」 |

**判定规则：第 5 维不通过 → 不准提交。**

---

## 1. D-4 三条的独立核实结论

**我一条都没有采信自述，全部自己重跑 grep。** 施工方的三条结论**均成立**。

### 1.1 D-4-a —— `num()` 确系 ② 组内部收敛点 → **已闭环**

`stats.ts:41-42` 现文：

```ts
// `num()` 是 ② 组内部的收敛点 —— 第 ① 组的日期函数不经过它
// （本文件 14 处 `num(` 调用、分布在 13 个代码行，全部落在 ② 组内）。
```

我的独立实测（`grep -n 'num('` 全量逐行）：

```
41,42  ← 注释自身（非调用）
55     ← function num( 声明（非调用）
78,79  monthlyTrend   97  categoryShare   123(×2) assetCurve   154  filterTxs
172,173,174  summarizeTxs   189,192,194,196,197  accountBalances
```

- **处数 14**：`78,79,97`（3）+ `123`（**一行两处**：`-num(` 与 `num(`）+ `154`（1）
  + `172,173,174`（3）+ `189,192,194,196,197`（5）= **14** ✔
- **代码行 13**：`78,79,97,123,154,172,173,174,189,192,194,196,197` = **13** ✔
- **全部落在 ② 组内** ✔（② 组函数体区间 `:59-202`；第 ① 组区间 `:208-280` 内 0 次）

施工方 §5 如实披露了自己先写「15 处」被 RULE C 打回、随后**改正注释而非放宽规则** ——
这是**正确**的处置（见 §5 诚实性检查）。

### 1.2 D-4-b —— `TxFilter` 确系 0 测试引用 → **已闭环**

`stats.ts:35-36` 现文：`TxFilter → (无测试覆盖)` / `（stats.test.ts 0 引用；只被同文件 filterTxs 的形参消费）`

我的独立实测（遍历 `src/**` 全部 **9 个** `*.test.ts(x)`，非仅 stats.test.ts）：

```
TxFilter   test_hits=0   files=[]
```

全库仅 3 处命中，全在 `stats.ts` 内部（`:35` 注释、`:134` 定义、`:145` 形参）。
**注释属实。**

### 1.3 D-4-c —— 5 个日期函数确系只有 3 个被覆盖 → **已闭环**

`stats.ts:30-34` 现文只列 3 个，并写明另 2 个无覆盖。逐符号实测：

```
shiftDays      test_hits=10  [query-params.test.ts]  ✔ 被覆盖
monthEnd       test_hits=7   [query-params.test.ts]  ✔ 被覆盖
prevMonthKey   test_hits=6   [query-params.test.ts]  ✔ 被覆盖
lastDayKeys    test_hits=0   []                     ✘ 无覆盖 —— 与注释一致
shanghaiDate   test_hits=0   []                     ✘ 无覆盖 —— 与注释一致
```

**注释属实。**

### 1.4 施工方把 4 个符号写成「无测试覆盖」—— **全部实测为真，无一谎报**

这是本轮最需要警惕的一点（谎报「无覆盖」比谎报「有覆盖」更隐蔽）。我逐个实测：

| 符号 | 注释声明 | 我的实测（9 个测试文件全集） | 裁定 |
|---|---|---|---|
| `lastDayKeys` | 无测试覆盖 | `test_hits=0` | **声明为真** |
| `shanghaiDate` | 无测试覆盖 | `test_hits=0` | **声明为真** |
| `TxFilter` | 无测试覆盖 | `test_hits=0` | **声明为真** |
| `TxSummary` | 无测试覆盖 | `test_hits=0` | **声明为真** |

**没有谎报。** 施工方宁可承认缺口也没有为了注释好看而声称有覆盖。

### 1.5 清单完整性抽查（施工方未主张、我主动加的）

`stats.ts` 实有 **16 个导出**。我核对注释是否逐个列举：

```
① 组 5 个：shiftDays monthEnd prevMonthKey lastDayKeys shanghaiDate
② 组 9 个：filterTxs monthKey lastMonths monthlyTrend categoryShare
           assetCurve summarizeTxs accountBalances TxLike
③ 组 2 个：TxFilter TxSummary
合计 16 —— 与实际导出数一致，无遗漏、无虚构
```

另核实 ② 组「**无生产调用点**」的自述：9 个符号在 `stats.ts` 之外、
非测试文件中**全部 0 引用** ✔。

**D-4 判定：三条全部闭环。** 本轮**零代码改动**：对 HEAD 的 diff 是 116 增 0 删，116 行全部是注释与前轮已提交的 D-05 日期段，HEAD 原有 164 行代码 md5 双向一致。

---

## 2. D-5 裁定 —— **已如实登记，闭环，不构成独立阻塞**

- **核实**：`grep -rn '\bTxSummary\b'` 全库（排除 `node_modules`/`.next`）→
  仅 `stats.ts:37`（注释）、`:165`（定义）、`:167`（`summarizeTxs` 返回类型）。
  **`stats.ts` 之外 0 引用，测试文件 0 引用。两项皆无，属实。**
- **blanket claim 是否删净**：是。`stats.ts:4` 现文为
  「下面**逐个列出每个导出**的兜底依据」——这是**对本文档自身的描述**，
  且 16/16 属实；**「每个导出都有真实调用点或真实测试兜底」这个 blanket claim 已彻底消失**。
  我用 V11 变异反向验证：删掉 `TxSummary` 那一行后，脚本**不会**报
  「漏列导出」（见 D-6-c），但**注释本身**会因漏列而变假话 —— 脚本没守住这条（见 D-6）。
- **裁定**：施工方的处置（保留 `TxSummary`、如实标注、不删类型）**正确且诚实**。
  我同意「不主张删」—— 它是 `summarizeTxs` 的公开返回类型，删了破坏 API 边界。
  **D-5 不阻塞。**

---

## 3. [D-6] 新缺陷 —— 核验脚本存在可复现的假 PASS（阻塞提交）

> 施工方 §3 的核心主张是「把覆盖度变成机器可验证的断言」，
> 且**如实披露了**第一版对旧注释误报 PASS 并据此重写。
> 这个方向我认可，负向对照也**确实成立**（我独立重建旧注释头复现，见 §3.4）。
>
> **但 GUARD 的设计只挡住了「解析到 0 条」，没挡住「解析少了」。**
> 后果是：注释里**写错**或**漏写**时，脚本仍然打印
> `RESULT: PASS —— 注释里每一条覆盖度声明都经实测为真`。
> **这句话在 3 种情况下是假的，而脚本对此完全沉默。**

### 3.0 我的鉴别力测试方法

自建 12 个变异体（复制真实 `stats.ts`，**只改注释头**，代码体不动），
逐个跑 `node .hermes/audits/wp3-coverage-check.mjs <变体路径>`，记录 exit code。
**期望：能放过错误注释的才算假 PASS。**

| # | 变异体（构造的错误注释） | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| V1 | `lastDayKeys → presets.ts`（谎报路径） | FAIL | **exit 1** `找不到 \blastDayKeys\b` | ✅ 抓住 |
| V2 | `filterTxs → (无测试覆盖)`（谎报无覆盖） | FAIL | **exit 1** `实际被 stats.test.ts(11) 引用` | ✅ 抓住 |
| V4 | `TxSummary → stats.test.ts`（谎报有覆盖） | FAIL | **exit 1** `找不到 \bTxSummary\b` | ✅ 抓住 |
| V7 | 数字造假 `99 处 / 99 行` | FAIL | **exit 1** `实测 14 处 / 13 行` | ✅ 抓住 |
| V8 | D-4-c 复发：`+ lastDayKeys` 进 query-params 组 | FAIL | **exit 1** `找不到 \blastDayKeys\b` | ✅ 抓住 |
| V9 | ① 组内真加 `num()` 调用 + 同步改数字 | FAIL | **exit 1** C1 **和** C2 双双报错 | ✅ 抓住 |
| **V3** | **`shanghaiDate → presets.ts`（实际只在 presets.ts 的一段 JSDoc 注释里被提及，无 import、无调用）** | **FAIL** | **exit 0 PASS** | ❌ **假 PASS（D-6-a）** |
| **V5** | **箭头换成脚本不认识的 `=>`** | **FAIL** | **exit 0 PASS**（断言数 22→21，脚本不吭声） | ❌ **假 PASS（D-6-b）** |
| **V6** | **分隔符换成中文顿号 `、`** | **FAIL** | **exit 0 PASS**（断言数 22→20，脚本不吭声） | ❌ **假 PASS（D-6-b）** |
| **V10** | **复活 D-5 的 blanket claim（散文句）** | FAIL | **exit 0 PASS** | ❌ **假 PASS（D-6-b）** |
| **V11** | **整行删掉 `TxSummary`（16 个导出只列 15 个）** | FAIL | **exit 0 PASS** | ❌ **假 PASS（D-6-c）** |
| **V12** | **在 ② 组之外的 `round2()` 里加 `num()`，注释仍写「全部落在 ② 组内」** | **FAIL** | **exit 0 PASS** | ❌ **假 PASS（D-6-a）** |

**6 抓住 / 6 放过。** 施工方声称的鉴别力**只在他自己构造的那两类错误上成立**
（路径写错、数字写错）；**换一种写法写错，脚本立刻失明。**

### 3.1 D-6-a（阻塞）RULE A 只做纯文本计数，不区分「调用」与「注释里提到」

- **文件**：`.hermes/audits/wp3-coverage-check.mjs:49`、`:142-155`
- **缺陷**：`countIn()` 对目标文件全文做 `\b符号\b` 正则计数，**不剥离注释**。
  因此**一段 JSDoc 里提到某符号，就足以让「该文件消费此符号」的声明通过**。
- **实测**（V3）：把注释改成
  ```
  //      shanghaiDate → src/app/data/presets.ts
  ```
  脚本 **exit 0 / PASS**。但 `presets.ts` 的 ground truth 是：
  ```
  :23  import { monthEnd, prevMonthKey, shiftDays } from "@/lib/ledger/stats";
  :34   * @param today 访问日的上海日期，YYYY-MM-DD。由 `shanghaiDate()` 在**渲染时**
  ```
  —— **既没有 import，也没有调用**，只有一句 JSDoc。
  这正是 D-1 原缺陷「`date-window.ts` 不存在」「调用点描述不属实」的**同种形态**，
  脚本却判它为真。
- **为何阻塞**：注释里 `符号 → 文件` 的语义是「**该文件真的消费了这个符号**」。
  脚本验证的是「该文件里出现过这个词」。二者不等价，而脚本的输出文案
  （`注释里每一条覆盖度声明都经实测为真`）宣称的是前者。
- **修复步骤**（`wp3-coverage-check.mjs`，两处）：
  1. 新增 `stripComments(text)`：去掉 `/* … */`（含 JSDoc）与 `// …` 行注释，
     再交给 `countIn`。（建议同时处理字符串字面量里的误命中。）
  2. 把 RULE A 的 `countIn(bodyOf(c.target), sym)`（`:145`）改为
     `countIn(stripComments(bodyOf(c.target)), sym)`。
  3. 补一条负向断言自检：对 V3 形态必须 FAIL（见 §6 复验命令）。

### 3.2 D-6-b（阻塞）GUARD 只防「0 条」，不防「解析少了」；散文完全不看

- **文件**：`.hermes/audits/wp3-coverage-check.mjs:222-224`
- **缺陷**：
  ```js
  const total = pathClaims.length + ruleB.length + 2;
  if (pathClaims.length + ruleB.length === 0) fail("解析器未抓到任何覆盖度声明 …");
  ```
  只在**恰好为 0** 时报错。而「解析器看不懂新写法 → 静默少解析几条」是更常见、
  更危险的情形，因为**断言总数会变少，但脚本照常 PASS**。
- **实测**（V5 / V6 / V10）：
  - V5 箭头写成 `=>`（`:91` 的正则只认 `→`）→ 断言数 22→**21**，**exit 0 PASS**
  - V6 分隔符写成 `、`（`:52` 的 `isSymbolList` 只认 `/`）→ 断言数 22→**20**，**exit 0 PASS**
  - V10 复活 blanket claim 散文句 → 断言数不变，**exit 0 PASS**（散文根本不被解析）
- **为何阻塞**：这**正是施工方自己写下的那段警告的复发**——原文（`wp3-fix-round3.md:174`）：
  > 「一个对错误注释报 PASS 的检查比没有检查更危险。」
  第一版的问题是「对旧写法整体失明」，重写后变成「对**任何它不认识的写法**局部失明」。
  假 PASS 从「全盘」缩小到「零星」，**但没有消失**。
  一个下一个人只要把注释里的 `→` 改成 `=>`（很常见的排版改动），
  核验就静默失效，且**没有任何提示**。
- **修复步骤**（`wp3-coverage-check.mjs`）：
  1. **断言总数下限硬校验**：把 GUARD 从「==0 才报错」改为
     「`pathClaims.length + ruleB.length < 期望值` 即 FAIL」，
     期望值由**独立于解析器**的方式得出（见 D-6-c 的做法）。
  2. **未知符号列表行 → FAIL**：在主循环里，凡满足
     `isSymbolList()` 形状（含 `、`/`→`/`=>` 等分隔符）却**没被任何一条规则消费**的行，
     直接判 FAIL「注释格式无法解析，核验失效」。
  3. **blanket claim 检测**：对注释散文做一条否定断言 ——
     若出现 `/每个导出.*(都有|均有)/` 之类的全称量词句式且未被逐符号清单覆盖，
     判 FAIL。可用一条 `/[每][个]\s*导出[^\n]*(都|均)/` 正则实现。
  4. 输出文案改为**限定口径**，例如
     `RESULT: PASS —— 已核验 N 条声明（M 条）；解析器不认识的注释格式请手工复核`，
     不要无条件宣称「每一条」。

### 3.3 D-6-c（阻塞）清单完整性无人守：漏列导出不会被发现

- **文件**：`.hermes/audits/wp3-coverage-check.mjs`（**整条规则缺失**）、
  对应注释断言 `src/lib/ledger/stats.ts:4`「下面**逐个列出每个导出**的兜底依据」
- **缺陷**：脚本**从不**把「`stats.ts` 实际 `export` 了哪些符号」与
  「注释里列举了哪些符号」做差集。`:74` / `:116` 的
  `claims.push({ symbols: group, target: "(本组汇总)" })` 收集到组符号后，
  在 `:133` 被 `pathClaims = claims.filter(c => !/^\(.*\)$/.test(c.target))`
  **整条丢弃** —— 组内符号的**存在性**从未被验证，只被验证了**指向性**。
- **实测**（V11）：整行删掉 `TxSummary → (无测试覆盖)` 后，
  注释只列了 15 个导出，而 `:4` 仍写着「每个导出」——
  **`:4` 此时是假话**，脚本 **exit 0 PASS**，断言数 22→19 毫无提示。
  这**正是 D-5 的同种形态复发**（一个导出被 blanket claim 隐含、却没被单独登记）。
- **为何阻塞**：`stats.ts:4` 是这段注释的**总纲断言**，也是 D-5 争议的焦点。
  一条守不住总纲的核验脚本，正是「对错误输入报 PASS」的最典型形态。
- **修复步骤**（`wp3-coverage-check.mjs`）：
  1. 用 `read(STATS)` 正则抽出实际导出名集合
     （`/^export\s+(?:type|function|const|class)\s+([A-Za-z_$][\w$]*)/gm`）。
  2. 把注释头里出现过的所有符号名合成一个集合。
  3. 差集非空 → 逐个 FAIL：`导出 X 未在注释清单中出现`。
     实测当前状态下差集**必须为空**（16/16 齐全），因此这条规则**不会**产生误报。
  4. 这条差集同时充当 D-6-b 第 1 步所需的「期望值」下界。

### 3.4 施工方负向对照声明的独立复核 —— **属实**

我没有使用施工方已删除的 `.hermes/.tmp-check/old-header.ts`，
而是**依据 `reviewer-wp3-round2.md` §3 引用的原文独立重建**旧注释头
（19 行，含 `TxFilter` 混在 ② 组、`:14` 的「以上日期函数另由 query-params.test.ts 覆盖」、
`num()` 「上面两组的公共收敛点」、`:4` blanket claim），接上真实代码体后跑同一脚本：

```
目标文件: old-header.ts  (注释头 19 行)
[RULE A] (4 条)
  ok    shiftDays / monthEnd / prevMonthKey → src/app/data/presets.ts
  ok    lastDayKeys / shanghaiDate → src/app/data/data-client.tsx
  ok    shanghaiDate → src/app/ledger/transaction-form.tsx
  FAIL  lastDayKeys → src/app/data/query-params.test.ts : 找不到 \blastDayKeys\b
  FAIL  shanghaiDate → src/app/data/query-params.test.ts : 找不到 \bshanghaiDate\b
[RULE C]
  FAIL  C2 注释里没有同时写明 num( 的「处数」与「代码行数」，无法核对
断言总数: 6  失败: 3
RESULT: FAIL      NODE_EXIT=1
```

**旧注释 FAIL / 新注释 PASS 的核心主张成立**，与施工方 §3.2 一致
（失败条数 3 vs 其报的 4，差异源于我重建的注释头行数与其副本略有出入，
不影响「必须 FAIL」这一结论）。**施工方没有夸大这一点。**

但请注意：**负向对照只覆盖了他自己那一种旧写法。**
构造 12 种错误写法（其中 6 种沿用他已覆盖的形态、6 种是我另造的），结果见 §3.0 表：
**12 个变异体放过 6 个。** 负向对照成立 ≠ 脚本可信。

---

## 4. 回归门禁 —— 全部亲跑，真实输出

| 门禁 | 期望 | 实测 | 判定 |
|---|---|---|---|
| `npm test` | 168/168 | `tests 168 / suites 38 / pass 168 / fail 0` | ✅ |
| `npx tsc --noEmit --incremental false` | exit 0 | 无输出，`TSC_EXIT=0` | ✅ |
| `npx eslint .`（全库） | 0 error 0 warning | 无输出，`ESLINT_ALL_EXIT=0` | ✅ |
| `npx eslint src/app/data src/app/api/data/route.ts src/lib/ledger/stats.ts` | exit 0 | 无输出，`ESLINT_PKG_EXIT=0` | ✅ |
| `grep -rn "date-window" src/` | 0 命中 | 0 命中，`GREP_EXIT=1`（grep 语义正确） | ✅ |
| `node .hermes/audits/wp3-coverage-check.mjs` | exit 0，22 断言 | `断言总数: 22  失败: 0 / RESULT: PASS` | ✅（但见 D-6） |
| 干净 `npm run build` | exit 0，四页全 ○ | 见下 | ✅ |

### 4.1 干净 build（我自己取锁、跑完释放）

```
$ mkdir .hermes/.build-lock        # 第一次即拿到锁
$ npm run build
✓ Compiled successfully in 472ms
  Running TypeScript ...
  Finished TypeScript in 1195ms ...
✓ Generating static pages using 16 workers (11/11) in 507ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/data
├ ƒ /api/ledger
├ ƒ /api/overview
├ ƒ /api/settings
├ ○ /apple-icon.png
├ ○ /data
├ ○ /icon.png
├ ○ /ledger
├ ○ /login
├ ○ /manifest.webmanifest
└ ○ /settings

BUILD_EXIT=0
LOCK_RELEASED
```

四个业务页 `/` `/data` `/ledger` `/settings` **全部 `○ (Static)`**，`/login` 亦为 `○`。
`Running TypeScript` **通过**。锁已 `rmdir` 释放。

### 4.2 静态壳回归抽查（对 `.next/server/app/data.html`，47128 字节）

| 项 | 实测 | 判定 |
|---|---|---|
| `id="main"` | 2 | ✅ 在位 |
| `role="status"` | 4 | ✅ 在位 |
| `aria-busy="true"` | 4 | ✅ 在位 |
| sr-only「掌灯中」 | 4 | ✅ 在位 |
| 构建日泄漏 `20\d\d-\d\d-\d\d` | **0** | ✅ 无泄漏 |
| 「近 7 天支出」硬编码 | **0** | ✅ 无硬编码 |

> `id="results"` 在**静态壳**里为 0，属预期 —— 它是 `data-client.tsx:404` 的
> `<section id="results">`，属客户端渲染，不进静态壳。这一项**不作为缺陷**。

---

## 5. 诚实性检查 —— **通过**

| 检查项 | 结论 | 依据 |
|---|---|---|
| 是否照抄审核员结论 | **否** | §1 三条我自己重跑 grep；16 个导出的完整清单是我自己扩出来核的（施工方未主张完整性） |
| 是否发现审核员遗漏 | **是（D-5）** | `TxSummary` 零引用零测试，已如实登记 |
| 4 个「无测试覆盖」是否谎报 | **否** | 我遍历**全部 9 个**测试文件实测，4 个符号 `test_hits` **全为 0**，声明**全为真** |
| 是否为注释好看而声称有覆盖 | **否** | 上一轮把 `lastDayKeys`/`shanghaiDate` 写成「被覆盖」，本轮主动改口为「无覆盖」 |
| **是否改动断言口径去迁就注释** | **否（关键项）** | RULE C 的 C2 抓出施工方**自己**写错的「15 处」→ 实测 14 处，施工方**改的是注释（15→14/13）不是规则**。这是正确方向：让事实去迁就规则，而非让规则去迁就注释。RULE B 保持**双向**（谎报有覆盖、谎报无覆盖都 FAIL），未被削弱成单向。**未发现放宽规则的痕迹。** |
| 负向对照是否夸大 | **否** | 其 §3.2「旧注释 FAIL」我独立重建复现，结论一致（失败条数 3 vs 4，源于重建副本行数差异，已在 §3.4 说明） |
| 是否夸大核验脚本能力 | **部分夸大** | §3 表格把 GUARD 描述为「防 vacuous pass」，实测**只防「0 条」，防不住「解析少了」**。这是**表述**与实测的偏差，非故意隐瞒 —— 但它导致的正是 D-6 |
| 代码是否被改动 | **否** | `git diff --numstat` = **116 增 / 0 删**；116 = 43 行新头注释 + 73 行 D-05 日期段（`:208-280`，前轮成果）。**0 删**证明 HEAD 原有 164 行一行未动；把 HEAD 的 164 行与当前文件 `:44-207` 分别去注释去空行后 md5 **双向一致**（`500dce2a9af92e3863055cd1529eb942`） |
| 是否只动自己名下文件 | **是** | 本轮仅改 `stats.ts` 头注释 + 新增核验脚本 + 本报告；我的临时变异目录 `.hermes/.rev3-tmp/` **已 `rm -rf` 删除**，`git status` 复核 0 残留 |
| 是否做了 git 写操作 | **否** | 无 `add` / `commit` / `stash`；`HEAD` 仍为 `97fa76d` |

**诚实性判定：通过。** 施工方的自述与我的独立实测**逐项吻合**，
包括对自己不利的部分（4 个符号无覆盖、15→14 的自纠）。
**问题不在诚实，在方法论的覆盖边界** —— 脚本在自己没测过的写法上是瞎的。

---

## 6. 缺陷清单（本轮）

| ID | 严重度 | 文件:行 | 阻塞提交 | 修复 |
|---|---|---|---|---|
| **D-6-a** | 中 | `wp3-coverage-check.mjs:49`、`:145` | **是** | RULE A 剥离注释/字符串后再计数，否则「JSDoc 里提到」会被当成「真的消费」 |
| **D-6-b** | 中 | `wp3-coverage-check.mjs:222-224` | **是** | GUARD 从「==0 才报错」改为「低于期望下界即 FAIL」+ 未知格式行 FAIL + blanket claim 检测 + 输出文案限定口径 |
| **D-6-c** | 中 | `wp3-coverage-check.mjs`（规则缺失）；对应 `stats.ts:4` | **是** | 新增「实际导出集 − 注释列举集」差集校验（当前实测差集为空，不会误报），并用该差集数量充当 D-6-b 的期望下界 |

> **严重度说明**：三条**都不影响运行时** —— 产品代码本轮零改动，注释**当前也是真的**。
> 它们是**核验工具**的缺陷。但按本项目已确立的判例（round 2 的 D-4 即以「注释事实错误」阻塞），
> **一个会对错误注释报 PASS 的检查器，其危害大于没有检查器** —— 它让下一个核查者
> **误以为已经核验过**。施工方自己在 `wp3-fix-round3.md:174` 写下了这句话。
> **阻塞。**
>
> **同时明确肯定**：D-4-a/b/c **已真实闭环**、D-5 **已如实登记**、
> 4 处「无测试覆盖」**无谎报**、门禁**全绿**、build **四页全 ○**。
> **本轮返工的实质工作是对的，代码可以进；卡住的只是这个核验脚本。**
> 修复面仅限 `.hermes/audits/wp3-coverage-check.mjs` 一个文件，**不触碰任何产品代码**。

---

## 7. 复审命令（修复后）

```bash
# ① 覆盖度核验（修复后仍须 exit 0）
node .hermes/audits/wp3-coverage-check.mjs        # 期望 exit 0

# ② 鉴别力负向对照 —— 下面 4 个变异体修复后必须全部 FAIL（当前全部 PASS）
#    用任意临时目录（勿入库），跑完删除
#    V3  shanghaiDate → src/app/data/presets.ts
#        （presets.ts 仅在 :34 的 JSDoc 里提到，无 import/调用）      期望 exit 1
#    V5  把某个 `→` 改成 `=>`                                        期望 exit 1
#    V6  把 `lastDayKeys / shanghaiDate` 的 `/` 改成 `、`              期望 exit 1
#    V11 整行删掉 `TxSummary → (无测试覆盖)`（16 导出只列 15）        期望 exit 1
#    构造方式：复制 src/lib/ledger/stats.ts，只改注释头，代码体不动

# ③ D-4 三条的原始 grep（结论应与本报告 §1 完全一致）
grep -n 'num(' src/lib/ledger/stats.ts                                  # 14 处 / 13 行，全在 :59-202
awk 'NR>=208' src/lib/ledger/stats.ts | grep -c 'num('                  # 期望 0
grep -rc '\bTxFilter\b' src/lib/ledger/stats.test.ts                     # 期望 0
grep -rc '\blastDayKeys\b\|\bshanghaiDate\b' src/app/data/query-params.test.ts   # 期望 0
grep -rn '\bTxSummary\b' src/ --include='*.ts' | grep -v 'ledger/stats.ts'    # 期望 0（D-5）

# ④ 导出完整性（新增规则的期望值，当前应为 0 差集）
grep -o '^export \(type\|function\) [A-Za-z]*' src/lib/ledger/stats.ts | awk '{print $3}' | sort -u | wc -l   # 16

# ⑤ 门禁
npm test                                              # 期望 168/168
npx tsc --noEmit --incremental false                  # 期望 exit 0
npx eslint .                                          # 期望 exit 0，0 error 0 warning
grep -rn "date-window" src/                           # 期望 0 命中

# ⑥ 构建
for i in $(seq 1 60); do mkdir .hermes/.build-lock 2>/dev/null && break; sleep 10; done
npm run build
rmdir .hermes/.build-lock
# 期望 exit 0，/ /data /ledger /settings 四页全 ○ (Static)
```

**不需要浏览器。** 本机 Chrome 启动失败（exit code 3）为**已知环境限制**，
本轮所有结论均**不依赖浏览器**。

---

## 8. 交付与未实测声明

- **未做任何 git 写操作**（无 `add` / `commit` / `stash`），判定不通过，不提交。
  `HEAD` 仍为 `97fa76d`。
- **未修改任何产品文件。** 本轮唯一接触的仓库文件是我的临时变异目录
  `.hermes/.rev3-tmp/`，**已 `rm -rf` 删除**，`git status` 复核 0 残留。
- **本报告** `.hermes/audits/reviewer-wp3-round3.md` 按项目惯例入库
  （`.gitignore:40` 明示「审计流水是项目资产，入库」）。

### 已实测 vs 未实测（如实区分）

**已实测（本报告全部结论）**：
D-4-a/b/c 三条的 grep 事实 · 4 个「无测试覆盖」声明的真伪（9 个测试文件全集）·
16 个导出的清单完整性 · `stats.ts` 对 HEAD 116 增 0 删、原 164 行代码 md5 未变 · `D-5` 的零引用事实 ·
核验脚本正向运行（22 断言 PASS）· **12 个自建变异体的鉴别力测试** ·
独立重建旧注释头的负向对照（FAIL）· `npm test` 168/168 · `tsc` exit 0 ·
`eslint` 全库 0/0 · `date-window` 0 命中 · 干净 build exit 0 四页全 ○ ·
静态壳 a11y 抽查 · 构建日泄漏 0。

**未实测（环境限制或超出范围）**：
- **真机浏览器行为** —— 本机 Chrome 启动失败（**exit code 3**）。
  客户端交互、`role="status"` 的实际播报、键盘导航**均未在浏览器中验证**；
  a11y 结论仅基于**构建产物 HTML 的静态文本**。
- **真实 Supabase / RLS** —— 未连真实后端，SQL 与策略未验证。
- **其它工作包**（WP-1/WP-2/WP-6）的代码质量 —— 不在审核范围，未审查。
  它们的测试被计入 168/168 基线，但那部分**不代表我认可它们**。

---

**判定：不通过 —— D-4 三条已闭环、D-5 已如实登记、代码与门禁全部干净，
唯独核验脚本 `wp3-coverage-check.mjs` 存在 3 处可复现假 PASS。
修掉 D-6-a/b/c（只改这一个文件，不碰产品代码）后即可提交，scope 仍用 `data`。**
