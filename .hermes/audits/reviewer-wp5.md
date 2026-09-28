# Reviewer · WP-5（settings 设置页 + login 登录页）

- 审查对象：`src/app/settings/**`（9 个被修改文件）· `src/app/login/**`（2 个）· `src/app/api/settings/route.ts`
- 基线：`a8b3d03`（工作区未提交）
- 结论：**五维全部通过 → 准予提交**
- 审查时间：2026-09-28

---

## 0. 结论表

| 维度 | 判定 | 关键证据 |
|---|---|---|
| 1 正确性 | ✅ 通过 | [D-04] 面板渲染条件已解耦（`adjust-balance-button.tsx:79`）；`handleToggle` 每次渲染重建、闭包取最新 `currentBalance`（`:55-58`）→ **无陈旧闭包**。[D-24]a 字段名逐一匹配（`import-client.tsx:47-58` ↔ `import-actions.ts:31-53`）。[D-24]c **竞态不存在** —— 见 §3，实测证明。 |
| 2 可访问性 | ✅ 通过 | [D-19] `tabIndex=0`/`role="region"`/`aria-label` 到位（`import-client.tsx:325-330`），**且已由我用真实按键补验通过**（§2）。[D-20] notice=jade+`role="status"`、error=ember+`role="alert"`、冗余 `aria-live` 已删、焦点真实移动（`login/page.tsx:28-30, 97-111`）。[D-41] 算术核实不破坏 chip 布局（§2.3）。 |
| 3 设计契约 | ✅ 通过 | §十一 10 条我独立 grep 复核全过（§4.1）。[D-42] 只读规则已换静态类，`.chip:hover{color:ink}`（`globals.css:253-255`）不再命中。渐变遮罩**为既有代码、非本次引入**，但确属 §八 未登记例外 → 待办。 |
| 4 安全 | ✅ 通过 | `api/settings/route.ts` 鉴权/错误语义正确；文件校验不可绕过；`formData.set` 注入的 rows 走**与旧路径逐字相同**的服务端校验链；且客户端注入**不新增攻击面**（§5）。 |
| 5 测试与验证 | ✅ 通过 | `tsc --noEmit` 0 · `eslint` 本包 0 · `npm test` 98/98 · `npm run build` 成功且四页仍全 `○` 静态 · taboo-guard 12/12 · format-check 13/13 · contrast-check 11/11。 |

---

## 1. 正确性

### 1.1 [D-04] 调整余额可重复操作 —— 通过

| 检查项 | 位置 | 结论 |
|---|---|---|
| 面板渲染条件 | `adjust-balance-button.tsx:79` `{open ? (...) : null}` | ✅ 成功状态不再是渲染条件，「点不动的死控件」根因已除 |
| 成功反馈 | `:52` `justAdjusted` → `:121-125` `role="status"` + `text-jade` | ✅ |
| 失败反馈 | `:53` `adjustError` → `:126-130` `role="alert"` + `text-ember` | ✅ 两条互斥，不会同屏出现 |
| **重开时同步最新余额是否引入陈旧闭包** | `:55-58` | ✅ **不构成陈旧闭包**。`handleToggle` 是**普通函数**（非 `useCallback`），每次渲染都重新创建并捕获当轮的 `currentBalance` prop；数据刷新 → `settings-client.tsx:124` 传入新值 → 新闭包。没有把 `currentBalance` 冻结进任何 memo/ref。 |

> ⚠️ P3 观察（不阻塞）：`justAdjusted` 成功文案永不复位。收起再展开面板时，上一轮的「已调整余额，可以再调一次。」仍挂在里面，直到下一次提交才被覆盖。属文案残留，非功能缺陷。

### 1.2 [D-24]a 服务端仍能正确读到 rows —— 通过

`toPayloadRow`（`import-client.tsx:47-58`）产出字段与 `parsePayloadRows`（`import-actions.ts:31-53`）读取字段**逐项对齐**：

| 产出 | `date` | `amount` | `type` | `counterparty` | `externalId` | `categoryId` | `toAccountId` | `note` |
|---|---|---|---|---|---|---|---|---|
| 读取 | `:39` | `:40` | `:37,41` | `:42` | `:43` | `:44` | `:45` | `:48` |

