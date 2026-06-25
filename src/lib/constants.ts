import type { SpecUnit } from "@/generated/prisma/client";

export const SPEC_UNIT_LABELS: Record<SpecUnit, string> = {
  BOTTLE: "瓶",
  BOX: "箱",
  PIECE: "件",
  SET: "套",
};

export const SPEC_UNIT_OPTIONS: { value: SpecUnit; label: string }[] = [
  { value: "BOTTLE", label: "瓶" },
  { value: "BOX", label: "箱" },
  { value: "PIECE", label: "件" },
  { value: "SET", label: "套" },
];

export const DEFAULT_PAGE_SIZE = 30;

export const SHIPPING_METHOD_LABELS: Record<
  "PICKUP" | "SELF_DELIVERY" | "EXPRESS" | "LOGISTICS" | "ON_SITE_STOCKING",
  string
> = {
  PICKUP: "到厂自提",
  SELF_DELIVERY: "自行配送",
  EXPRESS: "快递发货",
  LOGISTICS: "物流发货",
  ON_SITE_STOCKING: "现场铺货",
};

export const SHIPPING_METHOD_OPTIONS = (
  Object.entries(SHIPPING_METHOD_LABELS) as [
    keyof typeof SHIPPING_METHOD_LABELS,
    string,
  ][]
).map(([value, label]) => ({ value, label }));

export const VOUCHER_CATEGORY_LABELS: Record<
  "CONTRACT" | "SIGN_OFF" | "CHAT" | "PAYMENT" | "OTHER",
  string
> = {
  CONTRACT: "合同",
  SIGN_OFF: "签单",
  CHAT: "聊天记录",
  PAYMENT: "付款截图",
  OTHER: "其他",
};

export const VOUCHER_CATEGORY_OPTIONS = (
  Object.entries(VOUCHER_CATEGORY_LABELS) as [
    keyof typeof VOUCHER_CATEGORY_LABELS,
    string,
  ][]
).map(([value, label]) => ({ value, label }));

/** sessionStorage：管理员首页数据可见性（登录时重置为隐藏） */
export const ADMIN_DASHBOARD_DATA_VISIBLE_KEY = "maofu_admin_dashboard_data_visible";
