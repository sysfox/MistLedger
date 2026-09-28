/**
 * 三条契约的可执行验收。跑 `npm test`（Node 内置 `node:test`，无额外依赖）。
 *
 * 重点是「构建后第 2 天访问，chips 仍指向近 7 天」：同一个 `buildPresets` 被两个
 * 不同日期驱动，两次输出必须不同 —— 这要求「今天」必须是入参。
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";

import {
  buildQueryString,
  escapeLikePattern,
  escapeOrValue,
  hasAnyFilter,
  isUuid,
  normalizeAccount,
  normalizeCategory,
  parseQueryFilter,
  snapDays,
  type QueryFilter,
} from "./query-params.js";
import { toFilteredTxStats, toSnapshot } from "./payload.js";
import { monthEnd, prevMonthKey, shiftDays } from "../../lib/ledger/stats.js";

/*
 * `presets.ts` 用 `@/lib/ledger/stats`，但 Node 的 strip-types 既不解析 `@/` 别名
 * 也不做 `.js`→`.ts` 替换，`scripts/ts-resolve-hooks.mjs` 也只处理相对路径。
 * 故别名在本文件就地解决：注册解析钩子后必须用**动态** import 载入被测模块 ——
 * 静态 import 的解析发生在任何代码执行之前，钩子来不及注册。
 */
const SRC = new URL("../../../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, SRC).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { buildPresets } = (await import("./presets.js")) as typeof import("./presets.js");

const UUID_A = "3f9c1d2e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const UUID_B = "11111111-2222-4333-8444-555555555555";

/** 最小 ParamSource：测试只关心键值映射，不需要真的构造 URLSearchParams。 */
function params(record: Record<string, string>) {
  return { get: (name: string) => record[name] ?? null };
}

/**
 * 只保留有值的键。`parseQueryFilter` 总是返回完整的 8 个键（缺失的为 undefined），
 * 这对消费方是对的 —— 无需判断 `in` —— 但与稀疏字面量做 deepEqual 时会因
 * 「显式 undefined」而不等。往返一致性断言要比的是**有效值**。
 */
function defined(f: QueryFilter): Record<string, unknown> {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined));
}

describe("acc / cat 的 UUID 校验", () => {
  it("acc 只接受 UUID", () => {
    assert.equal(normalizeAccount(UUID_A), UUID_A);
    // 过滤注入的载荷：逗号能拆出额外的 or 分支
    assert.equal(normalizeAccount(`1,or(id.not.is.null)`), undefined);
    assert.equal(normalizeAccount("not-a-uuid"), undefined);
    assert.equal(normalizeAccount("'; drop table transactions; --"), undefined);
    // 大写合法（Postgres uuid 输出可能是大写）
    assert.equal(normalizeAccount(UUID_A.toUpperCase()), UUID_A.toUpperCase());
    assert.equal(normalizeAccount(""), undefined);
    assert.equal(normalizeAccount(null), undefined);
  });

  it("cat 接受 UUID 或 none，其余丢弃", () => {
    assert.equal(normalizeCategory(UUID_B), UUID_B);
    assert.equal(normalizeCategory("none"), "none");
    // "none" 绝不能被 UUID 分支吞掉，也不能掉进 else
    assert.equal(normalizeCategory("None"), undefined);
    assert.equal(normalizeCategory("nope"), undefined);
    assert.equal(normalizeCategory(""), undefined);
  });

  it("非 UUID 的 acc 被丢弃：结果与不传该参数完全一致（不报错）", () => {
    const injected = parseQueryFilter(params({ acc: "1,or(id.not.is.null)" }));
    assert.equal(injected.account, undefined);
    // 其余条件仍照常生效 —— 丢弃的是这一个条件，不是整份查询
    const mixed = parseQueryFilter(params({ acc: "bogus", type: "expense", min: "10" }));
    assert.equal(mixed.account, undefined);
    assert.equal(mixed.type, "expense");
    assert.equal(mixed.min, 10);
  });

  it("没有 acc 时与 acc=undefined 的结果逐字段相同", () => {
    assert.deepEqual(
      parseQueryFilter(params({ acc: "not-a-uuid" })),
      parseQueryFilter(params({})),
    );
  });

  it("只有 UUID 才会进入 .or() 过滤器字符串", () => {
    const f = parseQueryFilter(params({ acc: "1,or(id.not.is.null)" }));
    // 这正是 route.ts 里拼 .or() 的那段逻辑的前提
    const orFilter = f.account
      ? `account_id.eq.${f.account},to_account_id.eq.${f.account}`
      : null;
    assert.equal(orFilter, null, "被丢弃的 acc 不得拼进 .or() 表达式");
  });

  it("isUuid 拒绝 36 字符以外的长度与非法十六进制", () => {
    assert.equal(isUuid(UUID_A), true);
    assert.equal(isUuid(`${UUID_A}0`), false);
    assert.equal(isUuid(UUID_A.replace("a", "z")), false);
    assert.equal(isUuid("3f9c1d2e4a5b4c6d8e7f0a1b2c3d4e5f"), false, "无连字符不是 UUID");
  });
});