`channel` 两边都不产出（客户端不传 → 服务端回落 `SOURCE_CHANNEL[source]`，`import-actions.ts:148`），与改造前 hidden input 的行为一致。`formData.get("rows")` 在 `import-actions.ts:76`。

### 1.3 [D-24]b 提交的是最新数据 —— 通过（见 §3）

---

## 2. 可访问性

### 2.1 [D-19] 键盘横滚 —— 通过（**本项由我补验，施工方的「未验证」已关闭**）

施工方报告称本机 Chrome 不可用。**实测本机 Chrome 可用**，我用真实 CDP 按键事件补验了等价页面（同 `min-w-[720px]` 表格 + `overflow-x-auto` + `tabIndex=0` + `role=region`），视口 `Emulation.setDeviceMetricsOverride(375×800, mobile)`：

```json
{
  "viewport": {"inner":377,"outer":375,"iw":805},
  "tabbable": {"tabIndex":0,"focusable":true,"role":"region","label":"导入预览表格，可横向滚动"},
  "initialScroll": 0,
  "overflowsAt375": true,
  "activeElementIsRegion": true,
  "afterArrowRight": 87,     // 3 次真实 ArrowRight 键 → scrollLeft 0→87
  "afterArrowLeft": 81,      // 2 次真实 ArrowLeft 键 → 回退
  "pageScrollWidth": 377     // 页面本身不横滚，溢出被容器兜住
}
```

- WCAG 2.2 SC 2.1.1 的「可滚动区域必须可用键盘滚动」**达标**；
- 焦点环为灯色 `focus-visible:ring-lamp/60`（`import-client.tsx:329`），符合 §十一 #9；
- 复现页：`%TMPDIR%/d19-check.html`，脚本 `%TMPDIR%/d19-cdp.mjs`。

> 诚实边界：验证对象是**等价复现页**，不是登录态下的真实 `/settings`（无 Supabase 会话）。真实页面的 CSS 类与 DOM 结构已由源码逐字确认一致，但未在真机上截屏。

### 2.2 [D-20] notice / error 彻底分离 —— 通过

| 要求 | 位置 | 结论 |
|---|---|---|
| notice = jade + `role="status"`（polite） | `login/page.tsx:107-111` + `:51` | ✅ |
| error = ember + `role="alert"`（assertive） | `login/page.tsx:97-106` | ✅ |
| 冗余 `aria-live` 已删 | `grep -n "aria-live" src/app/login` → 仅 `:96` 一行注释 | ✅ |
| `ref.focus()` 真会移动焦点 | `:23` `errorRef` · `:28-30` `useEffect(() => { if (error) errorRef.current?.focus() }, [error])` · `:99-100` `ref` + `tabIndex={-1}` | ✅ `<p tabIndex={-1}>` 是可编程聚焦但不进 Tab 序列的标准做法；焦点环仍为灯色（`:102`） |
| 切模式/新提交清 notice | `:42` 与 `:122-123` | ✅ |

### 2.3 [D-41] 44px 触控目标 + 负边距 —— 通过

`delete-category-button.tsx:50`：`minHeight:44, minWidth:44, margin:"-6px -14px"`。算术核实（不靠肉眼）：

- `.chip` 上下 padding `py-1` = 4px/侧（`globals.css:242`）；`CategoryGroup` 的 chip 是 `flex items-center gap-2`（`settings-client.tsx:73`）。
- 44px 按钮 + `-6px` 上下外边距 → **在流内只占 32px**，与改造前 `minHeight:32` 完全相同 → **chip 的渲染高度一字不变**。
- 按钮 44px 的边框盒居中在这个 32px 槽里 → 上下各外溢 6px，落进 chip 的 4px padding 内，**仍在 chip 边框盒之内**，不与相邻元素碰撞（chip 间 `gap-2` = 8px）。

> ⚠️ P3 观察（不阻塞）：负边距把 chip 内的命中区从 32px 扩到 44px，按 `×` 时会连带触发外层 `.chip:active { background-color: … }`（`globals.css:257-259`），按压时 chip 底色会比 44px 之前闪得更大一块。视觉极轻微，不违反任何禁忌；如需彻底消除可把外层 chip 的 `:active` 限定为 `:not(:has(button:hover))`。
>
> 诚实边界：以上为 CSS 盒模型算术，**未截图比对**（登录态页面无法无头访问）。

