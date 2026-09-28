# WP-3 返工报告（round 3）—— D-4 三处注释事实错误修复

- 返工方：WP-3 施工方
- 审核基线：`97fa76d`（= round 2 报告所述 `HEAD`）
- 处理对象：`reviewer-wp3-round2.md` §3 的 D-4-a / D-4-b / D-4-c
- 结论：**三条均已独立核实为真并已修复**；核实过程中**另发现 1 处审核员未捕获的事实错误（D-5）**，一并如实记录
- **未做任何 git 写操作**（无 `add` / `commit` / `stash` / `checkout`），交回复审

---

## 0. 交付摘要

| 项 | 结果 |
|---|---|
| D-4-a `num()`「公共收敛点」 | **独立核实为真**，已改为「② 组内部的收敛点」 |
| D-4-b `TxFilter`「仅由测试直接覆盖」 | **独立核实为真**，移出 ② 组，单列 ③ 组 |
| D-4-c「以上日期函数另由 query-params.test.ts 覆盖」 | **独立核实为真**，改为只列 3 个，`lastDayKeys`/`shanghaiDate` 明写「无测试覆盖」 |
| **D-5（自查新发现）** | **`TxSummary` 被 `:4` 的「每个导出都有真实调用点或真实测试兜底」隐含覆盖，实测两者皆无** |
| 覆盖度机器核验 | 新增 `.hermes/audits/wp3-coverage-check.mjs`，22 条断言全通过，**并带负向对照（对旧注释 FAIL）** |
| 门禁 | tsc exit 0 / eslint 0 error 0 warning / `npm test` 167/167 / `date-window` 0 命中 |

**代码零改动**：`stats.ts` 的代码体仍是 237 行（与返工前 258−21 头注释 = 237 完全一致），
本轮全部改动限于文件头注释块 + 新增一个核验脚本。

---

## 1. 三条断言的独立核实

审核员的结论我**没有照抄**，逐条自己跑了 grep / 计数。结论：**三条全部为真**。

### 1.1 D-4-a —— `num()` 确实不属第 ① 组

```
$ awk 'NR>=186' src/lib/ledger/stats.ts | grep -c 'num('
0                                    ← 第 ① 组（日期函数段）内 0 次
$ grep -c 'num(' src/lib/ledger/stats.ts
15                                   ← 全文件 15 行命中
```

逐行定位（`grep -n 'num('` 全量）确认：**除第 33 行的函数声明 `function num(...)` 与
第 21 行的注释自身外，14 处调用全部落在第 ② 组的 6 个函数里**：

```
monthlyTrend(77,78) / categoryShare(97) / assetCurve(123) / filterTxs(154) /
summarizeTxs(172,173,174) / accountBalances(189,192,194,196,197)
```

`shanghaiDate` / `shiftDays` / `lastDayKeys` / `monthEnd` / `prevMonthKey`
**一个都没调用 `num()`**。审核员判定**成立**。

> **计数口径提示（审核员 §3.1 数字需按此理解）**：「15」是**命中行数**；
> 真实调用**处数是 14**、分布在 **13 个代码行**（`stats.ts:123` 一行内有两处
> `-num(...)` 与 `num(...)`）。注释里我把两个数字都写明了，避免下一个核查者
> 再次对不上账。审核员用 `grep -c` 得到 15，与「处数 14」不矛盾，是口径不同。

### 1.2 D-4-b —— `TxFilter` 在 `stats.test.ts` 确实 0 引用

```
$ grep -c "TxFilter" src/lib/ledger/stats.test.ts
0
$ grep -rn "TxFilter" src/
src/lib/ledger/stats.ts:18   ← 注释自身
src/lib/ledger/stats.ts:112  ← 类型定义
src/lib/ledger/stats.ts:123  ← filterTxs 的形参类型
```

