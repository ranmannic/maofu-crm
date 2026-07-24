import { prisma } from "@/lib/prisma";
import { calcPerformanceAmount } from "@/lib/order-math";
import type { PaymentStatus, Prisma } from "@/generated/prisma/client";

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

/** 按当前订单金额与收款状态，该订单最多可计入的已收款业绩（产品业绩口径） */
export function calcMaxCollectiblePerformance(order: {
  totalAmount: number;
  shippingFee?: number | null;
  otherFee?: number | null;
  productAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
}): number {
  const maxProduct =
    order.productAmount > 0
      ? order.productAmount
      : calcPerformanceAmount(
          order.totalAmount,
          order.shippingFee ?? 0,
          order.otherFee ?? 0
        );
  if (order.paidAmount <= 0) return 0;
  if (
    order.paymentStatus === "PAID" ||
    (order.totalAmount > 0 && order.paidAmount >= order.totalAmount)
  ) {
    return roundMoney(maxProduct);
  }
  const ratio =
    order.totalAmount > 0
      ? Math.min(1, order.paidAmount / order.totalAmount)
      : 0;
  return roundMoney(maxProduct * ratio);
}

/** 本次可新增计入的业绩，不超过收款比例上限 */
export function capCollectPerformanceIncrement(
  order: Parameters<typeof calcMaxCollectiblePerformance>[0],
  alreadyCollected: number,
  proposedIncrement: number
): number {
  const maxAllowed = calcMaxCollectiblePerformance(order);
  const headroom = Math.max(0, maxAllowed - alreadyCollected);
  return roundMoney(Math.min(Math.max(0, proposedIncrement), headroom));
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export async function sumOrderCollectPerformance(
  tx: Prisma.TransactionClient | typeof prisma,
  orderId: string
): Promise<number> {
  const agg = await tx.performanceRecord.aggregate({
    where: { orderId, type: "COLLECT" },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/** 将订单 COLLECT 业绩总量收紧至与当前 productAmount / paidAmount 一致 */
export async function rebalanceOrderCollectPerformance(
  tx: Prisma.TransactionClient,
  orderId: string
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      totalAmount: true,
      shippingFee: true,
      otherFee: true,
      productAmount: true,
      paidAmount: true,
      paymentStatus: true,
    },
  });
  if (!order) return;

  const records = await tx.performanceRecord.findMany({
    where: { orderId, type: "COLLECT" },
    orderBy: { eventAt: "asc" },
  });
  if (records.length === 0) return;

  if (order.paidAmount <= 0 || order.paymentStatus === "UNPAID") {
    await tx.performanceRecord.deleteMany({
      where: { orderId, type: "COLLECT" },
    });
    return;
  }

  const maxAllowed = calcMaxCollectiblePerformance(order);
  let sum = records.reduce((s, r) => s + r.amount, 0);
  if (sum <= maxAllowed + 0.005) return;

  let excess = sum - maxAllowed;
  for (let i = records.length - 1; i >= 0 && excess > 0.005; i--) {
    const rec = records[i]!;
    const cut = Math.min(rec.amount, excess);
    const newAmount = roundMoney(rec.amount - cut);
    excess -= cut;
    if (newAmount <= 0) {
      await tx.performanceRecord.delete({ where: { id: rec.id } });
    } else {
      await tx.performanceRecord.update({
        where: { id: rec.id },
        data: { amount: newAmount },
      });
    }
  }
}

/** 无核销记录的直接收款订单：同步/修正 COLLECT 业绩 */
async function syncDirectPaymentPerformanceRecords(salesId?: string) {
  const where: Record<string, unknown> = {
    deletedAt: null,
    paidAmount: { gt: 0 },
    reconciliationRecords: { none: {} },
    performanceRecords: { some: { type: "COLLECT" } },
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
      paymentStatus: true,
      paidAt: true,
      orderedAt: true,
    },
  });

  for (const order of orders) {
    const target = calcMaxCollectiblePerformance(order);
    if (target <= 0) {
      await prisma.performanceRecord.deleteMany({
        where: { orderId: order.id, type: "COLLECT" },
      });
      continue;
    }

    const records = await prisma.performanceRecord.findMany({
      where: { orderId: order.id, type: "COLLECT" },
      orderBy: { eventAt: "asc" },
    });

    const directRecords = records.filter((r) => !r.reconciliationRecordId);
    if (directRecords.length === 1) {
      const rec = directRecords[0]!;
      if (Math.abs(rec.amount - target) > 0.005) {
        await prisma.performanceRecord.update({
          where: { id: rec.id },
          data: { amount: target },
        });
      }
    }

    await prisma.$transaction((tx) =>
      rebalanceOrderCollectPerformance(tx, order.id)
    );
  }
}

async function rebalanceOrdersWithCollectPerformance(salesId?: string) {
  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      performanceRecords: { some: { type: "COLLECT" } },
      ...(salesId ? { salesId } : {}),
    },
    select: { id: true },
  });
  for (const { id } of orders) {
    await prisma.$transaction((tx) => rebalanceOrderCollectPerformance(tx, id));
  }
}

/** 产品数量已全部核销但实收业绩偏少：按当前已收上限补记尾款业绩 */
async function syncPaymentTailAfterFullProductReconcile(salesId?: string) {
  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      paidAmount: { gt: 0 },
      creditLines: {
        some: {},
        every: { unreconciledQty: { lte: 0 } },
      },
      ...(salesId ? { salesId } : {}),
    },
    select: {
      id: true,
      salesId: true,
      totalAmount: true,
      shippingFee: true,
      otherFee: true,
      productAmount: true,
      paidAmount: true,
      paymentStatus: true,
      paidAt: true,
      orderedAt: true,
    },
  });

  for (const order of orders) {
    const target = calcMaxCollectiblePerformance(order);
    if (target <= 0) continue;

    const collected = await sumOrderCollectPerformance(prisma, order.id);
    const gap = roundMoney(target - collected);
    if (gap <= 0.005) continue;

    const existingTail = await prisma.performanceRecord.findFirst({
      where: {
        orderId: order.id,
        type: "COLLECT",
        detail: { contains: "paymentTail" },
      },
    });
    if (existingTail) {
      if (Math.abs(existingTail.amount - gap) > 0.005) {
        await prisma.performanceRecord.update({
          where: { id: existingTail.id },
          data: { amount: gap },
        });
      }
      continue;
    }

    await prisma.performanceRecord.create({
      data: {
        orderId: order.id,
        salesId: order.salesId,
        amount: gap,
        type: "COLLECT",
        eventAt: order.paidAt ?? order.orderedAt,
        detail: JSON.stringify({
          paymentTail: true,
          productReconcileComplete: true,
        }),
      },
    });
  }
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
      paymentStatus: true,
    },
  });

  for (const order of orders) {
    const amount = calcMaxCollectiblePerformance(order);
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
    await syncDirectPaymentPerformanceRecords(salesId);
    await syncPaymentTailAfterFullProductReconcile(salesId);
    await rebalanceOrdersWithCollectPerformance(salesId);
  } catch (error) {
    console.error("[syncPerformanceData]", error);
  }
}

/** @deprecated 使用 syncPerformanceData */
export async function syncLegacyPerformanceRecords(salesId?: string) {
  await syncPerformanceData(salesId);
}
