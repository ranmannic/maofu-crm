import { prisma } from "@/lib/prisma";
import { SHIPPING_METHOD_LABELS } from "@/lib/constants";
import type { ShippingMethod } from "@/generated/prisma/client";
import type { OpsTask } from "@/lib/ops-workbench-types";

export type { OpsTask, OpsTaskType } from "@/lib/ops-workbench-types";
export { getOpsTaskLabel } from "@/lib/ops-workbench-types";

export async function getOpsWorkbench(page = 1, pageSize = 20) {
  const baseWhere = { deletedAt: null };

  const [unshipped, unpaid, partial, creditOrders] = await Promise.all([
    prisma.order.findMany({
      where: { ...baseWhere, isShipped: false },
      select: {
        id: true,
        orderNo: true,
        customerName: true,
        orderedAt: true,
        totalAmount: true,
        paymentStatus: true,
        shipping: { select: { method: true } },
      },
      orderBy: { orderedAt: "asc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: {
        ...baseWhere,
        paymentStatus: "UNPAID",
        isPaid: false,
        paidAmount: 0,
      },
      select: {
        id: true,
        orderNo: true,
        customerName: true,
        orderedAt: true,
        totalAmount: true,
        isShipped: true,
      },
      orderBy: { orderedAt: "asc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: {
        ...baseWhere,
        OR: [{ paymentStatus: "PARTIAL" }, { paidAmount: { gt: 0 }, isPaid: false }],
        paymentStatus: { not: "PAID" },
      },
      select: {
        id: true,
        orderNo: true,
        customerName: true,
        orderedAt: true,
        totalAmount: true,
        paidAmount: true,
        paymentStatus: true,
        creditStatus: true,
      },
      orderBy: { orderedAt: "asc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: {
        ...baseWhere,
        creditStatus: "ACTIVE",
        paymentStatus: { not: "PAID" },
      },
      include: {
        creditLines: { select: { unreconciledQty: true } },
      },
      orderBy: { orderedAt: "asc" },
      take: 50,
    }),
  ]);

  const tasks: OpsTask[] = [];

  for (const o of unshipped) {
    const method = o.shipping?.method
      ? SHIPPING_METHOD_LABELS[o.shipping.method as ShippingMethod]
      : "未设置";
    tasks.push({
      type: "UNSHIPPED",
      priority: 1,
      orderId: o.id,
      orderNo: o.orderNo,
      customerName: o.customerName,
      orderedAt: o.orderedAt.toISOString(),
      summary: `${method} · 总额待履约`,
      href: `/orders?highlight=${o.id}`,
    });
  }

  for (const o of unpaid) {
    tasks.push({
      type: "UNPAID",
      priority: 2,
      orderId: o.id,
      orderNo: o.orderNo,
      customerName: o.customerName,
      orderedAt: o.orderedAt.toISOString(),
      summary: o.isShipped ? "已发货未收款" : "未收款",
      href: `/orders?highlight=${o.id}`,
    });
  }

  for (const o of partial) {
    if (o.paymentStatus === "UNPAID" && o.paidAmount <= 0) continue;
    tasks.push({
      type: "PARTIAL_PAYMENT",
      priority: 3,
      orderId: o.id,
      orderNo: o.orderNo,
      customerName: o.customerName,
      orderedAt: o.orderedAt.toISOString(),
      summary: `已收 ¥${o.paidAmount.toFixed(2)} / ¥${o.totalAmount.toFixed(2)}`,
      href: `/orders?highlight=${o.id}`,
    });
  }

  for (const o of creditOrders) {
    const unreconciled = o.creditLines.reduce((s, l) => s + l.unreconciledQty, 0);
    if (unreconciled <= 0) continue;
    tasks.push({
      type: "CREDIT_RECONCILE",
      priority: 4,
      orderId: o.id,
      orderNo: o.orderNo,
      customerName: o.customerName,
      orderedAt: o.orderedAt.toISOString(),
      summary: `未核销 ${unreconciled} 单位`,
      href: `/credit`,
    });
  }

  tasks.sort(
    (a, b) =>
      a.priority - b.priority ||
      new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
  );

  const total = tasks.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    stats: {
      unshipped: unshipped.length,
      unpaid: unpaid.length,
      partialPayment: partial.filter(
        (o) => o.paymentStatus !== "UNPAID" || o.paidAmount > 0
      ).length,
      creditReconcile: creditOrders.filter((o) =>
        o.creditLines.some((l) => l.unreconciledQty > 0)
      ).length,
      total,
    },
    tasks: tasks.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}
