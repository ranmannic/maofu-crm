import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** 已确认收款（全额或部分）后自动标记为成交客户 */
export async function markCustomerClosedOnPayment(
  customerId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  await client.customer.updateMany({
    where: { id: customerId, customerStatus: "LEAD" },
    data: { customerStatus: "CLOSED" },
  });
}

export const CUSTOMER_STATUS_LABELS = {
  LEAD: "线索客户",
  CLOSED: "成交客户",
} as const;

export const PAID_ORDER_FILTER: Prisma.OrderWhereInput = {
  deletedAt: null,
  paymentStatus: { in: ["PAID", "PARTIAL"] },
  paidAmount: { gt: 0 },
};
