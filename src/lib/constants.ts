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

/** sessionStorage：管理员首页数据可见性（登录时重置为隐藏） */
export const ADMIN_DASHBOARD_DATA_VISIBLE_KEY = "maofu_admin_dashboard_data_visible";
