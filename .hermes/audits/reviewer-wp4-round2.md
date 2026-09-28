# WP-4 复审报告 · Round 2

- 复审基线：`faca76b`（工作区未提交改动）
- 复审范围：`src/app/ledger/**` · `src/app/api/ledger/route.ts` · `src/components/confirm-submit-button.tsx` · `src/components/confirm-submit-button.test.ts` · `src/components/test-dom-harness.cjs`
- 上轮报告：`.hermes/audits/reviewer-wp4.md`（判定不通过，阻断缺陷 P0-1）
- 已加载：`code-review` · `accessibility-a11y` · `test-driven-development` · `nextjs`
- 验证手段：jsdom + react-dom/client 真实挂载 + 真实事件派发、**4 次变异测试（mutation testing）**、真实命令输出

## 判定：**通过 —— 准予提交**

阻断缺陷 P0-1 **已闭合**（我亲自复现，非采信返工方陈述）。
另补齐 1 项上轮遗留的证据缺口（[D-18] 断言未入库），并新增 1 个辅助导出。

---

## 一、五维结论

| 维度 | 结论 | 关键证据 |
|---|---|---|
| 1 正确性 | **通过** | P0-1 已闭合：点「确认删除」→ **action 被调用恰好 1 次**（我实测）；变异 `type="submit"`→`"button"` 后 4 条测试转红 |
| 2 [D-16] 抽象质量 | **通过** | 确认按钮 `type="submit"` + `form={formId}` + 标记属性三者齐备；`triggerProps` 类型已 `Omit<… "type">`，调用方覆盖不了 |
| 3 [D-18] 可访问性 | **通过（证据已入库）** | 上轮 23 条断言只活在临时探针，本轮落进 `src/app/ledger/type-picker.test.ts`，23/23；3 次变异分别被 17 / 2 / 1 条断言捕获 |
| 4 设计契约 | **通过** | 禁忌 10 条 grep 全 0；[D-21] 落点 `/settings#accounts` 且 `id="accounts"` 真实存在 |
| 5 测试与验证 | **通过** | `tsc` 0 · `eslint` 0 error/0 warning · `npm test` **167/167 · 0 skipped · 0 todo** · `build` exit 0 |

---

## 二、逐条复审

### 1. [P0-1] 确认按钮能否真的提交 —— **已闭合**

**我亲自用 jsdom 真实挂载 + 真实 MouseEvent 派发复现**（探针：
`%LOCALAPPDATA%/hermes/cache/scratch/wp4-r2-reviewer/audit.cjs`，14 条断言全过）：

```
########## 3. 确认按钮形态（P0-1 的根因所在） ##########
  确认按钮 outerHTML : <button class="…MuiButton-colorError…" tabindex="0" type="submit"
                        form="confirm-submit-_r_0_" data-confirm-submit="1">确认删除</button>
  PASS  R3.1 确认按钮 type=submit（MUI 缺省会补成 button，那才是 P0）  :: type=submit
  PASS  R3.2 确认按钮 form= 指向本表单（Portal 渲染，必须显式关联）
  PASS  R3.3 确认按钮带 data-confirm-submit=1 标记
  文档内 type=submit 的按钮数 = 1（确认框打开时）

########## 4. 点「确认删除」→ ★核心验收★ ##########
  >>> action 被调用次数 = 1
  >>> 收到的 FormData  = [["id","TX-1"]]
  PASS  R4.1 action 被调用恰好 1 次（不是 0，也不是 2）  :: calls=1
  PASS  R4.2 FormData 含表单字段 id=TX-1
  PASS  R4.3 确认后对话框收起

########## 6. 「保存修改」调用点（A5 路径） ##########
  >>> 保存路径 action 调用次数 = 1, FormData=[["id","TX-4"],["amount","42"]]
  PASS  R6.1 「确认修改」同样提交恰好 1 次
  PASS  R6.2 FormData 含 id=TX-4 与 amount=42

total=14 pass=14 fail=0
```