---

## 3. [D-24]c 竞态结论：**竞态不存在**（实测证明，非推断）

**结论：把 `rowsRef.current = rows` 放进 `useEffect` 不会导致「用户改完立刻点提交读到旧 rows」。**

我把 React 19.3.0 / react-dom 19.3.0 的 CJS 打成单文件 bundle，在真实 Chrome 里跑**与 `import-client.tsx:171-174, 220-228` 结构完全一致**的组件（`useRef` + `useEffect([rows])` 同步 + 提交时读 ref），并用 CDP 派发**真实 DOM 事件**：

- 真实 `ArrowDown` 键改 `<select>`（触发 `change` → `setRows`）；
- **零等待**，紧接着真实鼠标点击提交按钮；
- 在 effect 内与 submit handler 内各打一条日志。

```json
{
  "domSelectValue": "Z",
  "logAfterChange": "[\"effect rowsId1=A\",\"effect rowsId1=Z\"]",
  "log":            "[\"effect rowsId1=A\",\"effect rowsId1=Z\",\"submit read rowsId1=Z\"]",
  "submittedText":  "submitted=Z,B",

  "round2_domSelectValue": "A",
  "round2_log":            "[\"effect rowsId1=A\",\"submit read rowsId1=A\"]",
  "round2_submittedText":  "submitted=A,B"
}
```

**两轮都读到改后的值**（Z / A），没有一轮读到旧快照。

机制（`node_modules/react-dom/cjs/react-dom-client.development.js`）：

- `change` 属离散事件，`dispatchDiscreteEvent` 以 `DiscreteEventPriority` 派发（`:26099-26111`）；
- 提交后 passive effect 经 `scheduleCallback$1(NormalPriority, …)` 排成宏任务（`:19558-19562`）；
- 更硬的保证：**任何新的同步渲染开始前，React 都会先 `flushPendingEffects()`** —— `performSyncWorkOnRoot` 第一行即 `if (flushPendingEffects()) return null;`（`:20677`），`performWorkOnRootViaSchedulerTask` 同样（`:20653`）。

真实页面还多一层保险：提交按钮在 MUI Dialog 内，必须先点一次「确认导入 N 笔」把 Dialog 打开（那本身就是一次独立的离散事件），才可能点到 `type="submit" form="import-form"`。**从改分类到提交，中间隔着 ≥2 个事件派发周期。**

> 施工方报告里「effect 在 commit 后跑，用户点提交时必然已是最新值，语义无差」——这句判断**正确**，本次只是把它从推断升级为实测。

### 附：对 [D-24] 收益量级的诚实修正

施工方沿用审计的「500KB–1MB」估算。我用同形状的 2000 行数据实测：

```
payload bytes: 310,671 ≈ 303KB
旧：每次 change 全量 JSON.stringify(2000 行)   0.496 ms/次
新：每次 change O(1) 引用赋值                  0.000 ms/次
提交时一次性序列化                              0.478 ms（只发生 1 次）
→ 2000 行改 200 次，省约 99 ms 的纯序列化
```

即：**纯 JSON 序列化这一项本来就只有 0.5ms/次，远低于 50ms 阈值**。这次改造的真正价值不在 JS 侧（那 0.5ms），而在于**300KB 字符串不再常驻为 hidden input 的 DOM 属性**——省掉的是属性写入与其引发的样式/布局工作，那部分我无法无头量化。结论：改动是**严格改善且方向正确**（也更符合审计「重数据不要走 DOM 传递」的原则），但 [D-24] 的实际严重度**低于审计原文的暗示**。

---

## 4. 设计契约（DESIGN.md §十一 禁忌 10 条）

我独立 grep 复核（`src/app/settings` + `src/app/login` + `src/app/api/settings/route.ts`），**不采信施工方自查表**：