describe("LIKE 元字符转义", () => {
  it("% 被转义，不再是通配符", () => {
    // 未转义时这里是 "%%%" → 匹配全部行
    assert.equal(escapeLikePattern("%"), "\\%");
  });

  it("_ 被转义（下划线在 LIKE 里是单字符通配符）", () => {
    assert.equal(escapeLikePattern("_"), "\\_");
  });

  it("反斜杠先被转义，不会被二次处理", () => {
    assert.equal(escapeLikePattern("\\%"), "\\\\\\%");
  });

  it("普通关键词原样透传", () => {
    assert.equal(escapeLikePattern("alipay"), "alipay");
    assert.equal(escapeLikePattern("咖啡 拿铁"), "咖啡 拿铁");
  });

  it("两层转义：LIKE 转义后再做 .or() 值转义", () => {
    // 用户输入 `%` → LIKE 层 `\%` → or 值层把 `\` 再转义成 `\\`
    assert.equal(escapeOrValue(`%${escapeLikePattern("%")}%`), '"%\\\\%%"');
  });

  it("双引号仍被转义（防 .or() 参数被拆开）", () => {
    assert.equal(escapeOrValue('a"b'), '"a\\"b"');
  });

  it("?q=%25 不会匹配全表：构造出的模式只含一个字面 %", () => {
    const pattern = `%${escapeLikePattern("%")}%`;
    // 模式里有且只有一个未转义 % 在首尾；中间的 % 全部被反斜杠转义
    assert.equal(pattern, "%\\%%");
    assert.equal(pattern.replace(/\\%/g, ""), "%%", "去掉转义后只剩两端的包裹 %");
  });
});

describe("parseQueryFilter 的其余规则", () => {
  it("日期必须形如 YYYY-MM-DD", () => {
    assert.equal(parseQueryFilter(params({ from: "2026-09-01" })).from, "2026-09-01");
    assert.equal(parseQueryFilter(params({ from: "2026-9-1" })).from, undefined);
    assert.equal(parseQueryFilter(params({ to: "20260901" })).to, undefined);
  });

  it("类型受控；all 表示不过滤", () => {
    assert.equal(parseQueryFilter(params({ type: "expense" })).type, "expense");
    assert.equal(parseQueryFilter(params({ type: "all" })).type, "all");
    assert.equal(parseQueryFilter(params({ type: "nonsense" })).type, undefined);
  });

  it("金额边界必须非负且有限", () => {
    assert.equal(parseQueryFilter(params({ min: "0" })).min, 0);
    assert.equal(parseQueryFilter(params({ max: "-1" })).max, undefined);
    assert.equal(parseQueryFilter(params({ min: "abc" })).min, undefined);
  });

  it("关键词去空白并截断到 100 字符", () => {
    assert.equal(parseQueryFilter(params({ q: "  咖啡  " })).q, "咖啡");
    assert.equal(parseQueryFilter(params({ q: "   " })).q, undefined);
    assert.equal(parseQueryFilter(params({ q: "x".repeat(200) })).q?.length, 100);
  });

  it("days 吸附到 30/90/180，越界取最近端点", () => {
    assert.equal(snapDays(undefined), 90);
    assert.equal(snapDays(30), 30);
    assert.equal(snapDays(31), 30);
    assert.equal(snapDays(120), 90);
    assert.equal(snapDays(200), 180);
    assert.equal(snapDays(5), 30, "小于下界取下界");
    assert.equal(snapDays(9999), 180, "大于上界取上界");
    assert.equal(snapDays(Number.NaN), 90);
  });

  it("hasAnyFilter 区分「显式设了条件」与「全默认」", () => {
    assert.equal(hasAnyFilter({}), false);
    assert.equal(hasAnyFilter({ type: "all" }), false, "all 不算条件");
    assert.equal(hasAnyFilter({ type: "expense" }), true);
    assert.equal(hasAnyFilter({ min: 0 }), true, "0 是有效边界");
    assert.equal(hasAnyFilter({ q: "x" }), true);
  });
});