`TxFilter` 全库仅 3 处命中，**全部在 `stats.ts` 内部**，测试文件 0 引用。
注释把它放进「仅由 `stats.test.ts` 直接覆盖」的 ② 组，是把一条不存在的回归网
写成了存在的。审核员判定**成立**。

### 1.3 D-4-c —— 5 个日期函数只有 3 个被覆盖

逐符号计数（`\b<符号>\b`，两个测试文件分别统计）：

```
shiftDays      query-params.test.ts=10   stats.test.ts=0   ✔
monthEnd       query-params.test.ts= 7   stats.test.ts=0   ✔
prevMonthKey   query-params.test.ts= 6   stats.test.ts=0   ✔
lastDayKeys    query-params.test.ts= 0   stats.test.ts=0   ✘ 无任何测试
shanghaiDate   query-params.test.ts= 0   stats.test.ts=0   ✘ 无任何测试
```

`lastDayKeys` / `shanghaiDate` 恰是 5 个里**唯二**同时出现在生产调用点的
（`data-client.tsx:9,217,246` + `transaction-form.tsx:12,46`），却**恰恰是唯一无测试的**。
审核员判定**成立**。

### 1.4 补充：同一份计数表顺带暴露的第 4 处错误（D-5，自查发现）

我在做 §1.3 的逐符号计数时把 `stats.ts` 的**全部 16 个导出**都跑了一遍，
发现审核员未捕获的一处：

```
$ grep -rn '\bTxSummary\b' . --include='*.ts' --include='*.tsx'   (排除 node_modules/.next)
./src/lib/ledger/stats.ts:143:export type TxSummary = { ... }     ← 定义
./src/lib/ledger/stats.ts:145:export function summarizeTxs(txs): TxSummary {  ← 内部消费
```

**`TxSummary` 在 `stats.ts` 之外零引用，在任何 `*.test.ts(x)` 里也零引用。**
而返工前的注释第 4 行写着 blanket claim：

> 「下面**每个导出**都有**真实调用点或真实测试**兜底，故一行不删。」

这条 blanket claim 把 `TxSummary` 隐含地纳入了「有兜底」，而它**两者都没有**。
性质与 D-4 完全同类：**注释用来防死代码，却自己陈述了一条不成立的事实。**
这正是 [D-25] 那次「164 行零调用点死代码」争议的残留 —— `TxSummary` 至今仍是一个
**真正零调用点的导出**，只是被 `summarizeTxs` 的返回类型位置拴住了。

> **我不主张删 `TxSummary`**：它是 `summarizeTxs` 的公开返回类型，`summarizeTxs`
> 本身有 4 处测试覆盖，删类型会破坏 API 边界。这属于「保留但如实标注」，
> 不属于本轮 D-4 的阻塞范围。**但它必须被如实写出来，不能被 blanket claim 盖住。**

（顺带核实：同一轮计数确认 `TxLike` **有** 2 处 `stats.test.ts` 引用（`:23` import、
`:26` 工厂函数签名），所以 `TxLike` 留在 ② 组是属实的。）

---

## 2. 改了什么

**唯一被修改的源文件：`src/lib/ledger/stats.ts` 的文件头注释块**（第 1–43 行）。
代码体 0 改动（237 行，前后一致）。

结构上做了三件事，让注释**可被机器解析**，从而支持第 3 节的覆盖度核验：

1. **清单从「斜杠分隔 + 换行箭头」改为「每行一个 `符号 → 路径`」**。
   旧写法（`filterTxs / TxFilter / monthKey / ...` 换行后再跟箭头）无法逐符号
   machine-check；新写法每条声明独立成行，可逐行解析与核对。
   > 审核员 §2.2 曾认可返工方拒绝 `{a,b}.ts` 花括号写法的理由。平铺写法是对的，
   > 但**平铺的是符号、不是路径**时才可解析 —— 上一轮混淆了这两者。