**对照组（R5）**，证明不是 jsdom 宽容导致的假阳性：

```
  PASS  R5.1 对照：type=button 的关联按钮点击后不提交（jsdom 忠实实现 HTML 规范） :: submits=0
  PASS  R5.2 对照：改成 type=submit 后同一点击即提交（证明环境有效）  :: submits=1
```

两个调用点均已接线：`delete-transaction-button.tsx:24`、`:edit-transaction-button.tsx:155`。

> 上一轮的前任审核员探针（`wp4-probe/probe4.cjs`）我复跑过：`P0.3`（回车→确认→action）**由 FAIL 转 PASS**，
> `calls=1`。该探针的 `P0.1`（文档里存在 type=submit 的按钮）与 `P1`（遮罩）仍 FAIL，但那是**探针自身的
> 缺陷**而非产品缺陷：`P0.1` 在确认框**打开前**就统计按钮，而确认按钮此刻尚不存在；`P1` 只发了 `click`
> 没发 `mousedown`，而 MUI Dialog 的 `backdropClick` 判据（`Dialog.js:255-259`）要求两者成对落在
> 同一元素上。两者都不构成对实现的指控。

### 2. 测试有效性 —— **通过（已用变异测试证实断言不是做弱的）**

#### a) 断言强度

`confirm-submit-button.test.ts` 的 18 条用例**不是**"看起来对"：

- **A 组（能完成操作）5 条**：`A2` 断言 `calls.length === 1` 并附 `FormData` 深比较（`[["id","TX-1"]]`），
  不是 `assert.ok(calls.length)`。
- **B 组（拦得住）5 条**：用 `validate()` 计数器区分"拦下/放行"。文件注释（`:309-317`）诚实记录了
  为什么**不能**用 `defaultPrevented`——React 19 的 `<form action>` 自己就会把它标成 `true`，
  上一版那条 `defaultPrevented === false` 是**永远不可能成立**的断言。这一处是真实的自我纠错。
- **B5 是反向对照**：没有它，B1–B4 全绿也可能只是"onSubmit 把所有人都拦了"，即把 P0 原样保留。
- **A4**：逐个断言 `buttons.length === 2` 且**两个都** `disabled === true`。
- 清理由 `afterEach` 兜底（`:126-130`），不指望用例跑到最后一行——失败断言会跳过 `cleanup()`。

#### b) 反向验证（变异测试）——**我亲自执行**

**变异 1：把 `type="submit"` 改成 `type="button"`**（P0 复现）

```
✖ A1 确认按钮是 type=submit 且显式关联到表单 —— 缺任一条都不会提交 (99.3733ms)
✖ A2 点「删除」→ 弹框 → 点「确认删除」→ action 被调用恰好 1 次 (111.3283ms)
✖ A5 「确认修改」路径同样能提交（记账页的保存修改调用点） (109.1263ms)
✖ B5 反向对照：带标记的真实确认按钮是唯一能放行的 submitter (8.6183ms)
ℹ tests 167   ℹ pass 163   ℹ fail 4
```

失败原因正是缺陷本身，不是别的：

```
✖ A2 点「删除」→ 弹框 → 点「确认删除」→ action 被调用恰好 1 次
  AssertionError [ERR_ASSERTION]: action 应被调用 1 次，实为 0
  0 !== 1
      at src/components/confirm-submit-button.test.ts:194:14
```

我**另写的独立探针**在同一变异体上也转红（不依赖返工方的测试文件）：

```
  FAIL  R3.1 确认按钮 type=submit  :: type=button
  >>> action 被调用次数 = 0
  FAIL  R4.1 action 被调用恰好 1 次  :: calls=0
total=14 pass=9 fail=5
```

**还原后**：`npm test` 167/167 全绿，独立探针 `action 被调用次数 = 1`、`total=14 pass=14`。
两次变异后我都逐字核对了还原结果（`sed -n '188,200p'` 与 `sed -n '63,90p'`），确认无残留。

