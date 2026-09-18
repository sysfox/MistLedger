"use client";

import { accountTypeLabel } from "@/lib/ledger/constants";
import { formatMoney } from "@/lib/ledger/format";
import { SkeletonChip, SkeletonLine, SkeletonPanel } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { useApiData } from "@/lib/api/use-api-data";
import AdjustBalanceButton from "./adjust-balance-button";
import CreateAccountForm from "./create-account-form";
import DeleteAccountButton from "./delete-account-button";
import ToggleAccountButton from "./toggle-account-button";
import DeleteCategoryButton from "./delete-category-button";
import DeleteBudgetButton from "./delete-budget-button";
import CreateCategoryForm from "./create-category-form";
import CreateBudgetForm from "./create-budget-form";
import EnsureDefaultCategoriesButton from "./ensure-default-categories-button";
import ImportClient from "./import-client";

type Category = { id: string; name: string };

type SettingsPayload = {
  accounts: { id: string; name: string; type: string; initial_balance: number | string; is_active: boolean }[];
  balances: { account_id: string; balance: number | string }[];
  categories: { id: string; name: string; kind: string }[];
  budgets: {
    id: string;
    limit_amount: number | string;
    category: { name: string }[] | { name: string } | null;
  }[];
  batches: {
    id: string;
    filename: string;
    source: string;
    row_count: number;
    success_count: number;
    duplicate_count: number;
  }[];
  rules: { keyword: string; category: { name: string }[] | { name: string } | null }[];
};

const SOURCE_LABEL: Record<string, string> = {
  alipay_import: "支付宝",
  wechat_import: "微信支付",
  bank_import: "银行明细",
};

