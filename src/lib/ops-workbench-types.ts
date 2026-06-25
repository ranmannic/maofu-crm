export type OpsTaskType =
  | "UNSHIPPED"
  | "UNPAID"
  | "RECONCILE_REVIEW"
  | "CREDIT_RECONCILE";

export interface OpsTask {
  type: OpsTaskType;
  priority: number;
  orderId: string;
  orderNo: string;
  customerName: string;
  orderedAt: string;
  summary: string;
  href: string;
}

const TASK_LABELS: Record<OpsTaskType, string> = {
  UNSHIPPED: "待发货",
  UNPAID: "待收款",
  RECONCILE_REVIEW: "核销待审核",
  CREDIT_RECONCILE: "待核销",
};

export function getOpsTaskLabel(type: OpsTaskType) {
  return TASK_LABELS[type];
}
