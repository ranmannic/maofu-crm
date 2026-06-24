export type ChurnLevel = "GREEN" | "YELLOW" | "RED";
export type CustomerSegment = "LEAD" | "CLOSED" | "CHURNED";
export type CustomerStatus = "LEAD" | "CLOSED";
export type ReminderStatus = "NONE" | "DUE_SOON" | "OVERDUE";

const MS_DAY = 86400000;

/** 距上次下单的天数 */
export function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / MS_DAY);
}

/** 已成交客户活跃度：3月内绿 / 3-6月黄 / 6月以上红（流失） */
export function getChurnLevel(lastOrderAt: Date | null | undefined): ChurnLevel | null {
  const d = daysSince(lastOrderAt);
  if (d === null) return null;
  if (d <= 90) return "GREEN";
  if (d <= 180) return "YELLOW";
  return "RED";
}

export function getCustomerSegment(
  customerStatus: CustomerStatus | null | undefined,
  lastPaidOrderAt: Date | null | undefined
): CustomerSegment {
  if ((customerStatus ?? "LEAD") === "LEAD") return "LEAD";
  if (!lastPaidOrderAt) return "CLOSED";
  return getChurnLevel(lastPaidOrderAt) === "RED" ? "CHURNED" : "CLOSED";
}

export function formatSinceLastOrder(lastOrderAt: Date | null | undefined): string {
  const d = daysSince(lastOrderAt);
  if (d === null) return "—";
  if (d === 0) return "今天";
  if (d < 30) return `${d} 天`;
  const months = Math.floor(d / 30);
  const restDays = d % 30;
  if (restDays === 0) return `${months} 个月`;
  return `${months} 个月 ${restDays} 天`;
}

/** 下次跟进前一天起提醒；过期后持续提醒直至新增跟进 */
export function getReminderStatus(
  nextFollowUpAt: Date | null | undefined
): ReminderStatus {
  if (!nextFollowUpAt) return "NONE";
  const now = new Date();
  if (now >= nextFollowUpAt) return "OVERDUE";
  const reminderStart = new Date(nextFollowUpAt);
  reminderStart.setDate(reminderStart.getDate() - 1);
  reminderStart.setHours(0, 0, 0, 0);
  if (now >= reminderStart) return "DUE_SOON";
  return "NONE";
}

export function canAbandonCustomer(segment: CustomerSegment): boolean {
  return segment === "LEAD" || segment === "CHURNED";
}

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  LEAD: "线索客户",
  CLOSED: "已成交",
  CHURNED: "流失客户",
};

export const CHURN_LABELS: Record<ChurnLevel, string> = {
  GREEN: "活跃",
  YELLOW: "需关注",
  RED: "流失",
};

export const REMINDER_LABELS: Record<ReminderStatus, string> = {
  NONE: "",
  DUE_SOON: "待跟进",
  OVERDUE: "逾期未跟进",
};