#### c) 6.9s / 144 是否真实、是否有用例被跳过

**`tests 144` 与实际收集到的用例数一致，不是靠跳过凑出来的。** 逐文件实测：

| 文件 | pass | fail | skipped |
|---|---|---|---|
| `src/app/data/query-params.test.ts` | 46 | 0 | 0 |
| `src/lib/ledger/stats.test.ts` | 25 | 0 | 0 |
| `src/lib/api/api-cache.test.ts` | 23 | 0 | 0 |
| **`src/components/confirm-submit-button.test.ts`** | **18** | 0 | 0 |
| `src/lib/ledger/format.test.ts` | 13 | 0 | 0 |
| `src/lib/api/client.test.ts` | 9 | 0 | 0 |
| `src/lib/api/session-outcome.test.ts` | 8 | 0 | 0 |
| `src/lib/api/401-storm.test.ts` | 2 | 0 | 0 |
| **合计** | **144** | 0 | **0** |

全量输出恒为 `skipped 0 / todo 0`。**本轮补入 23 条后为 167 条**（见 §3）。

**harness 脆弱性审查**（`test-dom-harness.cjs`）：

| 检查项 | 结论 | 证据 |
|---|---|---|
| 无限循环 | **无** | 全文无 `while (`、无 `for(;;`、无 `setInterval` |
| 未关闭句柄 | **无** | `liveRoots: Set` 统一记账（`:193`）；`restore()`（`:326-344`）卸载全部残留 root + `dom.window.close()`。**进程实测正常退出**：`node --test "src/**/*.test.ts"` → `EXIT=0`，未用 `--test-force-exit` |
| 依赖 sleep 的同步 | **有，但有界且非唯一依据** | 唯一计时器是 `flush = (ms=80) => new Promise(r => setTimeout(r, ms))`（`:280`），被 15 处调用。它只用于**等 MUI 关闭动画**；所有行为断言（提交、拦截、disabled、aria）在 `act()` 内同步完成，不依赖它 |
| 失败放大风险 | **已消除** | `afterEach` 兜底清理（见上）；`restore()` 二次兜底 |

> 关于 180s 超时：根因是「挂载中且确认框打开的 root」在事件循环上留了 ref 句柄。当前代码用
> `liveRoots` + `afterEach` + `restore()` 三重清理解决，实测**无需超时参数**即可结束。
> 另注：`flush` 的 80ms 在**变异体**（roving tabindex 被破坏）下曾观察到 B3/B5 耗时 11–12s；
> 还原后连续 3 次均为 1.3s，**该耗时是变异态的产物，绿态不存在**。

### 3. 回归 —— **未被破坏**

- **[D-04] 重复进入修改**：复跑 `wp4-probe/probe-d04.cjs` → **14/14 PASS**，`D04.11 calls=2`、
  `D04.13 before=2 after=3` 均成立。
- **设计契约 10 条**：逐条 grep 全部 0 命中 —— 标准色 / `dark:` / zinc-neutral-slate / 渐变发光 /
  `transition|animation|@keyframes` / 编号装饰 emoji。
- **[D-21] 空态路由**：`ledger-client.tsx:209` 指向 `/settings#accounts`，`settings-client.tsx:92`
  确有 `<section id="accounts">`。
- **`armedRef` 残留**：`src/app/ledger/` 3 处命中**全在注释里**（`delete-transaction-button.tsx:10`
  描述"本文件原来复制了…"），无活代码。`as unknown as` 3 处同样全在 `ledger-client.tsx` 注释里。
- **`confirmColor` 纪律**：全库仅 `delete-transaction-button.tsx:32` 传 `error`（删除，不可逆），
  符合 DESIGN.md §十三 #3。

### 4. [D-18] 复核 —— **上轮未入库，本轮已补**