describe("qs 只有一份构造逻辑", () => {
  const filter: QueryFilter = {
    from: "2026-09-01",
    to: "2026-09-28",
    type: "expense",
    category: "none",
    min: 10,
  };

  it("参数顺序固定，与插入顺序无关", () => {
    const a = buildQueryString(filter);
    const b = buildQueryString({ min: 10, category: "none", to: "2026-09-28", type: "expense", from: "2026-09-01" });
    assert.equal(a, b);
    assert.equal(a, "from=2026-09-01&to=2026-09-28&type=expense&cat=none&min=10");
  });

  it("type=all 与空值不落串", () => {
    assert.equal(buildQueryString({ type: "all" }), "");
    assert.equal(buildQueryString({}), "");
    assert.equal(buildQueryString({ min: 0 }), "min=0");
  });

  it("同一天数下，链接 qs 与 API qs 逐字符一致", () => {
    // data-client 的天数 chip 与 /api/data 请求都走这一个函数，只是 days 选项不同
    const forChip = buildQueryString(filter, { days: 30 });
    const forApi = buildQueryString(filter, { days: 30, alwaysDays: true });
    assert.equal(forChip, forApi);
    assert.equal(forChip, "from=2026-09-01&to=2026-09-28&type=expense&cat=none&min=10&days=30");
  });

  it("alwaysDays 只影响默认值那一种情况", () => {
    assert.equal(buildQueryString(filter, { days: 90 }), buildQueryString(filter));
    assert.notEqual(
      buildQueryString(filter, { days: 90, alwaysDays: true }),
      buildQueryString(filter),
    );
  });

  it("查询串能被 parseQueryFilter 原样读回（往返一致）", () => {
    const qs = buildQueryString(filter, { days: 30, alwaysDays: true });
    assert.deepEqual(defined(parseQueryFilter(params(Object.fromEntries(new URLSearchParams(qs))))), defined(filter));
  });
});

describe("预设的日期来自访问日，不是构建日", () => {
  const buildDay = "2026-09-28"; // 假装构建发生在这一天
  const visitDay = "2026-09-29"; // 构建后第 2 天访问

  it("buildPresets 是纯函数：给定日期必得同一组预设", () => {
    assert.deepEqual(buildPresets(buildDay), buildPresets(buildDay));
  });

  it("构建后第 2 天访问，「近 7 天」指向访问日而非构建日", () => {
    const onBuild = buildPresets(buildDay).find((p) => p.label === "近 7 天支出")!;
    const onVisit = buildPresets(visitDay).find((p) => p.label === "近 7 天支出")!;

    assert.equal(onBuild.filter.to, buildDay);
    // 若日期是构建时被烤进 HTML 的，这里会等于 buildDay
    assert.equal(onVisit.filter.to, visitDay);
    assert.notEqual(onVisit.filter.to, buildDay);

    // 且窗口真的是「近 7 天」：含访问日，往前 6 天
    assert.equal(onVisit.filter.from, shiftDays(visitDay, -6));
    const span =
      (Date.parse(`${onVisit.filter.to}T00:00:00Z`) - Date.parse(`${onVisit.filter.from}T00:00:00Z`)) /
      86_400_000;
    assert.equal(span, 6, "含头含尾共 7 天");
  });

  it("「近 30 天支出」同理跟着访问日滚", () => {
    const onVisit = buildPresets(visitDay).find((p) => p.label === "近 30 天支出")!;
    assert.equal(onVisit.filter.to, visitDay);
    assert.equal(onVisit.filter.from, shiftDays(visitDay, -29));
  });

  it("本月预设的上界始终是访问日", () => {
    for (const label of ["本月支出", "本月收入"]) {
      const p = buildPresets(visitDay).find((x) => x.label === label)!;
      assert.equal(p.filter.to, visitDay, `${label} 的上界应是访问日`);
      assert.equal(p.filter.from, "2026-09-01");
    }
  });

  it("上月支出用的是真实月末（含闰年）", () => {
    const p = buildPresets(visitDay).find((x) => x.label === "上月支出")!;
    assert.equal(p.filter.from, "2026-08-01");
    assert.equal(p.filter.to, "2026-08-31");
  });

  it("跨年时上月落到上一年 12 月", () => {
    const p = buildPresets("2027-01-05").find((x) => x.label === "上月支出")!;
    assert.equal(p.filter.from, "2026-12-01");
    assert.equal(p.filter.to, "2026-12-31");
  });

  it("不依赖日期的两个预设（未分类 / 全部转账）在任何一天都一样", () => {
    assert.deepEqual(
      buildPresets(buildDay).slice(5),
      buildPresets(visitDay).slice(5),
    );
  });

  it("所有预设都能被 buildQueryString 序列化成合法 href", () => {
    for (const p of buildPresets(visitDay)) {
      const qs = buildQueryString(p.filter, { days: 90 });
      assert.ok(qs.length > 0, `${p.label} 不应产生空 href`);
      // 能被读回且语义不变
      assert.deepEqual(defined(parseQueryFilter(params(Object.fromEntries(new URLSearchParams(qs))))), defined(p.filter));
    }
  });
});