2. **把「无测试覆盖」写成显式标记 `(无测试覆盖)`**，而不是散文描述。
   这样「哪些符号没有测试」成为一条可机器核对的断言，而不是需要读者自行推断的语气。
3. **删掉 blanket claim**，改为逐个导出列举，允许出现「无兜底」这一诚实结论。

逐条对应：

| 缺陷 | 改前 | 改后 |
|---|---|---|
| **D-4-a** | 「`num()` 是**上面两组的公共收敛点**。删任何一行都会同时打断调用点或 `npm test`。」 | 「`num()` 是 **② 组内部**的收敛点 —— 第 ① 组的日期函数不经过它（本文件 14 处 `num(` 调用、分布在 13 个代码行，全部落在 ② 组内）。删掉 ② 组任一导出会打断 `npm test`；删掉 ① 组任一导出会打断上列生产调用点。」 |
| **D-4-b** | `TxFilter` 列在 ② 组「仅由 `stats.test.ts` 直接覆盖」 | `TxFilter` 移出 ② 组，单列 ③ 组：`TxFilter → (无测试覆盖)`，并注明「只被同文件 `filterTxs` 的形参消费」 |
| **D-4-c** | 「（以上日期函数另由 `src/app/data/query-params.test.ts` 覆盖）」 | ③ 组只列 `shiftDays / monthEnd / prevMonthKey → src/app/data/query-params.test.ts`；`lastDayKeys / shanghaiDate → (无测试覆盖)`，并注明「唯一兜底是 ① 组的生产调用点」 |
| **D-5（自查）** | blanket claim「下面每个导出都有真实调用点或真实测试兜底」 | blanket claim 删除；`TxSummary → (无测试覆盖)`，注明「stats.ts 之外也无任何引用方；仅作为 `summarizeTxs` 的返回类型存在，而 `summarizeTxs` 本身有测试」 |

**关键取舍：`lastDayKeys` / `shanghaiDate` / `TxFilter` / `TxSummary` 我如实写了
「无测试覆盖」，没有为了注释好看而声称有覆盖。** 上一轮把 `lastDayKeys` /
`shanghaiDate` 写成「被覆盖」，本轮宁可承认缺口。这是本注释的全部存在价值所在。

---

## 3. 方法论根因的修复：把覆盖度变成机器可验证的断言

审核员 §7 指出上一轮核验的方法缺口：

> 「脚本做三件事：`date-window` 0 命中 / 路径 `existsSync` / 符号 `export` 存在。
> **这三件事都属实**，脚本没撒谎。但注释的**覆盖度声明**不在脚本检查范围内。
> **不是 dishonesty，是方法覆盖不足**。」

**接受该判定。** 新增 `.hermes/audits/wp3-coverage-check.mjs`，把「覆盖度」从
散文变成断言：

| 规则 | 内容 | 拦住的缺陷 |
|---|---|---|
| **RULE A** | 清单里每条 `符号 → 路径`，该符号必须真的出现在该路径里（`\b` 边界匹配） | D-4-c |
| **RULE B** | 标 `(无测试覆盖)` 的符号，必须在 `src/**` 全部 9 个 `*.test.ts(x)` 里确实 0 引用 | D-4-b、D-5 |
| **RULE C** | C1 日期口径段内 `num(` 调用数 = 0；C2 注释声称的「处数 / 代码行数」两个数字必须与实测一致 | D-4-a |
| **GUARD** | 断言总数不得为 0；**任何一条 `→ 路径` 若解析出空符号列表，直接判 FAIL** | 防 vacuous pass |

RULE B 是**双向**的：既拦「谎报有覆盖」（D-4-c），也拦「谎报没覆盖」——
若某符号其实有测试却被标成 `(无测试覆盖)`，同样 FAIL。避免把注释改成
另一个方向的错误。

