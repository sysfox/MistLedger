# 雾夜账 MistLedger

中文个人记账应用。深夜账房，掌灯看账——看清每笔钱从哪出、还剩多少。

## 功能

- **总览**：本月收支概览与图表（趋势、分类构成）。
- **账本**：记录支出 / 收入 / 转账，按分类与预算管理。
- **账户**：管理钱包与银行卡账户（微信零钱、零钱通、支付宝余额等），支持停用与删除。
- **导入**：解析并导入支付宝明细（CSV GBK / XLSX）、微信支付账单（XLSX）、银行账单（CSV/XLS），自动识别表头、去重、收入/支出/转账归类。
- **查数**：按条件查询历史交易。
- **设置**：分类、预算管理，一键补齐默认分类。
- **登录**：Supabase Auth 邮箱登录。

## 技术栈

- Next.js（App Router）+ React 19 + TypeScript
- Tailwind CSS v4（`@theme` token 设计系统，全站常夜「雾夜」主题）
- Supabase（数据库 + Auth，仅使用 publishable key）
- Recharts 图表，SheetJS（xlsx）账单解析
- PWA（manifest + Service Worker，可安装）

## 本地开发

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

其他脚本：

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # 生产构建
```

## 环境变量

复制 `.env.example` 为 `.env.local`，填入：

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

## 设计系统

界面遵循 [DESIGN.md](DESIGN.md)——这是唯一设计契约，涵盖雾夜主题令牌（night / ink / lamp / ember / jade 等）、灯线签名、动效与禁忌清单。任何界面改动须遵循并同步更新该文件。

## 作者
Teror Fox 2026