| # | 禁忌 | 命中数 | 判定 |
|---|---|---|---|
| 1 | 标准红/绿/蓝 | 0 | ✅ |
| 2 | 大面积灯色 `bg-lamp` | 0 | ✅ |
| 3 | 常亮灯线 > 1 | 1（`login/page.tsx:73`） | ✅ §四白名单授权 |
| 4 | 渐变按钮/进度条/大标题 | 1（`import-client.tsx:360`） | ✅ 非按钮/进度条；**且为既有代码**（见下） |
| 5 | `dark:` 变体 | 0 | ✅ |
| 6 | zinc/neutral/slate | 0 | ✅ |
| 7 | 非 mono 金额 | `¥` 2 处，**全在注释**（`import-client.tsx:90`、`settings-client.tsx:97`） | ✅ 渲染金额全走 `formatSignedMoney` + `.money` |
| 8 | 单次动效 > 500ms | 0 | ✅ 本次未新增动效；`content-visibility` 非动效 |
| 9 | 焦点环移除/换色 | `outline-none` 0 处；新增两处焦点（`import-client.tsx:329`、`login/page.tsx:102`）均为 `ring-lamp/60` | ✅ |
| 10 | 编号装饰/emoji/拟物阴影 | 0 | ✅ |

### 4.1 [D-42] 只读规则换静态类 —— 通过，无 hover 暗示

`settings-client.tsx:301-306` 改为 `rounded-full border border-fogline bg-veil px-3 py-1 text-sm text-dim`。

- `.chip` 的 `:hover{color:ink}`（`globals.css:253-255`）与 `:active{background}`（`:257-259`）**均不再命中** → 假 affordance 消除 ✅
- 与审计给的「`border border-fogline rounded-full px-3 py-1 text-sm text-dim`」方案一致 ✅
- 审计的备选方案（新增 `.tag`）需动 `globals.css`（WP-1 所有权），施工方选静态类是**合规的等效路径**，不是偷懒。

> ⚠️ P3 欠账：静态类把 chip 的几何写死成内联工具类。将来 `.chip` 若改圆角/内距，只读标签会静默漂移。建议与 `.num`（见 §7）一起由 WP-1 落成 `.tag`，两边合并。
>
> 注：`CategoryGroup` 的 chip（`settings-client.tsx:73`）**保留 `.chip` 是正确的** —— 它内含真实的删除按钮，不是只读数据。

### 4.2 渐变横滑遮罩 —— 待办（不阻塞）

`import-client.tsx:360` 的 `bg-gradient-to-l from-night to-transparent`：

- **不是本次引入**：`git show HEAD:src/app/settings/import-client.tsx` 第 298 行已有同一行；`git diff` 中不含 `gradient`。
- 不违反 §十一 #4（该条只禁「渐变按钮、渐变进度条、发光大标题」），但 §八「已批准的例外（**仅以下两处**，其余一律按契约执行）」清单里确实没有它 → **契约与实现不一致**。

**待办（交 WP-1）**：在 `DESIGN.md` §八 例外清单补第 3 条，登记「设置页导入预览表格右侧 `w-8` 横向滚动提示渐变（`md:hidden` 遮罩，`aria-hidden` 装饰层）」，并在变更记录写明理由。施工方的这条建议成立。

---

## 5. 安全

### 5.1 `api/settings/route.ts` 鉴权与错误语义 —— 通过

| 检查项 | 位置 | 结论 |
|---|---|---|
| 鉴权前置 | `:20-21` `requireApiSession(request)` → `isApiSession(auth)` 守卫，401/503 分流 | ✅ |
| 运行时/缓存 | `:4-5` `force-dynamic` + `runtime = "nodejs"` | ✅ 会话态数据不缓存 |
| 数据隔离 | `:26-31` 六条查询全部走 `auth.supabase`（RLS 作用域客户端，`session.ts:13-30`），**无任何用户可控参数**（GET 无 query 读取） | ✅ 无注入面 |
| 错误语义 | `:34-38` 任一查询失败 → 502 + 通用文案，服务端 `console.error` 记录真实错误 | ✅ 不泄露内部信息；「上游故障 ≠ 登出」的语义与 `session.ts:37-43` 契约一致 |
| Cookie 刷新 | `:40` `sessionResponse(auth, …)` 回写刷新后的 cookie | ✅ |
| [D-34] | `:9-13` `Intl.DateTimeFormat` 提到模块作用域 | ✅ 每请求少一次 locale/options 解析 |

### 5.2 文件类型 / 大小校验不可绕过 —— 通过