**GUARD 与空符号拦截是本轮实测中加入的**，原因见下：脚本第一版对**返工前**的
旧注释跑出 **PASS**（只抓到 1 条声明，其余全被解析器漏掉）——
一个对错误注释报 PASS 的检查比没有检查更危险。据此重写了解析器
（同时支持旧式「符号列表行 + 换行箭头」与新式「同行箭头」两种写法），
并加了 GUARD。详见 §5 的负向对照。

### 3.1 正向运行的真实输出

```
$ node .hermes/audits/wp3-coverage-check.mjs
WP-3 覆盖度核验 —— 注释声明 vs 实测引用
目标文件: src/lib/ledger/stats.ts  (注释头 43 行)
测试文件全集 (9): src/app/data/query-params.test.ts, src/app/ledger/type-picker.test.ts, src/components/confirm-submit-button.test.ts, src/lib/api/401-storm.test.ts, src/lib/api/api-cache.test.ts, src/lib/api/client.test.ts, src/lib/api/session-outcome.test.ts, src/lib/ledger/format.test.ts, src/lib/ledger/stats.test.ts

[RULE A] 清单里每条「符号 → 路径」，符号必须真的出现在该路径中 (16 条)
  ok    shiftDays → src/app/data/presets.ts : 全部在位
  ok    monthEnd → src/app/data/presets.ts : 全部在位
  ok    prevMonthKey → src/app/data/presets.ts : 全部在位
  ok    lastDayKeys → src/app/data/data-client.tsx : 全部在位
  ok    shanghaiDate → src/app/data/data-client.tsx : 全部在位
  ok    shanghaiDate → src/app/ledger/transaction-form.tsx : 全部在位
  ok    filterTxs → src/lib/ledger/stats.test.ts : 全部在位
  ok    monthKey → src/lib/ledger/stats.test.ts : 全部在位
  ok    lastMonths → src/lib/ledger/stats.test.ts : 全部在位
  ok    monthlyTrend → src/lib/ledger/stats.test.ts : 全部在位
  ok    categoryShare → src/lib/ledger/stats.test.ts : 全部在位
  ok    assetCurve → src/lib/ledger/stats.test.ts : 全部在位
  ok    summarizeTxs → src/lib/ledger/stats.test.ts : 全部在位
  ok    accountBalances → src/lib/ledger/stats.test.ts : 全部在位
  ok    TxLike → src/lib/ledger/stats.test.ts : 全部在位
  ok    shiftDays / monthEnd / prevMonthKey → src/app/data/query-params.test.ts : 全部在位

[RULE B] 标 (无测试覆盖) 的符号必须在所有测试文件里 0 引用 (4 个)
  ok    lastDayKeys : 测试文件中 0 引用 —— 声明属实
  ok    shanghaiDate : 测试文件中 0 引用 —— 声明属实
  ok    TxFilter : 测试文件中 0 引用 —— 声明属实
  ok    TxSummary : 测试文件中 0 引用 —— 声明属实

[RULE C] `num()` 收敛声明 (D-4-a)
  ok    C1 日期口径段 (第 208 行起) 内 num( 调用数 = 0 —— 「第 ① 组不经过 num()」属实
  ok    C2 注释声称 14 处 / 13 个代码行，实测 14 处 / 13 行（行 78,79,97,123,154,172,173,174,189,192,194,196,197）—— 属实

[GUARD] 解析器抓到的断言总数: 20 + RULE C 2 条 = 22

断言总数: 22  失败: 0
RESULT: PASS —— 注释里每一条覆盖度声明都经实测为真。
EXIT=0
```

### 3.2 负向对照 —— 对返工前的旧注释跑，必须 FAIL

**这是本轮方法论修复的核心证据。** 把返工前的原始注释头复制到
`.hermes/.tmp-check/old-header.ts`（临时目录，已删除）后跑同一脚本：

