// 雾夜账共享常量：账户类型 / 支付渠道 / 默认分类种子
export const ACCOUNT_TYPES = [
  { value: "bank_card", label: "银行卡" },
  { value: "alipay_balance", label: "支付宝余额" },
  { value: "wechat_change", label: "微信零钱" },
  { value: "lingqiantong", label: "零钱通（活期理财）" },
  { value: "other", label: "其他" },
] as const;

// 渠道是受控词汇表：四个选项必须互不重叠。
// 旧值 direct="其他方式" 与 other="其他" 语义重叠，下拉里并排出现两个几乎一样的
// 选项等于没得选（DESIGN.md 第十节「禁止同义漂移」）。
// 现按「是否经由第三方支付」这一条轴线划分，两两不重叠：
//   alipay  支付宝   —— 走支付宝
//   wechat  微信支付 —— 走微信
//   direct  现金     —— 现金 / 银行柜台 / 银行转账等不经第三方的直接支付
//   other   其他渠道 —— 以上都不是
// 注意：value 保持 direct / other 不变（数据库已有数据无需迁移），只改展示文案。
export const CHANNELS = [
  { value: "alipay", label: "支付宝" },
  { value: "wechat", label: "微信支付" },
  { value: "direct", label: "现金" },
  { value: "other", label: "其他渠道" },
] as const;

export function accountTypeLabel(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function channelLabel(channel: string | null | undefined) {
  return CHANNELS.find((c) => c.value === channel)?.label ?? channel;
}

// 新用户默认分类种子（V1.0 需求：餐饮/交通/购物/学习/宿舍/娱乐 + 收入类）
export const DEFAULT_CATEGORIES: { name: string; kind: "expense" | "income"; sort: number }[] = [
  { name: "餐饮", kind: "expense", sort: 1 },
  { name: "交通", kind: "expense", sort: 2 },
  { name: "购物", kind: "expense", sort: 3 },
  { name: "学习", kind: "expense", sort: 4 },
  { name: "宿舍", kind: "expense", sort: 5 },
  { name: "娱乐", kind: "expense", sort: 6 },
  { name: "生活费", kind: "income", sort: 11 },
  { name: "兼职", kind: "income", sort: 12 },
  { name: "红包", kind: "income", sort: 13 },
];