- `accept=".xlsx,.xls,.csv"`（`import-client.tsx:281`）只是文件选择器提示，**不构成校验**，但真正的闸门在 `parseBillFile`：
  - `MAX_BILL_FILE_BYTES = 20 * 1024 * 1024`（`import-parse.ts:220`）；
  - 编码后字节数检查（`:222-223`）**与**读入前 `file.size` 检查（`:255-256`，注释明确「[D-03] 在字节读进内存前就拒 oversized」）双重把关；
  - 三个来源各自要求表头关键字（`findHeaderRow`），无法识别的文件直接 throw。
- 改名成 `.txt` 绕过 picker 提示无意义：内容仍要过表头识别。**通过。**

### 5.3 `formData.set` 注入的 rows 仍走等价服务端校验（本包最需盯的安全点）—— 通过

`import-actions.ts` 的校验链**一字未动**，且与旧 hidden input 路径完全相同：

| 环节 | 位置 | 内容 |
|---|---|---|
| 结构解析 | `:31-53` | `JSON.parse` + 逐字段强制转换；非数组 → `null` |
| 来源白名单 | `:77` | `SOURCES.has(source)` |
| 体量上限 | `:81` | `rows.length > 2000` 拒绝 |
| 逐行校验 | `:55-67` | `DATE_RE` 正则 · `amount` 有限且 `> 0` · `externalId` 非空 · `type` 在白名单 · 转账必须有 `toAccountId` 且 ≠ `accountId` |
| **归属校验** | `:96-105` | 所有 `accountId`（含每笔转账的转入方）逐一 `eq("user_id", userId)` 查询，不属于本人即拒 |
| **归属校验** | `:114-124` | 所有 `categoryId` 同样校验 |
| 通道白名单 | `:148` | `CHANNELS.has(r.channel)`，否则回落来源默认通道 |

**关键论证（安全性的核心）**：服务端 action 的 `FormData` **本来就完全由客户端可控**。恶意用户无论我们的表单是 `<input name="rows" value={json}>` 还是 `formData.set("rows", …)`，都能自行构造任意 payload 直发 action。因此这次改造**不新增任何攻击面** —— 它改变的只是诚实客户端的**传输方式**（从 DOM 属性改为提交时注入），服务端信任边界与校验完全未动。

---

## 6. 测试与验证（亲跑）

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | **exit 0**，无输出（全库） |
| `npx eslint src/app/settings src/app/login src/app/api/settings/route.ts` | **exit 0**，0 error 0 warning |
| `npm test` | **98 pass / 0 fail**（23 suites，6.4s） |
| `npm run build`（带 `.hermes/.build-lock`） | **成功**；`/settings` `/login` `/ledger` `/data` `/` 五页仍全为 `○`（静态预渲染未回退）；锁已 `rmdir` 释放 |
| `node scripts/check-taboo-guard.mjs` | 12/12 通过 |
| `node .hermes/audits/format-check.mjs` | 13/13 通过 |
| `node .hermes/audits/contrast-check.mjs` | 11/11 通过 |
| 静态安全扫描（added lines：secret / eval / innerHTML / shell） | **0 命中** |

**全库 `npm run lint` 的既有噪声（非本包）**：`159 errors / 1 warning` **全部来自单一文件** `.hermes/tmp-review/wp2-retry-probe.mjs`（`mistledger/no-taboo-classnames` ×159 + `react-hooks/rules-of-hooks` ×3），是别的审核员留下的临时探针文件，不在 `src/` 内。**本包 0 错误**。建议该探针的归属方清理（`.hermes/tmp-review/` 未被 `.gitignore` 覆盖，有被误提交的风险）。

---

## 7. 欠账与待办（不阻塞本次提交）

