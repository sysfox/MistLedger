/**
 * Test coverage for the pure modules that carry real logic.
 *
 * Runner: Node's built-in `node:test` (see `npm test`). No extra dependency —
 * the point of was to make the suite runnable in CI, and a 100 MB test
 * framework to assert two pure functions would defeat it.
 *
 * Type stripping is enabled explicitly so this runs on Node 22.18+ as well as
 * 23+, where it is the default.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accountBalances,
  assetCurve,
  categoryShare,
  filterTxs,
  lastMonths,
  monthKey,
  monthlyTrend,
  summarizeTxs,
  type TxLike,
} from "./stats.js";

function tx(patch: Partial<TxLike> = {}): TxLike {
  return {
    date: "2026-01-15",
    amount: 100,
    type: "expense",
    account_id: "a1",
    to_account_id: null,
    category_id: "c1",
    note: "",
    counterparty: "",
    ...patch,
  };
}

describe("monthKey / lastMonths", () => {
  it("pads the month to two digits", () => {
    assert.equal(monthKey(new Date(2026, 0, 1)), "2026-01");
    assert.equal(monthKey(new Date(2026, 8, 9)), "2026-09");
  });

  it("returns n consecutive months ending at base, oldest first", () => {
    assert.deepEqual(lastMonths(3, new Date(2026, 8, 15)), ["2026-07", "2026-08", "2026-09"]);
  });

  it("crosses a year boundary backwards correctly", () => {
    assert.deepEqual(lastMonths(2, new Date(2026, 0, 15)), ["2025-12", "2026-01"]);
  });
});

describe("accountBalances", () => {
  const accounts = [
    { id: "a1", initial_balance: 1000 },
    { id: "a2", initial_balance: 500 },
  ];

  it("applies initial balances and expenses/income", () => {
    const map = accountBalances(accounts, [
      tx({ account_id: "a1", type: "expense", amount: 250 }),
      tx({ account_id: "a1", type: "income", amount: 100 }),
    ]);
    assert.equal(map.get("a1"), 850);
    assert.equal(map.get("a2"), 500);
  });

  it("moves money on transfer: source down, destination up", () => {
    const map = accountBalances(accounts, [
      tx({ type: "transfer", account_id: "a1", to_account_id: "a2", amount: 300 }),
    ]);
    assert.equal(map.get("a1"), 700);
    assert.equal(map.get("a2"), 800);
  });

  it("net-zero on self-transfer", () => {
    const map = accountBalances(accounts, [
      tx({ type: "transfer", account_id: "a1", to_account_id: "a1", amount: 300 }),
    ]);
    assert.equal(map.get("a1"), 1000);
  });

  it("ignores a transfer that has no destination at all", () => {
    // The whole transfer branch is gated on `to_account_id`, so a half-formed
    // transfer row leaves both sides untouched rather than debiting the source
    // into the void. This is the `map.get(...)!` non-null-assertion guard.
    const map = accountBalances(accounts, [
      tx({ type: "transfer", account_id: "a1", to_account_id: null, amount: 300 }),
    ]);
    assert.equal(map.get("a1"), 1000);
    assert.equal(map.get("a2"), 500);
    assert.equal(map.size, 2);
  });

  it("never creates an entry for an account outside the input list", () => {
    const map = accountBalances(accounts, [tx({ account_id: "ghost", amount: 999 })]);
    assert.equal(map.has("ghost"), false);
    assert.equal(map.size, 2);
  });

  it("rounds to 2 decimals (an expense lowers the balance)", () => {
    const map = accountBalances([{ id: "a1", initial_balance: 0 }], [
      tx({ amount: 10.005 }),
    ]);
    assert.equal(map.get("a1"), -10.01);
  });

  it("accepts string amounts (PostgREST numeric columns)", () => {
    const map = accountBalances([{ id: "a1", initial_balance: "100" }], [
      tx({ amount: "12.34" }),
    ]);
    assert.equal(map.get("a1"), 87.66);
  });
});

describe("filterTxs", () => {
  const txs = [
    tx({ date: "2026-01-01", amount: 10, counterparty: "张三" }),
    tx({ date: "2026-02-01", amount: 500, type: "income" }),
    tx({ date: "2026-03-01", amount: 90, category_id: null, note: "咖啡" }),
    tx({ date: "2026-03-15", amount: 70, type: "transfer", to_account_id: "a2" }),
  ];

  it("filters by inclusive date range", () => {
    assert.equal(filterTxs(txs, { from: "2026-02-01", to: "2026-03-01" }).length, 2);
  });

  it("filters by type and treats 'all' as no filter", () => {
    assert.equal(filterTxs(txs, { type: "income" }).length, 1);
    assert.equal(filterTxs(txs, { type: "all" }).length, 4);
  });

  it("category 'none' keeps only unclassified rows", () => {
    const out = filterTxs(txs, { category: "none" });
    assert.equal(out.length, 1);
    assert.equal(out[0].date, "2026-03-01");
  });

  it("account matches either side of a transfer", () => {
    assert.equal(filterTxs(txs, { account: "a2" }).length, 1);
  });

  it("min/max are inclusive amount bounds", () => {
    assert.equal(filterTxs(txs, { min: 70, max: 90 }).length, 2);
  });

  it("q searches counterparty and note, case-insensitively", () => {
    assert.equal(filterTxs(txs, { q: "咖啡" }).length, 1);
    assert.equal(filterTxs(txs, { q: "  zhang " }).length, 0);
  });

  it("combines filters conjunctively", () => {
    assert.equal(filterTxs(txs, { from: "2026-03-01", type: "transfer" }).length, 1);
  });
});

describe("summarizeTxs", () => {
  it("splits totals by type and counts every row", () => {
    const s = summarizeTxs([
      tx({ amount: 10, type: "expense" }),
      tx({ amount: 20, type: "expense" }),
      tx({ amount: 30, type: "income" }),
      tx({ amount: 40, type: "transfer" }),
    ]);
    assert.deepEqual(s, { count: 4, expense: 30, income: 30, transfer: 40 });
  });

  it("returns zeros for an empty list", () => {
    assert.deepEqual(summarizeTxs([]), { count: 0, expense: 0, income: 0, transfer: 0 });
  });
});

describe("monthlyTrend", () => {
  it("buckets by month and keeps the requested order", () => {
    const out = monthlyTrend(
      [
        tx({ date: "2026-01-10", amount: 100 }),
        tx({ date: "2026-02-10", amount: 200, type: "income" }),
        tx({ date: "2026-01-20", amount: 50 }),
      ],
      ["2026-01", "2026-02", "2026-03"],
    );
    assert.deepEqual(out, [
      { month: "01", expense: 150, income: 0 },
      { month: "02", expense: 0, income: 200 },
      { month: "03", expense: 0, income: 0 },
    ]);
  });

  it("drops transactions outside the requested months", () => {
    const out = monthlyTrend([tx({ date: "2025-12-31", amount: 999 })], ["2026-01"]);
    assert.deepEqual(out, [{ month: "01", expense: 0, income: 0 }]);
  });

  it("transfers never count as expense or income", () => {
    const out = monthlyTrend([tx({ type: "transfer", amount: 500 })], ["2026-01"]);
    assert.equal(out[0].expense, 0);
    assert.equal(out[0].income, 0);
  });
});

describe("categoryShare", () => {
  it("aggregates the month's expenses and sorts descending", () => {
    const out = categoryShare(
      [
        tx({ date: "2026-01-05", amount: 30, category_id: "c1" }),
        tx({ date: "2026-01-06", amount: 70, category_id: "c2" }),
        tx({ date: "2026-01-07", amount: 20, category_id: "c1" }),
        tx({ date: "2026-02-01", amount: 999, category_id: "c1" }),
        tx({ date: "2026-01-08", amount: 500, type: "transfer", category_id: "c1" }),
      ],
      "2026-01",
      (id) => (id === "c1" ? "餐饮" : "购物"),
    );
    assert.deepEqual(out, [
      { name: "购物", value: 70 },
      { name: "餐饮", value: 50 },
    ]);
    // Transfer rows are excluded regardless of category.
    assert.equal(out.some((r) => r.value === 500), false);
  });
});

describe("assetCurve", () => {
  it("returns days entries, oldest first, and nets transfers to zero", () => {
    const curve = assetCurve(
      1000,
      [
        tx({ date: "2026-01-01", amount: 100 }),
        tx({ date: "2026-01-03", amount: 200, type: "transfer", to_account_id: "a2" }),
      ],
      3,
      new Date(2026, 0, 3),
    );
    assert.equal(curve.length, 3);
    assert.equal(curve[curve.length - 1].total, 900);
  });

  it("pre-dates the window into the opening total", () => {
    const curve = assetCurve(
      1000,
      [tx({ date: "2025-12-01", amount: 50 })],
      2,
      new Date(2026, 0, 2),
    );
    assert.equal(curve[0].total, 950);
  });
});
