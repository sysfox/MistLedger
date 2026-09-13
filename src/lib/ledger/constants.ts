// 雾夜账共享常量：账户类型 / 支付渠道 / 默认分类种子
export const ACCOUNT_TYPES = [
  { value: "bank_card", label: "银行卡" },
  { value: "alipay_balance", label: "支付宝余额" },
  { value: "wechat_change", label: "微信零钱" },
  { value: "lingqiantong", label: "零钱通（活期理财）" },
  { value: "other", label: "其他" },
] as const;

export const CHANNELS = [
  { value: "alipay", label: "支付宝" },
  { value: "wechat", label: "微信支付" },
  { value: "direct", label: "其他方式" },
  { value: "other", label: "其他" },
] as const;

export function accountTypeLabel(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function channelLabel(channel: string) {
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