| # | 项 | 级别 | 归属 | 证据 |
|---|---|---|---|---|
| T-1 | **[D-16] settings 侧 4 处仍未接入 `ConfirmSubmitButton`** | P2 | WP-5 后续 | 判定见 §8 |
| T-2 | **`.num` 类未落地**，`settings-client.tsx:280-282` 与 `import-client.tsx` 若干处用 `.money`（契约定义为「一切金额」）渲染**笔数** | P3 | WP-1（globals.css）+ WP-3（data-client） | `DESIGN.md:248` |
| T-3 | **只读规则静态类未收敛为 `.tag`** | P3 | WP-1 | §4.1 |
| T-4 | **`bg-gradient-to-l` 遮罩未在 §八 例外清单登记** | P3 | WP-1（DESIGN.md） | §4.2 |
| T-5 | **`justAdjusted` 成功文案永不复位**，收起再展开仍显示上一轮提示 | P3 | WP-5（随手可修） | `adjust-balance-button.tsx:52` |
| T-6 | **【新发现，审计盲区】4 处表单把成功与失败塞进同一条 `aria-live="polite"`**：`create-account-form.tsx:66`、`create-budget-form.tsx:66`、`create-category-form.tsx:40`、`toggle-account-button.tsx:28` | P3 | 建议开新缺陷 ID，WP-5 后续 | 这正是 [D-48] 为 `ensure-default-categories-button` 修掉的同一个反模式（失败不打断朗读）。**为既有代码，本次 diff 对这 4 个文件为空**，无回归；也不在任何一条已分配问题单的验收标准内，故不阻塞。建议新开 `[D-xx]`，改法照抄 `ensure-default-categories-button.tsx:37-47` 的 `ok ? role="status" : role="alert"` 二选一渲染。 |

---

## 8. [D-16] 是否阻塞 —— 判定：**不阻塞**，但施工方的两条理由均不成立

**判定理由：**

1. **范围上**：本次 diff 未引入任何 [D-16] 相关改动，未接线是范围决策而非回归；派工上下文已明确「settings 侧接线属另一条待办」。四条确认流程当前行为自洽（Esc 关闭 / 点遮罩关闭 / 确认后提交 / pending 禁用均由 MUI `Dialog` 的 `onClose` + `disabled` 提供）。
2. **组件现已在盘**（`src/components/confirm-submit-button.tsx`，WP-4 产出），`grep -rn "ConfirmSubmitButton" src/` 显示 ledger 侧 2 处已收敛，settings 侧 4 处待办 —— 是**明确的、可执行的欠账**，不是未知风险。

**但施工方给出的两条「不能收敛」的理由，逐条核对后都不成立**，必须纠正，否则后续待办会被建在错误前提上：

| 施工方理由 | 核对结果 |
|---|---|
| ①「`ConfirmSubmitButton` 若统一了内部布局/sx，chip 内的 `×` 会走形 —— 建议组件暴露 `sx` 或 `size` 透传」 | **不成立**。组件**已经暴露了**：`triggerProps?: Omit<ButtonProps, "children" \| "onClick" \| "type">`（`confirm-submit-button.tsx:98`）本身就含 `sx`，且展开在默认 `sx={{ alignSelf: "flex-start" }}` **之后**（`:158-159`）—— 调用方的 `minHeight:44 / margin:"-6px -14px"` 会完全覆盖默认值。`label` 类型是 `ReactNode`（`:69`），`×` 字形直接传即可。无需组件侧任何改动。 |
| ②「`adjust-balance-button` 是『提交前拦截』形态，与另三处『点按钮直接弹框』不同，收敛时这个差异要保留，否则会退回『填完表单点提交才发现要确认』」 | **实质不成立**。组件**同时实现了两种形态**：触发按钮是 `type="button"` + `onClick={requestConfirm}`（`:154-157`，即「点按钮直接弹框」），而 `<form>` 的 `onSubmit` 会拦下**所有其它提交**（含回车隐式提交、`submitter` 为 null）先弹确认（`:145-150`，即「提交前拦截」）。而且它专门为 adjust-balance 这类「无原生约束」的场景留了 `validate?: () => boolean`（`:91`，注释原文举的例子就是「调整余额的目标余额是否可解析」），以及 `afterTrigger` 用来放行内的 `role="status"`/`role="alert"` 反馈（`:102`）。改造后行为与现状**完全一致**，不会退回。 |

**残留的真实风险（须记入待办 T-1）**：