function CategoryGroup({ title, items }: { title: string; items: Category[] }) {
  return (
    <section className="panel flex flex-col gap-3 p-5">
      <p className="eyebrow">分类</p>
      <h2 className="font-display text-[17px] font-semibold text-ink">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((c) => (
          <li key={c.id} className="chip flex items-center gap-2 text-ink">
            {c.name}
            <DeleteCategoryButton id={c.id} name={c.name} />
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm text-dim">还没有分类，在下面新建第一个吧</li> : null}
      </ul>
    </section>
  );
}

function AccountsSection({ payload }: { payload: SettingsPayload }) {
  const accounts = payload.accounts;
  const balanceRows = payload.balances;
  const balances = new Map<string, number>();
  for (const b of balanceRows) balances.set(b.account_id, Number(b.balance));
  const total = [...balances.values()].reduce((s, v) => s + v, 0);

  return (
    <section id="accounts" className="flex flex-col gap-3 scroll-mt-20">
      <div>
        <p className="eyebrow">账房</p>
        <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">账户</h2>
        <p className="mt-1 text-sm text-dim">
          总资产 <span className="money">¥{formatMoney(total)}</span>
          <span className="text-xs">（含停用账户）</span> · 余额 = 期初 + 流水汇总（含转账），每笔钱从哪个账户出在这里对得上
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {accounts.map((a) => (
          <li key={a.id} className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">
                {a.name}
                {!a.is_active ? <span className="ml-2 text-xs text-dim">已停用</span> : null}
              </p>
              <p className="text-xs text-dim">
                {accountTypeLabel(a.type)} · 期初 <span className="money">¥{formatMoney(Number(a.initial_balance))}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="money font-semibold text-ink">¥{formatMoney(balances.get(a.id) ?? 0)}</span>
              <ToggleAccountButton id={a.id} isActive={a.is_active} />
              <DeleteAccountButton id={a.id} />
            </div>
            {!a.is_active ? null : (
              <AdjustBalanceButton
                id={a.id}
                accountName={a.name}
                currentBalance={balances.get(a.id) ?? 0}
                initialBalance={Number(a.initial_balance)}
              />
            )}
          </li>
        ))}
        {accounts.length === 0 ? (
          <li className="rounded-xl border border-dashed border-fogline px-4 py-6 text-center text-sm text-dim">
            还没有账户，先在下面建一个（例如：银行卡 / 零钱通）
          </li>
        ) : null}
      </ul>

      <CreateAccountForm />
    </section>
  );
}

function AccountsFallback() {
  return (
    <div role="status" aria-busy="true">
      <section className="flex flex-col gap-3">
        <div>
          <SkeletonLine className="h-3 w-12" />
          <SkeletonLine className="mt-2 h-4 w-20" />
          <SkeletonLine className="mt-2 h-3.5 w-64" />
        </div>
        <SkeletonPanel>
          <div className="flex flex-col gap-2">
            <SkeletonLine className="h-3.5 w-2/5" />
            <SkeletonLine className="h-3 w-3/5" />
            <SkeletonLine className="h-3.5 w-24" />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <SkeletonLine className="h-3.5 w-1/3" />
            <SkeletonLine className="h-3 w-2/3" />
            <SkeletonLine className="h-3.5 w-24" />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <SkeletonLine className="h-3.5 w-2/5" />
            <SkeletonLine className="h-3 w-1/2" />
            <SkeletonLine className="h-3.5 w-24" />
          </div>
        </SkeletonPanel>
        <SkeletonPanel>
          <SkeletonLine className="h-11 w-full" />
        </SkeletonPanel>
      </section>
    </div>
  );
}

function CategorySections({ payload }: { payload: SettingsPayload }) {
  const categories = payload.categories;
  const expense = categories.filter((c) => c.kind === "expense");
  const income = categories.filter((c) => c.kind === "income");
  return (
    <>
      <CategoryGroup title="支出分类" items={expense} />
      <CategoryGroup title="收入分类" items={income} />
    </>
  );
}

function CategoryFallback() {
  return (
    <div role="status" aria-busy="true">
      <SkeletonPanel>
        <div className="flex flex-wrap gap-2">
          <SkeletonChip />
          <SkeletonChip />
          <SkeletonChip />
          <SkeletonChip />
        </div>
      </SkeletonPanel>
      <SkeletonPanel>
        <div className="flex flex-wrap gap-2">
          <SkeletonChip />
          <SkeletonChip />
          <SkeletonChip />
        </div>
      </SkeletonPanel>
    </div>
  );
}

function BudgetSection({ payload, month }: { payload: SettingsPayload; month: string }) {
  const categories = payload.categories;
  const budgets = payload.budgets;
  const expense = categories.filter((c) => c.kind === "expense");
  return (
    <>
      <ul className="flex flex-col gap-2 text-sm">
        {budgets.map((b) => {
          const cat = Array.isArray(b.category)
            ? b.category[0]?.name
            : (b.category as unknown as { name: string } | null)?.name;
          return (
            <li key={b.id} className="panel flex items-center justify-between px-4 py-2">
              <span className="text-ink">
                {cat ?? "未知分类"}
                <span className="money ml-2 text-dim">¥{formatMoney(Number(b.limit_amount))}</span>
              </span>
              <DeleteBudgetButton id={b.id} label={cat ?? "未知分类"} />
            </li>
          );
        })}
        {budgets.length === 0 ? (
          <li className="text-sm text-dim">本月还没设预算，在下面给支出分类加一条上限试试</li>
        ) : null}
      </ul>
      <CreateBudgetForm categories={expense} defaultMonth={month} />
    </>
  );
}

function BudgetFallback() {
  return (
    <div role="status" aria-busy="true">
      <SkeletonPanel>
        <div className="flex flex-col gap-2">
          <SkeletonLine className="h-3.5 w-32" />
          <SkeletonLine className="h-3.5 w-28" />
        </div>
        <div className="mt-3">
          <SkeletonLine className="h-11 w-full" />
        </div>
      </SkeletonPanel>
    </div>
  );
}

function ImportSection({ payload }: { payload: SettingsPayload }) {
  const accounts = payload.accounts;
  const categories = payload.categories;
  const batches = payload.batches;
  const rules = payload.rules;
  const activeAccounts = accounts
    .filter((a) => a.is_active)
    .map((a) => ({ id: a.id, name: a.name }));

  return (
    <>
      <ImportClient accounts={activeAccounts} categories={categories} />

      <div className="panel p-5">
        <p className="eyebrow">导入</p>
        <h3 className="mt-1 font-display text-[17px] font-semibold text-ink">最近导入</h3>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {batches.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-veil"
            >
              <span className="min-w-0 flex-1 truncate text-ink">
                {b.filename}
                <span className="ml-2 text-xs text-dim">{SOURCE_LABEL[b.source] ?? b.source}</span>
              </span>
              <span className="shrink-0 text-xs text-dim">
                共 {b.row_count} 笔 · 新增 {b.success_count} 笔 · 去重 {b.duplicate_count} 笔
              </span>
            </li>
          ))}
          {batches.length === 0 ? (
            <li className="text-sm text-dim">还没有导入过账单，在上面选一个账单导第一批吧</li>
          ) : null}
        </ul>
      </div>

      <div className="panel p-5">
        <p className="eyebrow">规则</p>
        <h3 className="mt-1 font-display text-[17px] font-semibold text-ink">归类规则（关键词 → 分类）</h3>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {rules.map((r) => {
            const cat = Array.isArray(r.category) ? r.category[0]?.name : (r.category as unknown as { name: string } | null)?.name;
            return (
              <li key={`${r.keyword}-${cat ?? "?"}`} className="chip">
                {r.keyword} → {cat ?? "?"}
              </li>
            );
          })}
          {rules.length === 0 ? (
            <li className="text-sm text-dim">
              暂无规则。先导入一次；若某类商户在记账页总没归对，在上面加一条分类即可。
            </li>
          ) : null}
        </ul>
      </div>
    </>
  );
}

