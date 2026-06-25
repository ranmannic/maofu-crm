import { prisma } from "@/lib/prisma";
import { calcPerformanceAmount } from "@/lib/order-math";
import type { Prisma } from "@/generated/prisma/client";

export type ReconcileItemInput = {
  orderItemId: string;
  quantity: number;
};

type OrderItemRow = {
  id: string;
  unitPrice: number;
  isGift?: boolean;
};

/** 从核销记录 detail JSON 解析核销明细 */
export function parseReconcileItemsFromDetail(
  detail: string | null
): ReconcileItemInput[] {
  if (!detail) return [];
  try {
    const parsed = JSON.parse(detail) as
      | ReconcileItemInput[]
      | { orderItemId?: string; quantity?: number }[];
    const raw = Array.isArray(parsed) ? parsed : [];
    return raw
      .filter((i) => i.orderItemId && (i.quantity ?? 0) > 0)
      .map((i) => ({
        orderItemId: i.orderItemId!,
        quantity: i.quantity ?? 0,
      }));
  } catch {
    return [];
  }
}

/** 本次核销对应的产品业绩金额（不含运费/其它费用） */
export function calcReconcilePerformanceAmount(
  items: OrderItemRow[],
  reconcileItems: ReconcileItemInput[]
): number {
  const itemMap = new Map(items.map((i) => [i.id, i]));
  return reconcileItems.reduce((sum, r) => {
    if (r.quantity <= 0) return sum;
    const item = itemMap.get(r.orderItemId);
    if (!item || item.isGift) return sum;
    return sum + item.unitPrice * r.quantity;
  }, 0);
}

/** 解析核销记录应计入的业绩（兼容历史未回填数据） */
export function resolveReconciliationPerformanceAmount(
  rec: {
    performanceAmount?: number | null;
    detail?: string | null;
    reviewStatus?: string | null;
  },
  orderItems: OrderItemRow[]
): number {
  if (rec.reviewStatus === "PENDING" || rec.reviewStatus === "REJECTED") {
    return 0;
  }
  const stored = Number(rec.performanceAmount);
  if (Number.isFinite(stored) && stored > 0) return stored;
  const reconcileItems = parseReconcileItemsFromDetail(rec.detail ?? null);
  if (reconcileItems.length === 0) return 0;
  return calcReconcilePerformanceAmount(orderItems, reconcileItems);
}

/** 退款对应的业绩扣减金额（按产品金额占比，不含运费/其它费用） */
export function calcRefundPerformanceAmount(order: {
  totalAmount: number;
  productAmount: number;
  shippingFee?: number;
  otherFee?: number;
  refundAmount: number;
}): number {
  if (order.refundAmount <= 0) return 0;
  const maxProduct = order.productAmount > 0
    ? order.productAmount
    : calcPerformanceAmount(
        order.totalAmount,
        order.shippingFee ?? 0,
        order.otherFee ?? 0
      );
  if (order.totalAmount <= 0) return 0;
  const ratio = Math.min(1, order.refundAmount / order.totalAmount);
  return Math.min(maxProduct, maxProduct * ratio);
}

export async function recordCollectPerformance(
  tx: Prisma.TransactionClient,
  data: {
    orderId: string;
    salesId: string;
    amount: number;
    eventAt: Date;
    reconciliationRecordId?: string;
    detail?: string;
  }
) {
  if (data.amount <= 0) return;
  await tx.performanceRecord.create({
    data: {
      orderId: data.orderId,
      salesId: data.salesId,
      amount: data.amount,
      type: "COLLECT",
      eventAt: data.eventAt,
      reconciliationRecordId: data.reconciliationRecordId,
      detail: data.detail,
    },
  });
}

export async function recordRefundPerformance(
  tx: Prisma.TransactionClient,
  data: {
    orderId: string;
    salesId: string;
    amount: number;
    eventAt: Date;
    detail?: string;
  }
) {
  if (data.amount <= 0) return;
  await tx.performanceRecord.deleteMany({
    where: { orderId: data.orderId, type: "REFUND" },
  });
  await tx.performanceRecord.create({
    data: {
      orderId: data.orderId,
      salesId: data.salesId,
      amount: data.amount,
      type: "REFUND",
      eventAt: data.eventAt,
      detail: data.detail,
    },
  });
}