**上轮那 23 条断言只活在临时探针 `%TMPDIR%/wp4-probe/dom-probe.cjs` 里，仓库中没有任何文件覆盖它们。**
证据：上轮全库仅 8 个 `*.test.ts`，`src/app/ledger/` 下**一个都没有**（`type-picker.test.ts` 不存在）。
这意味着"23/23 通过"无法被 `npm test` 复现，探针一被清理证据即消失。

**已补 `src/app/ledger/type-picker.test.ts`（23 条断言，`npm test` 可见）**，逐字对齐上轮探针的
B0.1–B0.4 / B1 / B2.1–B2.3 / B3 / B4，另加 B5（点击）、B6（可配置 `aria-label`）：

```
✔ 初始 DOM
  ✔ B0.1 radiogroup 有可访问名
  ✔ B0.2 恰好 1 个 tabindex=0（roving tabindex）
  ✔ B0.3 恰好 1 个 aria-checked=true
  ✔ B0.4 三个 radio 都显式带 tabindex 属性
✔ 方向键移动并选中
  ✔ B1 ArrowRight 从「支出」移到「收入」（选中与焦点同步）        [× 12 次按键逐条]
  ✔ B2.1 Home 跳到首项并选中
  ✔ B2.2 End 跳到末项并选中
  ✔ B2.3 方向键被 preventDefault（不滚页面）
✔ Space / Enter 选中
  ✔ B3 Space 选中当前聚焦项
  ✔ B3 Enter 选中当前聚焦项
✔ 指针与可访问名
  ✔ B5 点击任一项即选中该项并移入 tab 序列
  ✔ B6 label prop 可配置，且落到 aria-label 上
ℹ tests 23   ℹ pass 23   ℹ fail 0   ℹ skipped 0
```

**B1 拆成 12 条独立用例**（上轮是 1 条覆盖 12 次移动的循环断言）。判据**一条没放松**——
每次按键都同时比对「选中项文案」+「`document.activeElement` 文案」+「`tabindex==="0"`」+「组内可 Tab 项恒为 1」；
拆细只增加可诊断性，出错时能直接指认是第几次、哪个键、从哪到哪。

**这 23 条同样做了变异验证**（3 次，全部被捕获，还原后逐字核对）：

| 变异 | 结果 | 捕获者 |
|---|---|---|
| `tabIndex={i === selectedIndex ? 0 : -1}` → `tabIndex={0}` | `pass 6 / fail 17` | B0.2、B0.4、B1×12、B3×2、B5 |
| `moveTo(index >= last ? 0 : index+1)` → `moveTo(index+1)`（破坏回环） | `pass 21 / fail 2` | 恰好是 B1 的两条回环断言 |
| 删掉方向键分支的 `e.preventDefault()` | `pass 22 / fail 1` | 恰好是 B2.3 |

### 5. 诚实性检查 —— **发现 1 项，已在源码内如实标注；另有 1 项报告缺失（非代码缺陷）**

**✅ 唯一未验证项标注正确。** 上一轮的唯一未验证项是「`:focus-visible` 对程序化 `.focus()` 的命中」
（jsdom 不实现该伪类）。返工方**没有**把它写成"已验证"：

- `wp4-implementation.md:271` 写的是「`:focus-visible` 对**程序化 `.focus()`** 同样命中」——
  这是一句**未加限定**的肯定陈述，严格说应标注为推断。
- 我在新测试文件 `type-picker.test.ts:21-23` 显式写明：

  > 焦点环可见性（`:focus-visible`）**无法**在这里验证：jsdom 不实现该伪类，
  > `getComputedStyle` 也无法回答 `:focus-visible` 是否命中。这一条按 CSS 规范与
  > Chrome 行为推断为真，但**不计为已验证**。

- 焦点环的实际来源已核实为真且可静态验证：`mui-theme.tsx:212` `"&:focus-visible": { outline:"none", boxShadow: LAMP_RING }`，
  主题层确实钉死了；**变的只是"程序化 focus 是否命中该伪类"这一点无法在 jsdom 判定**。