function ImportFallback() {
  return (
    <div role="status" aria-busy="true">
      <section className="flex flex-col gap-4">
        <SkeletonPanel>
          <SkeletonLine className="h-11 w-full" />
        </SkeletonPanel>
        <SkeletonPanel>
          <div className="flex flex-col gap-3">
            <SkeletonLine className="h-3.5 w-2/3" />
            <SkeletonLine className="h-3.5 w-1/2" />
            <SkeletonLine className="h-3.5 w-3/5" />
          </div>
        </SkeletonPanel>
        <SkeletonPanel>
          <div className="flex flex-wrap gap-2">
            <SkeletonChip />
            <SkeletonChip />
            <SkeletonChip />
            <SkeletonChip />
          </div>
        </SkeletonPanel>
      </section>
    </div>
  );
}

export default function SettingsClient() {
  const { data, error, loading } = useApiData<SettingsPayload>("/api/settings");

  const currentMonth = `${new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).format(new Date())}-01`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <p className="eyebrow">账房规则</p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink">设置</h1>
        <p className="mt-1 text-sm text-dim">
          账户与余额、分类、预算上限、账单导入，都在这一页管
        </p>
      </div>

      {loading ? (
        <>
          <AccountsFallback />
          <CategoryFallback />
        </>
      ) : error || !data ? (
        <>
          <SectionError />
          <SectionError />
        </>
      ) : (
        <>
          <AccountsSection payload={data} />
          <CategorySections payload={data} />
        </>
      )}

      <div className="panel flex flex-col gap-3 p-5">
        <p className="eyebrow">新建</p>
        <h2 className="font-display text-[17px] font-semibold text-ink">新建分类</h2>
        <CreateCategoryForm />
        <EnsureDefaultCategoriesButton />
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <p className="eyebrow">预算</p>
          <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">本月预算</h2>
          <p className="mt-1 text-sm text-dim">设个上限，总览页会显示进度和超支提醒</p>
        </div>
        {loading ? (
          <BudgetFallback />
        ) : error || !data ? (
          <SectionError />
        ) : (
          <BudgetSection payload={data} month={currentMonth} />
        )}
      </section>

      <section id="import" className="flex flex-col gap-4 scroll-mt-20">
        <div>
          <p className="eyebrow">导入</p>
          <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">导入账单</h2>
          <p className="mt-1 text-sm text-dim">
            支持支付宝 / 微信账单（xlsx/csv，含 GBK）与建行活期明细（xls）。同一文件重复导入会自动去重；
            银行卡出资的支付宝·微信行会被跳过，请走银行明细导入，避免重复记账。
          </p>
        </div>

        {loading ? (
          <ImportFallback />
        ) : error || !data ? (
          <SectionError />
        ) : (
          <ImportSection payload={data} />
        )}
      </section>
    </main>
  );
}