/** 回填核销记录业绩字段，并生成对应 PerformanceRecord */
async function syncReconciliationPerformanceRecords(salesId?: string) {
  const recs = await prisma.creditReconciliationRecord.findMany({
    where: {
      order: {
        deletedAt: null,
        ...(salesId ? { salesId } : {}),
      },
    },
    include: {
      order: { include: { items: true } },
    },
  });

  if (recs.length === 0) return;

  const existingPerf = await prisma.performanceRecord.findMany({
    where: {
      reconciliationRecordId: { in: recs.map((r) => r.id) },
    },
  });
  const perfByRecId = new Map(
    existingPerf
      .filter((p) => p.reconciliationRecordId)
      .map((p) => [p.reconciliationRecordId!, p])
  );

  for (const rec of recs) {
    if (rec.reviewStatus !== "APPROVED") continue;

    const performanceAmount = resolveReconciliationPerformanceAmount(
      rec,
      rec.order.items
    );
    const paidAt = rec.paidAt ?? rec.createdAt;

    if (rec.performanceAmount !== performanceAmount || !rec.paidAt) {
      await prisma.creditReconciliationRecord.update({
        where: { id: rec.id },
        data: { performanceAmount, paidAt },
      });
    }

    if (performanceAmount <= 0) continue;

    const linked = perfByRecId.get(rec.id);
    if (!linked) {
      const created = await prisma.performanceRecord.create({
        data: {
          orderId: rec.orderId,
          salesId: rec.order.salesId,
          amount: performanceAmount,
          type: "COLLECT",
          eventAt: paidAt,
          reconciliationRecordId: rec.id,
          detail: rec.detail,
        },
      });
      perfByRecId.set(rec.id, created);
      continue;
    }

    if (
      linked.amount !== performanceAmount ||
      linked.eventAt.getTime() !== paidAt.getTime()
    ) {
      await prisma.performanceRecord.update({
        where: { id: linked.id },
        data: { amount: performanceAmount, eventAt: paidAt },
      });
    }
  }
}

/** 无核销记录的已收款订单：按收款时间补一条业绩记录 */
async function syncLegacyOrderPerformanceRecords(salesId?: string) {
  const where: Record<string, unknown> = {
    deletedAt: null,
    paidAmount: { gt: 0 },
    performanceRecords: { none: { type: "COLLECT" } },
    reconciliationRecords: { none: {} },
  };
  if (salesId) where.salesId = salesId;

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      salesId: true,
      totalAmount: true,
      shippingFee: true,
      otherFee: true,
      productAmount: true,
      paidAmount: true,
      paidAt: true,
      orderedAt: true,
    },
  });

  for (const order of orders) {
    const maxPerf = calcPerformanceAmount(
      order.totalAmount,
      order.shippingFee ?? 0,
      order.otherFee ?? 0
    );
    const ratio =
      order.totalAmount > 0
        ? Math.min(1, order.paidAmount / order.totalAmount)
        : 0;
    const amount = (order.productAmount > 0 ? order.productAmount : maxPerf) * ratio;
    if (amount <= 0) continue;
    await prisma.performanceRecord.create({
      data: {
        orderId: order.id,
        salesId: order.salesId,
        amount,
        type: "COLLECT",
        eventAt: order.paidAt ?? order.orderedAt,
        detail: JSON.stringify({ legacy: true }),
      },
    });
  }
}

/** 统一初始化/同步业绩相关历史数据（失败时不阻断页面） */
export async function syncPerformanceData(salesId?: string) {
  try {
    await syncReconciliationPerformanceRecords(salesId);
    await syncLegacyOrderPerformanceRecords(salesId);
  } catch (error) {
    console.error("[syncPerformanceData]", error);
  }
}

/** @deprecated 使用 syncPerformanceData */
export async function syncLegacyPerformanceRecords(salesId?: string) {
  await syncPerformanceData(salesId);
}