describe("日期算术（Asia/Shanghai 口径，纯日历运算）", () => {
  it("shiftDays 跨月、跨年、跨闰日", () => {
    assert.equal(shiftDays("2026-01-31", 1), "2026-02-01");
    assert.equal(shiftDays("2026-03-01", -1), "2026-02-28");
    assert.equal(shiftDays("2028-03-01", -1), "2028-02-29", "闰年");
    assert.equal(shiftDays("2026-01-01", -1), "2025-12-31");
    assert.equal(shiftDays("2026-01-01", 365), "2027-01-01", "2026 非闰年，整年 +365 天落在次年 1 月 1 日");
  });

  it("monthEnd 处理 28/29/30/31 天四种月份", () => {
    assert.equal(monthEnd("2026-02"), "2026-02-28");
    assert.equal(monthEnd("2028-02"), "2028-02-29");
    assert.equal(monthEnd("2026-04"), "2026-04-30");
    assert.equal(monthEnd("2026-12"), "2026-12-31");
  });

  it("prevMonthKey 跨年", () => {
    assert.equal(prevMonthKey("2026-01"), "2025-12");
    assert.equal(prevMonthKey("2026-09"), "2026-08");
    assert.equal(prevMonthKey("2026-12"), "2026-11");
  });

  it("日期算术不受进程时区影响（用的是 UTC 字段，不是本地字段）", () => {
    // 同一段纯算术在任何 TZ 下都得同一答案；旧实现用 `new Date(y, m-1, d+delta)`
    // 配本地 getter，跨夏令时切换会掉一天。
    const original = process.env.TZ;
    const results = ["Asia/Shanghai", "America/New_York", "Pacific/Kiritimati"].map((tz) => {
      process.env.TZ = tz;
      return `${shiftDays("2026-03-08", 1)}|${monthEnd("2026-02")}|${prevMonthKey("2026-01")}`;
    });
    process.env.TZ = original;
    assert.equal(results[0], results[1]);
    assert.equal(results[1], results[2]);
    assert.equal(results[0], "2026-03-09|2026-02-28|2025-12");
  });
});