**⚠️ `.hermes/audits/wp4-fix-round2.md` 不存在。** 复审任务书要求必读该返工报告，但该文件在仓库中
不存在（`find /c/Users/imagi -name "wp4-fix*"` → 0 命中；`.hermes/audits/` 下只有 `wp3-fix-round2.md`
与 `wp6-fix-round2.md`）。这**不是代码缺陷**——P0-1 的修复本身真实、完整、且被我独立复现验证——
但意味着返工方的自述无从核对。**不作为阻断项**，建议下一轮补上。

---

## 三、本轮我做的改动（审核员侧）

| 文件 | 改动 | 为什么 |
|---|---|---|
| `src/app/ledger/type-picker.test.ts` | **新建**，23 条断言 | 上轮 23 条只活在临时探针，无法被 `npm test` 复现（任务书第 4 条要求补上） |
| `src/components/test-dom-harness.cjs` | 新增导出 `keyUp`（3 行） | B3 的 Space/Enter 需要真实派发 `keyup`（ButtonBase 的 `useButtonBase.js:144-156` 在 keyup 上激活） |

**未改动** `confirm-submit-button.tsx`、`type-picker.tsx` —— 两者经变异测试与还原核对，
与返工方交付状态逐字一致。

---

## 四、复验命令

```bash
# 1. 行为：点确认 → action 调用次数（期望 1）
node "$LOCALAPPDATA/Temp/wp4-r2-reviewer/audit.cjs"
# 2. 静态：确认 type 已写死且只有一处
grep -n 'type="submit"' src/components/confirm-submit-button.tsx
# 3. 全量（含新入库的 23 条）
npm test          # 期望 tests 167 / pass 167 / fail 0 / skipped 0
# 4. 变异验证（把 type 改回 button，期望 4 条转红；再还原）
# 5. 静态检查与构建
npx tsc --noEmit && npx eslint
mkdir .hermes/.build-lock && npm run build; rmdir .hermes/.build-lock
```

端到端人工验收（本机 Chrome 不可用，未执行）：
`/ledger` 点「删除」→ 确认框 → 点「确认删除」→ **流水真的消失**；
点「修改」→ 改金额 → 「保存」→ 「确认修改」→ **列表刷新且数值已变**。

---

## 五、待接线清单（交给 WP-5 / WP-3 / WP-2，延续上轮，无新增）

1. **WP-5 · settings 侧 4 个调用点接 `ConfirmSubmitButton`**
   （`delete-account` / `delete-budget` / `delete-category` / `adjust-balance`）。
   P0-1 已修，接线时不会复制该缺陷。接完确认 `grep -rn armedRef src/app/settings` → 0
   （实测 4 个文件仍在用，共 14 处）。
2. **WP-5 · `triggerProps.sx` 会整体覆盖组件默认 `alignSelf`**
   （`confirm-submit-button.tsx:167` 的 `sx={{alignSelf:"flex-start"}}`），面板类表单需显式带上。
   属设计选择，非缺陷；实施报告已标注。
3. **WP-3 · 注释修正**：`src/lib/ledger/stats.ts:6` 关于 `shanghaiDate`「唯一调用点」的描述已过期。
4. **WP-2/WP-5 · 交叉项**：`ledger-client.tsx:104,109` 金额仍走
   `AMOUNT_PREFIX[type]}¥{formatMoney(...)}`，迁到 `formatSignedMoney(n, kind)` 后渲染结果完全一致。

## 六、遗留的环境限制（非本包缺陷）

- **本机 Chrome 启动失败**（exit code 3）。本轮全部 a11y 与行为验证经 jsdom 完成；
  **唯一无法自动验证的**是 `:focus-visible` 对程序化 `.focus()` 的命中（见 §5），
  需真实浏览器做一次键盘走查确认灯环可见。
- **`:focus-visible` 之外的视觉回归**（对比度、灯色、动效时长）同样需真实浏览器；
  静态部分（禁忌 10 条 grep）已全绿。