```
$ node .hermes/audits/wp3-coverage-check.mjs .hermes/.tmp-check/old-header.ts
目标文件: .hermes/.tmp-check/old-header.ts  (注释头 21 行)

[RULE A] (4 条)
  ok    shiftDays / monthEnd / prevMonthKey → src/app/data/presets.ts : 全部在位
  ok    lastDayKeys / shanghaiDate → src/app/data/data-client.tsx : 全部在位
  ok    shanghaiDate → src/app/ledger/transaction-form.tsx : 全部在位
  FAIL  lastDayKeys → src/app/data/query-params.test.ts : 该文件里找不到 \blastDayKeys\b  ← 覆盖度声明不实
  FAIL  shanghaiDate → src/app/data/query-params.test.ts : 该文件里找不到 \bshanghaiDate\b  ← 覆盖度声明不实

[RULE B] 标 (无测试覆盖) 的符号必须在所有测试文件里 0 引用 (0 个)

[RULE C] `num()` 收敛声明 (D-4-a)
  FAIL  未找到「日期口径（Asia/Shanghai）」分隔行，无法定位第 ① 组 —— 注释结构已变，需更新核验脚本
  FAIL  C2 注释里没有同时写明 `num(` 的「处数」与「代码行数」，无法核对

断言总数: 6  失败: 4
RESULT: FAIL
EXIT=1
```

**旧注释 FAIL，新注释 PASS。** 脚本具备鉴别力，不是恒真。

> 诚实披露：旧注释的 `num()` 段与 RULE C 报的是「无法定位 / 未写明数字」
> 而非直接证伪 —— 因为旧注释根本没给出可核对的数字，脚本无从判真伪。
> 真正**证伪**旧注释的是 §1.1 / §1.2 / §1.3 的原始 grep 计数。
> RULE C 的鉴别力体现在它**抓出了我自己写的**「15 处」与实测 14 处不符（见 §5），
> 修好后才对。这条如实记下，不夸大为「三条全被脚本自动拦截」。

---

## 4. 门禁真实输出

四项全部亲跑，**零外部阻塞、无浏览器依赖**。

### 4.1 `npx tsc --noEmit --incremental false` → exit 0

```
$ npx tsc --noEmit --incremental false
（无输出）
TSC_EXIT=0
```

### 4.2 `npx eslint` → 0 error 0 warning

```
$ npx eslint .                                    # 全库
（无输出）
ESLINT_EXIT=0

$ npx eslint src/app/data src/app/api/data/route.ts src/lib/ledger/stats.ts   # 本包
（无输出）
ESLINT_EXIT2=0
```

### 4.3 `npm test` → 167/167 全绿

```
ℹ tests 167
ℹ suites 38
ℹ pass 167
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6988.2456
TEST_EXIT=0
```

基线 167/167 保持，未新增/删除任何测试。`stats.test.ts` 全绿。

### 4.4 `grep -rn "date-window" src/` → 0 命中

```
$ grep -rn "date-window" src/
（0 命中）
GREP_EXIT=1        ← grep 无命中时返回 1，符合预期
```

---

## 5. 过程中被自己的检查抓到的错误（如实披露）

**RULE C 的 C2 抓出了我本轮自己写错的一个数字。** 我最初在注释里写
「本文件 15 处 `num(` 调用」（照抄审核员的 `grep -c` 口径），脚本实测 14 处，报：

```
FAIL  C2 注释声称 15 处 / 13 个代码行，实测 14 处 / 13 行 —— 数字已过期
```

追查后确认：真实调用**处数是 14**、分布在 **13 个代码行**（`stats.ts:123`
一行内含两处 `num(`），审核员的 `grep -c` 得到的 15 是**命中行数**（含
`function num(` 声明行与注释行）。**已把注释改为同时写明两个数字。**

这正是「把数字变成可核对的断言」的价值：注释里的数字从此不再是散文，
而是会被机器逐个复核的东西。同类问题若留在散文里，下一个核查者还会踩。

---

## 6. 诚实性自查

| 检查项 | 结论 | 依据 |
|---|---|---|
| 是否照抄审核员结论 | **否** | §1 三条全部自己跑 grep 重新计数；§1.3 的逐符号表是我自己扩到全部 16 个导出跑出来的 |
| 是否发现审核员遗漏 | **是（D-5）** | `TxSummary` 零引用、零测试，却被告警 blanket claim 隐含覆盖；已如实写入并修掉 |
| 是否为注释好看而声称有覆盖 | **否** | `lastDayKeys` / `shanghaiDate` / `TxFilter` / `TxSummary` 四个**明确写「无测试覆盖」** |
| 覆盖度核验是否真的能失败 | **是** | §3.2 负向对照：旧注释 FAIL（exit 1），新注释 PASS（exit 0） |
| 是否夸大核验脚本能力 | **否** | §3.2 末尾如实说明：旧注释的 RULE C 报的是「无法核对」而非直接证伪 |
| 代码是否被改动 | **否** | `stats.ts` 代码体 237 行 = 返工前 258−21 = 237，逐行一致 |
| 是否只动了自己名下文件 | **是** | 本轮仅改 `src/lib/ledger/stats.ts`（头注释）+ 新增 `.hermes/audits/wp3-coverage-check.mjs` + 本报告；临时对照目录 `.hermes/.tmp-check/` 已 `rm -rf` 删除 |
| 是否做了 git 写操作 | **否** | 无 `add` / `commit` / `stash`；`git rev-parse --short HEAD` 仍为 `97fa76d` |
| `git status` 里其它被改文件 | **非本轮所为** | `.gitignore` / `eslint.config.mjs` / `src/lib/api/**` 等的改动是**基线已存在**的其它工作包（WP-1/WP-2/WP-6）遗留，本轮未触碰 |

---

## 7. 复审命令

```bash
# ① 覆盖度机器核验（核心，本轮新增）
node .hermes/audits/wp3-coverage-check.mjs        # 期望 exit 0，断言总数 22，0 失败

# ② 负向对照：对返工前的旧注释必须 FAIL
#   （脚本支持 argv[2] 传目标文件；旧注释头见 reviewer-wp3-round2.md §3 引用的原文）

# ③ D-4 三条断言的原始 grep
awk 'NR>=186' src/lib/ledger/stats.ts | grep -c 'num('                        # 期望 0
grep -c "TxFilter" src/lib/ledger/stats.test.ts                               # 期望 0
grep -c "lastDayKeys\|shanghaiDate" src/app/data/query-params.test.ts        # 期望 0
grep -rn "TxSummary" src/ --include='*.ts' | grep -v 'stats.ts'             # 期望 0（D-5）

# ④ 门禁
npx tsc --noEmit --incremental false     # 期望 exit 0
npx eslint .                             # 期望 exit 0，0 error 0 warning
npm test                                 # 期望 167/167
grep -rn "date-window" src/              # 期望 0 命中（grep exit 1）
```

**不需要浏览器，不需要构建锁。** 本轮未跑 `npm run build`
（round 2 的 D-3 已由审核员取得干净 build，且本轮**零代码改动**，
注释不参与类型检查与构建产物；但复审若要保持仪式完整，可按
`reviewer-wp3-round2.md` §9 的 build 段复跑取锁。）

---

## 8. 交付

- 改动文件：`src/lib/ledger/stats.ts`（**仅文件头注释**，第 1–43 行；代码体 0 改动）
- 新增文件：`.hermes/audits/wp3-coverage-check.mjs`（只读核验脚本，不修改任何文件）
- 新增报告：本文件
- **未做任何 git 写操作**，未暂存、未提交、未 stash。`HEAD` 仍为 `97fa76d`。

**交回复审。** D-4-a/b/c 三条已闭环；D-5 为本轮自查新增，如实呈报，
请判定其是否构成独立的阻塞项（我倾向于**不阻塞**，因为它只要求如实标注、
不涉及代码改动，但注释的「事实为真」标准应当由复审裁定）。