describe("§data RPC 载荷收窄", () => {
  it("数字字符串被转成 number（Postgres numeric 经 PostgREST 可能是字符串）", () => {
    const stats = toFilteredTxStats({
      count: "128",
      expense: "3210.00",
      income: 8000,
      transfer: "0",
      by_category: [{ category_id: "c1", spent: "120.5" }],
    })!;
    assert.equal(stats.count, 128);
    assert.equal(stats.expense, 3210);
    assert.equal(stats.transfer, 0);
    assert.equal(stats.by_category[0].spent, 120.5);
  });

  it("形状不符时返回 null，而不是把 undefined 渲染成 NaN", () => {
    assert.equal(toFilteredTxStats(null), null);
    assert.equal(toFilteredTxStats("nope"), null);
    assert.equal(toFilteredTxStats([1, 2, 3]), null);
    assert.equal(toSnapshot(undefined), null);
  });

  it("缺失的可选数组退化为空数组，不炸", () => {
    const stats = toFilteredTxStats({ count: 0 })!;
    assert.deepEqual(stats.by_category, []);
    const snap = toSnapshot({})!;
    assert.deepEqual(snap.accounts, []);
    assert.deepEqual(snap.monthly, []);
  });

  it("NaN / Infinity 不进结果（避免页面出现 NaN）", () => {
    const stats = toFilteredTxStats({ count: Number.NaN, expense: Number.POSITIVE_INFINITY })!;
    assert.equal(stats.count, 0);
    assert.equal(stats.expense, 0);
  });

  // string 分支必须有 NaN 防线：生产上真正会命中它的恰恰是主线场景 ——
  // Postgres 的 numeric 列经 PostgREST 回来就是字符串。
  it("字符串分支的非有限值同样归零（numeric 列回来就是字符串）", () => {
    const stats = toFilteredTxStats({
      count: "abc",
      expense: "NaN",
      income: "Infinity",
      transfer: "-Infinity",
    })!;
    assert.equal(stats.count, 0);
    assert.equal(stats.expense, 0);
    assert.equal(stats.income, 0);
    assert.equal(stats.transfer, 0);
    // 每一个字段都必须是有限数，否则 JSON 序列化后会以 null 上屏
    for (const [k, v] of Object.entries(stats)) {
      if (typeof v === "number") assert.ok(Number.isFinite(v), `${k} 泄漏了非有限值: ${v}`);
    }
  });

  it("字符串分支：'1e400' 溢出、空白串、超大整数串都不得产出非有限值", () => {
    const stats = toFilteredTxStats({
      count: "1e400", // Number() → Infinity
      expense: "9".repeat(24), // 超大整数串，Number() 仍是有限值
      income: "  12  ", // 带空白，Number() 能吃
      transfer: "", // 空串 → Number('') === 0
    })!;
    assert.equal(stats.count, 0, "1e400 应归零");
    assert.equal(Number.isFinite(stats.expense), true);
    assert.equal(stats.income, 12, "空白数字串应被 Number 解析");
    assert.equal(stats.transfer, 0, "空串应得 0");
  });

  it("字符串分支：合法数字串必须**保留**（不能一律归零）", () => {
    const stats = toFilteredTxStats({ count: "128", expense: "3210.00", income: "-3" })!;
    assert.equal(stats.count, 128);
    assert.equal(stats.expense, 3210);
    assert.equal(stats.income, -3);
  });

  it("null / undefined / 布尔 / 数组 / 对象：既非 number 也非 string，一律 0", () => {
    const stats = toFilteredTxStats({
      count: null,
      expense: undefined,
      income: true,
      transfer: false,
    })!;
    assert.equal(stats.count, 0);
    assert.equal(stats.expense, 0);
    assert.equal(stats.income, 0);
    assert.equal(stats.transfer, 0);
    const arr = toFilteredTxStats({ count: [1], by_category: ["x", null, 5] })!;
    assert.equal(arr.count, 0);
    assert.deepEqual(arr.by_category, [], "非 record 元素应被 filter 掉");
  });

  it("by_category / snapshot 的嵌套字符串同样受 string 分支保护", () => {
    const stats = toFilteredTxStats({
      count: 1,
      by_category: [
        { category_id: "c1", spent: "abc" },
        { category_id: "c2", spent: "12.5" },
        { category_id: "c3", spent: "Infinity" },
      ],
    })!;
    assert.deepEqual(stats.by_category, [
      { category_id: "c1", spent: 0 },
      { category_id: "c2", spent: 12.5 },
      { category_id: "c3", spent: 0 },
    ]);
    const snap = toSnapshot({
      accounts: [{ id: "a1", balance: "NaN" }],
      monthly: [{ month: "2026-09", expense: "abc", income: "3" }],
      daily: [{ date: "2026-09-28", delta: "Infinity" }],
    })!;
    assert.equal(snap.accounts[0].balance, 0);
    assert.equal(snap.monthly[0].expense, 0);
    assert.equal(snap.monthly[0].income, 3);
    assert.equal(snap.daily[0].delta, 0);
  });

  it("snapshot 的 daily / monthly 被收窄成 number", () => {
    const snap = toSnapshot({
      accounts: [{ id: "a1", balance: "100.5" }],
      months: ["2026-09"],
      monthly: [{ month: "2026-09", expense: "10", income: 20 }],
      category: [{ category_id: "c1", spent: "5" }],
      daily: [{ date: "2026-09-28", delta: "-3" }],
    })!;
    assert.equal(snap.accounts[0].balance, 100.5);
    assert.equal(snap.monthly[0].expense, 10);
    assert.equal(snap.daily[0].delta, -3);
    assert.equal(snap.months[0], "2026-09");
  });
});