- 4 处仍带 `armedRef` 命令式旗标。审计原文明确点名「`armedRef` 这种命令式旗标在 React 19 的并发渲染下是脆的」（`round1-pm-audit.md:196`）。组件的实现注释（`confirm-submit-button.tsx:11-15`）正是为此从旗标改为「从事件本身派生」（读 `submitter` 的 `data-confirm-submit` 标记）。
- [D-16] 的验收标准「6 处确认流程行为一致」在 settings 侧收敛前**不成立**。
- 「总行数净减少 ≥ 200 行」：settings 侧 4 个文件现共 409 行（158+83+82+86），ledger 侧 `delete-transaction-button.tsx` 已收敛到 46 行。**该数字本就需两侧合并后才成立**，不是 WP-5 单包的门槛，不应据此判本包不通过。

**T-1 的执行建议**：4 处改造后，`delete-account` / `delete-budget` / `delete-category` 三处可收敛到约 20 行；`adjust-balance` 用 `validate={() => targetValid}` + `afterTrigger` 放两条反馈；`delete-category` 的 chip 内 `×` 经 `triggerProps={{ sx: …, "aria-label": … }}` 透传。改完需复跑：`npx eslint src/app/settings && npx tsc --noEmit && npm test && npm run build`。

---

## 9. [D-48] 审计前提核实 —— **施工方反驳成立，审计前提有误**

审计原文（`round1-pm-audit.md:540`）称：

> 文件: `src/app/settings/ensure-default-categories-button.tsx:1`（**PascalCase 文件名**，同目录其余为 kebab-case）

**核实结果：磁盘上从来就是 kebab-case，审计前提错误。**

1. **当前磁盘**：`ls src/app/settings/` → `ensure-default-categories-button.tsx`，同目录 17 个文件**全为 kebab-case**。
2. **Git 首次入库**：`git log --diff-filter=A --name-only -- 'src/app/settings/*'` → 该文件在提交 `8c1da6f`（`fix(settings): 预算月份改用 date 控件并补齐删除确认`）中**以 kebab-case 名字新增**，此后再未重命名。
3. **审计自身自相矛盾**：同一条的「文件:」路径写的就是 kebab-case，却在括号里断言它是 PascalCase。
4. **审计给的「期望」反而更不一致**：它建议改名为 `ensure-default-categories.tsx`（去掉 `-button` 后缀）。而同目录的 `delete-category-button.tsx` / `delete-budget-button.tsx` / `delete-account-button.tsx` / `toggle-account-button.tsx` / `adjust-balance-button.tsx` **全部带 `-button` 后缀** —— 去掉后缀会让它成为目录里唯一的例外。

**判定**：施工方「未改名」的处理正确，[D-48] 的第 ① 条应标记为 **审计误报**。施工方已实际修复的第 ② 条（`result` → `outcome` 变量遮蔽，`ensure-default-categories-button.tsx:22`）与第 ③ 条（`ok` 走 `role="status"`、失败走 `role="alert"`、空 message 不渲染空 live region，`:37-47`）**均真实有效且达标**。建议在审计总档里给 [D-48]① 加一条勘误。

---

## 10. 诚实标注：本包仍未实测的部分

| 项 | 状态 | 原因 |
|---|---|---|
| 真实登录态 `/settings` 页面 375px 走查（截屏） | **未实测** | 需 Supabase 会话；[D-19] 已用等价复现页 + 真实按键补验（§2.1），真实页 DOM 属性已逐字核对 |
| 2000 行导入的主线程长任务 < 50ms（Performance 面板） | **未实测** | 同上。但已用 Node 量化出纯序列化成本仅 0.5ms/次（§3 附），并指出真正的收益在「300KB 字符串不再常驻 DOM 属性」——后者无法无头量化 |
| [D-41] chip 布局的视觉比对（截图） | **未实测** | 已按 CSS 盒模型算术证明 chip 渲染高度不变（§2.3） |
| `next dev` 冒烟 | **未跑** | `npm run build` 已通过（编译 + TS + 11 条路由产出），比 dev 冒烟更强；施工方报告的 dev panic 我未复现，也不影响本次判定 |
| 登录页 jade/ember 实际观感 | **未实测** | 需截图；配色令牌本身已由 `contrast-check` 11/11 覆盖 |
| 服务端 action 的端到端导入 | **未实测** | 需 Supabase 后端；校验链为**未改动**的既有代码（§5.3） |
| T-6 的 4 处 `aria-live` 反模式 | **已确认存在**，但为既有代码、不在本次 diff、本次分配问题单的验收标准内 → 不阻塞，建议新开缺陷 ID |
