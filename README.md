# 雾夜账 MistLedger

中文个人记账应用。深夜账房，掌灯看账——看清每笔钱从哪出、还剩多少。

## 功能

五页，一个信息架构：账户与账单导入都收在设置页里，没有独立的「账户」页或「导入」页。

- **总览**（`/`）：本月收支概览与图表（近 6 个月趋势、分类构成、资产曲线、账户余额、预算进度）。
- **记账**（`/ledger`）：记录支出 / 收入 / 转账，按账户与分类归类，可修改、可删除（均需二次确认）。
- **数据**（`/data`）：按条件查询历史交易——时间范围、收支类型、分类、账户、金额区间、关键词；结果列表最多 200 笔，配月度趋势与资产曲线。
- **设置**（`/settings`）：管理账户（银行卡 / 支付宝余额 / 微信零钱 / 零钱通等，支持停用、删除与调整余额）、分类、预算；导入账单——解析支付宝明细（CSV GBK / XLSX）、微信支付账单（XLSX）、银行账单（CSV / XLS），自动识别表头、去重并归类；一键补齐默认分类。
- **登录**（`/login`）：Supabase Auth 邮箱登录 / 注册。

## 技术栈

- Next.js（App Router）+ React 19 + TypeScript
- Tailwind CSS v4（`@theme` token 设计系统，全站常夜「雾夜」主题）
- Supabase（数据库 + Auth，仅使用 publishable key）
- Recharts 图表，SheetJS（xlsx `0.20.3`，从官方 CDN 安装；npm 上的 `xlsx` 停留在有已知原型污染 / ReDoS 公告的 0.18.5）账单解析
- PWA（manifest + Service Worker，可安装；新版本发布后由页面底部提示刷新，不会在使用中途强行切换）

## 本地开发

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

其他脚本：

```bash
npm run lint              # ESLint（含 DESIGN.md §十一 禁忌清单的机器守卫）
npm run typecheck         # tsc --noEmit
npm test                  # 纯逻辑单元测试（Node 内置 runner，无额外测试框架依赖）
npm run test:taboo-guard  # 自测禁忌守卫：确认每条 lint 规则真的会触发
npm run test:api-cache    # 客户端数据缓存的可执行验收（登出清空 / 竞态 / LRU+TTL）
npm run build             # 生产构建
```

`npm test` 走 Node 内置的 `--experimental-strip-types`，需要 Node 22.18+（Node 23+ 默认可用）。

## 环境变量

复制 `.env.example` 为 `.env.local`，填入：

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

## 设计系统

界面遵循 [DESIGN.md](DESIGN.md)——这是唯一设计契约，涵盖雾夜主题令牌（night / ink / lamp / ember / jade 等）、灯线签名、动效与禁忌清单。任何界面改动须遵循并同步更新该文件。

代码结构与架构约定见 [STRUCTURE.md](STRUCTURE.md)。

### 加载骨架

五个页面各自带结构骨架屏（灰块 + 呼吸脉动，无可见文案），页面禁用 JS 时也能看到完整版式。

**没有根级 `src/app/loading.tsx`。** 它在 App Router 里包裹整个页面树，会**盖住**
每条路由自己的骨架：实测 `/data` 与 `/settings` 的预渲染 HTML 里显示的是总览页的
骨架（写着「各账户余额 / 本月预算进度」，而这两页没有这两个区块）。四页形状各异，
一份根级骨架必然是其中一页的复制品，而复制品在其余三页上就是错的。详见
[DESIGN.md §七.2](DESIGN.md)。

## 作者
Teror Fox 2026