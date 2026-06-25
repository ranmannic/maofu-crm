import { markCustomerClosedOnPayment } from "@/lib/customer-status";
import { prisma } from "@/lib/prisma";
import { toBottleCount, resolveBottlesPerUnit } from "@/lib/unit-convert";
import { syncPaymentFields, calcPerformanceAmount } from "@/lib/order-math";
import {
  calcReconcilePerformanceAmount,
  recordCollectPerformance,
} from "@/lib/performance";
import type {
  CreditOrderStatus,
  PaymentStatus,
  Prisma,
  SpecUnit,
} from "@/generated/prisma/client";

export type ReconcileItemInput = {
  orderItemId: string;
  quantity: number;
};

export type BadDebtItemInput = {
  orderItemId: string;
  recoveredQty: number;
};

type OrderItemRow = {
  id: string;
  productId: string;
  productSpecId: string;
  productName: string;
  specName: string;
  unitType: SpecUnit;
  quantity: number;
};

/** 是否应纳入账期核销：部分付款，或未付款但已发货 */
export function shouldActivateCredit(order: {
  paymentStatus: PaymentStatus;
  isShipped: boolean;
  isPaid?: boolean;
  creditStatus?: CreditOrderStatus | null;
}) {
  if (order.creditStatus === "SETTLED" || order.creditStatus === "BAD_DEBT") {
    return false;
  }
  if (order.paymentStatus === "PAID" || order.isPaid) return false;
  if (order.paymentStatus === "PARTIAL") return true;
  if (order.paymentStatus === "UNPAID" && order.isShipped) return true;
  return false;
}

/** 本次收款是否需要填写核销产品数量（账期订单部分付款/补款结清） */
export function requiresPaymentReconciliation(
  order: {
    paymentStatus: PaymentStatus;
    creditStatus?: CreditOrderStatus | null;
    paidAmount: number;
    creditLines?: { unreconciledQty: number }[];
  },
  newPaymentStatus: PaymentStatus
): boolean {
  if (newPaymentStatus === "UNPAID") return false;
  if (
    order.creditLines &&
    order.creditLines.length > 0 &&
    order.creditLines.every((l) => l.unreconciledQty <= 0)
  ) {
    return false;
  }
  if (newPaymentStatus === "PARTIAL") return true;
  if (order.paymentStatus !== "PARTIAL" && order.paidAmount <= 0) return false;
  return true;
}

/** 同步所有符合条件的订单到账期核销（补全历史数据） */
export async function syncEligibleCreditOrders(salesId?: string) {
  const where: Record<string, unknown> = {
    deletedAt: null,
    isPaid: false,
    paymentStatus: { not: "PAID" },
    OR: [
      { paymentStatus: "PARTIAL" },
      { paymentStatus: "UNPAID", isShipped: true },
    ],
  };
  if (salesId) where.salesId = salesId;

  const orders = await prisma.order.findMany({
    where,
    select: { id: true },
  });

  for (const order of orders) {
    await ensureCreditOrderActive(order.id);
  }
}

/** 订单进入账期核销时初始化库存 */
export async function ensureCreditOrderActive(
  orderId: string,
  context?: {
    paymentStatus?: PaymentStatus;
    isShipped?: boolean;
    isPaid?: boolean;
    creditStatus?: CreditOrderStatus | null;
  }
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;

  const eligibility = {
    paymentStatus: context?.paymentStatus ?? order.paymentStatus,
    isShipped: context?.isShipped ?? order.isShipped,
    isPaid: context?.isPaid ?? order.isPaid,
    creditStatus: context?.creditStatus ?? order.creditStatus,
  };
  if (!shouldActivateCredit(eligibility)) return;

  const existingLines = await prisma.orderCreditLine.count({
    where: { orderId },
  });
  if (existingLines > 0) {
    if (order.creditStatus !== "ACTIVE") {
      await prisma.order.update({
        where: { id: orderId },
        data: { creditStatus: "ACTIVE" },
      });
    }
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { creditStatus: "ACTIVE" },
    });

    for (const item of order.items) {
      await tx.orderCreditLine.create({
        data: {
          orderId: order.id,
          orderItemId: item.id,
          customerId: order.customerId,
          productSpecId: item.productSpecId,
          productName: item.productName,
          specName: item.specName,
          unitType: item.unitType,
          orderQty: item.quantity,
          unreconciledQty: item.quantity,
          reconciledQty: 0,
        },
      });

      await upsertCustomerInventory(tx, order.customerId, item, item.quantity, 0);
    }
  });
}

/** @deprecated 使用 ensureCreditOrderActive */
export const activateCreditForOrder = ensureCreditOrderActive;

async function upsertCustomerInventory(
  tx: Prisma.TransactionClient,
  customerId: string,
  item: OrderItemRow,
  addUnreconciled: number,
  addReconciled: number
) {
  const existing = await tx.customerInventory.findUnique({
    where: {
      customerId_productSpecId: {
        customerId,
        productSpecId: item.productSpecId,
      },
    },
  });

  if (existing) {
    await tx.customerInventory.update({
      where: { id: existing.id },
      data: {
        unreconciledQty: existing.unreconciledQty + addUnreconciled,
        reconciledQty: existing.reconciledQty + addReconciled,
        productName: item.productName,
        specName: item.specName,
      },
    });
  } else {
    await tx.customerInventory.create({
      data: {
        customerId,
        productId: item.productId,
        productSpecId: item.productSpecId,
        productName: item.productName,
        specName: item.specName,
        unitType: item.unitType,
        unreconciledQty: addUnreconciled,
        reconciledQty: addReconciled,
      },
    });
  }
}

/** 执行核销：将指定数量从未核销转为已核销 */
export async function applyReconciliation(
  orderId: string,
  items: ReconcileItemInput[]
) {
  if (items.length === 0) return;

  const lines = await prisma.orderCreditLine.findMany({
    where: { orderId },
  });
  const lineMap = new Map(lines.map((l) => [l.orderItemId, l]));

  await prisma.$transaction(async (tx) => {
    for (const { orderItemId, quantity } of items) {
      if (quantity <= 0) continue;
      const line = lineMap.get(orderItemId);
      if (!line) throw new Error(`订单行 ${orderItemId} 不在账期管理中`);
      if (quantity > line.unreconciledQty) {
        throw new Error(
          `${line.productName} 核销数量不能超过未核销数量 ${line.unreconciledQty}`
        );
      }

      await tx.orderCreditLine.update({
        where: { id: line.id },
        data: {
          unreconciledQty: line.unreconciledQty - quantity,
          reconciledQty: line.reconciledQty + quantity,
        },
      });

      const inv = await tx.customerInventory.findUnique({
        where: {
          customerId_productSpecId: {
            customerId: line.customerId,
            productSpecId: line.productSpecId,
          },
        },
      });
      if (!inv) throw new Error("客户库存记录不存在");
      if (quantity > inv.unreconciledQty) {
        throw new Error(`${line.productName} 客户未核销库存不足`);
      }

      await tx.customerInventory.update({
        where: { id: inv.id },
        data: {
          unreconciledQty: inv.unreconciledQty - quantity,
          reconciledQty: inv.reconciledQty + quantity,
        },
      });
    }
  });
}

export async function settleCreditOrder(orderId: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { creditStatus: "SETTLED" },
  });
}

export async function markBadDebt(
  orderId: string,
  data: {
    badDebtAmount: number;
    goodsRecovered: boolean;
    items: BadDebtItemInput[];
    notes?: string;
  },
  userId: string,
  userName: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error("订单不存在");
  if (order.creditStatus === "SETTLED") throw new Error("已结清订单不能标记坏账");

  await prisma.$transaction(async (tx) => {
    if (order.creditStatus !== "ACTIVE") {
      for (const item of order.items) {
        const exists = await tx.orderCreditLine.findUnique({
          where: { orderItemId: item.id },
        });
        if (!exists) {
          await tx.orderCreditLine.create({
            data: {
              orderId: order.id,
              orderItemId: item.id,
              customerId: order.customerId,
              productSpecId: item.productSpecId,
              productName: item.productName,
              specName: item.specName,
              unitType: item.unitType,
              orderQty: item.quantity,
              unreconciledQty: item.quantity,
              reconciledQty: 0,
            },
          });
          await upsertCustomerInventory(tx, order.customerId, item, item.quantity, 0);
        }
      }
    }

    const lines = await tx.orderCreditLine.findMany({ where: { orderId } });
    const lineMap = new Map(lines.map((l) => [l.orderItemId, l]));

    for (const { orderItemId, recoveredQty: qtyInput } of data.items) {
      const line = lineMap.get(orderItemId);
      if (!line) continue;

      if (data.goodsRecovered) {
        const recovered = Math.min(Math.max(0, qtyInput), line.unreconciledQty);
        if (recovered > 0) {
          await tx.orderCreditLine.update({
            where: { id: line.id },
            data: {
              unreconciledQty: line.unreconciledQty - recovered,
              reconciledQty: line.reconciledQty + recovered,
              badDebtRecoveredQty: recovered,
            },
          });
          const inv = await tx.customerInventory.findUnique({
            where: {
              customerId_productSpecId: {
                customerId: line.customerId,
                productSpecId: line.productSpecId,
              },
            },
          });
          if (inv && recovered <= inv.unreconciledQty) {
            await tx.customerInventory.update({
              where: { id: inv.id },
              data: {
                unreconciledQty: inv.unreconciledQty - recovered,
                reconciledQty: inv.reconciledQty + recovered,
              },
            });
          }
        }
      } else if (qtyInput > 0) {
        const unrecovered = Math.min(Math.max(0, qtyInput), line.unreconciledQty);
        const recovered = line.unreconciledQty - unrecovered;
        await tx.orderCreditLine.update({
          where: { id: line.id },
          data: {
            unreconciledQty: unrecovered,
            reconciledQty: line.reconciledQty + recovered,
            badDebtRecoveredQty: recovered,
          },
        });
        if (recovered > 0) {
          const inv = await tx.customerInventory.findUnique({
            where: {
              customerId_productSpecId: {
                customerId: line.customerId,
                productSpecId: line.productSpecId,
              },
            },
          });
          if (inv && recovered <= inv.unreconciledQty) {
            await tx.customerInventory.update({
              where: { id: inv.id },
              data: {
                unreconciledQty: inv.unreconciledQty - recovered,
                reconciledQty: inv.reconciledQty + recovered,
              },
            });
          }
        }
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        creditStatus: "BAD_DEBT",
        badDebtAmount: data.badDebtAmount,
        badDebtGoodsRecovered: data.goodsRecovered,
        badDebtNotes: data.notes,
      },
    });

    await tx.creditReconciliationRecord.create({
      data: {
        orderId,
        customerId: order.customerId,
        userId,
        userName,
        action: "BAD_DEBT",
        paidAmount: order.paidAmount,
        paymentStatus: order.paymentStatus,
        detail: JSON.stringify(data),
        reviewStatus: "APPROVED",
      },
    });
  });
}

type ReconciliationPaymentInput = {
  paymentStatus: PaymentStatus;
  paidAmount: number;
  paidAt?: string;
};

type ReconciliationApplyOptions = {
  existingRecordId?: string;
  reviewerId?: string;
  reviewerName?: string;
};

function parseReconcileItemsFromRecordDetail(
  detail: string | null | undefined
): ReconcileItemInput[] {
  if (!detail) return [];
  try {
    const parsed = JSON.parse(detail) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (i): i is ReconcileItemInput =>
          typeof i === "object" &&
          i !== null &&
          typeof (i as ReconcileItemInput).orderItemId === "string" &&
          typeof (i as ReconcileItemInput).quantity === "number"
      )
      .filter((i) => i.quantity > 0);
  } catch {
    return [];
  }
}

async function loadOrderForReconciliation(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      creditLines: { select: { unreconciledQty: true } },
    },
  });
  if (!order) throw new Error("订单不存在");
  if (order.deletedAt) throw new Error("订单已删除");
  return order;
}

function computeReconciliationPlan(
  order: Awaited<ReturnType<typeof loadOrderForReconciliation>>,
  payment: ReconciliationPaymentInput,
  reconcileItems: ReconcileItemInput[]
) {
  const synced = syncPaymentFields(
    payment.paymentStatus,
    payment.paidAmount,
    order.totalAmount
  );

  if (
    reconcileItems.length > 0 &&
    (synced.paymentStatus === "UNPAID" || synced.paidAmount <= 0)
  ) {
    throw new Error("未付款时不可核销产品数量");
  }

  const needsReconcile = requiresPaymentReconciliation(order, synced.paymentStatus);

  if (needsReconcile) {
    if (reconcileItems.length === 0) {
      throw new Error(
        synced.paymentStatus === "PAID"
          ? "账期订单结清需填写核销产品及数量"
          : "部分付款需填写核销产品及数量"
      );
    }
  }

  const paidAt = payment.paidAt ? new Date(payment.paidAt) : synced.paidAt;
  const shippingFee = order.shippingFee ?? 0;
  const otherFee = order.otherFee ?? 0;
  const feeTotal = shippingFee + otherFee;
  const productsAllReconciled =
    order.creditLines.length > 0 &&
    order.creditLines.every((l) => l.unreconciledQty <= 0);
  const maxProductPerf =
    order.productAmount > 0
      ? order.productAmount
      : calcPerformanceAmount(order.totalAmount, shippingFee, otherFee);

  let performanceAmount = 0;
  if (needsReconcile && reconcileItems.length > 0) {
    performanceAmount = calcReconcilePerformanceAmount(order.items, reconcileItems);
  } else if (
    productsAllReconciled &&
    synced.paidAmount > order.paidAmount &&
    synced.paymentStatus !== "UNPAID"
  ) {
    const increment = synced.paidAmount - order.paidAmount;
    performanceAmount = Math.round(Math.min(increment, feeTotal) * 100) / 100;
  } else if (synced.paymentStatus === "PAID" && synced.paidAmount > 0) {
    performanceAmount = maxProductPerf;
  } else if (synced.paymentStatus === "PARTIAL" && synced.paidAmount > 0) {
    const ratio =
      order.totalAmount > 0
        ? Math.min(1, synced.paidAmount / order.totalAmount)
        : 0;
    performanceAmount = maxProductPerf * ratio;
  }

  let creditStatus: CreditOrderStatus | null = order.creditStatus;
  if (synced.paymentStatus === "PAID") {
    creditStatus = "SETTLED";
  } else if (
    (synced.paymentStatus === "PARTIAL" ||
      (synced.paymentStatus === "UNPAID" && order.isShipped)) &&
    !creditStatus
  ) {
    creditStatus = "ACTIVE";
  } else if (synced.paymentStatus === "UNPAID") {
    creditStatus =
      order.creditStatus === "BAD_DEBT"
        ? "BAD_DEBT"
        : order.isShipped
          ? "ACTIVE"
          : null;
  }

  return { synced, needsReconcile, performanceAmount, creditStatus, paidAt };
}

export async function submitReconciliationForReview(
  orderId: string,
  payment: ReconciliationPaymentInput,
  reconcileItems: ReconcileItemInput[],
  userId: string,
  userName: string
) {
  const order = await loadOrderForReconciliation(orderId);
  const plan = computeReconciliationPlan(order, payment, reconcileItems);

  const existingPending = await prisma.creditReconciliationRecord.findFirst({
    where: { orderId, reviewStatus: "PENDING" },
  });
  if (existingPending) {
    throw new Error("该订单已有待审核的核销申请，请等待审核后再提交");
  }

  const record = await prisma.creditReconciliationRecord.create({
    data: {
      orderId,
      customerId: order.customerId,
      userId,
      userName,
      action: "RECONCILE",
      paidAmount: plan.synced.paidAmount,
      paymentStatus: plan.synced.paymentStatus,
      performanceAmount: plan.performanceAmount,
      paidAt: plan.synced.paymentStatus === "UNPAID" ? null : plan.paidAt,
      detail:
        reconcileItems.length > 0
          ? JSON.stringify(reconcileItems)
          : JSON.stringify({ directPayment: true }),
      reviewStatus: "PENDING",
    },
  });

  return { recordId: record.id, plan };
}

export async function approveReconciliationRecord(
  recordId: string,
  reviewerId: string,
  reviewerName: string
) {
  const rec = await prisma.creditReconciliationRecord.findUnique({
    where: { id: recordId },
  });
  if (!rec) throw new Error("核销记录不存在");
  if (rec.reviewStatus !== "PENDING") {
    throw new Error("该核销记录不在待审核状态");
  }

  const reconcileItems = parseReconcileItemsFromRecordDetail(rec.detail);
  return processPaymentWithReconciliation(
    rec.orderId,
    {
      paymentStatus: rec.paymentStatus,
      paidAmount: rec.paidAmount,
      paidAt: rec.paidAt?.toISOString(),
    },
    reconcileItems,
    rec.userId,
    rec.userName,
    {
      existingRecordId: recordId,
      reviewerId,
      reviewerName,
    }
  );
}

export async function rejectReconciliationRecord(
  recordId: string,
  reviewerId: string,
  reviewerName: string,
  rejectReason?: string
) {
  const rec = await prisma.creditReconciliationRecord.findUnique({
    where: { id: recordId },
  });
  if (!rec) throw new Error("核销记录不存在");
  if (rec.reviewStatus !== "PENDING") {
    throw new Error("该核销记录不在待审核状态");
  }

  await prisma.creditReconciliationRecord.update({
    where: { id: recordId },
    data: {
      reviewStatus: "REJECTED",
      reviewedById: reviewerId,
      reviewedByName: reviewerName,
      reviewedAt: new Date(),
      rejectReason: rejectReason?.trim() || null,
    },
  });
}

export async function processPaymentWithReconciliation(
  orderId: string,
  payment: ReconciliationPaymentInput,
  reconcileItems: ReconcileItemInput[],
  userId: string,
  userName: string,
  options?: ReconciliationApplyOptions
) {
  const order = await loadOrderForReconciliation(orderId);
  const plan = computeReconciliationPlan(order, payment, reconcileItems);
  const { synced, needsReconcile, performanceAmount, creditStatus, paidAt } =
    plan;

  if (
    shouldActivateCredit({
      paymentStatus: synced.paymentStatus,
      isShipped: order.isShipped,
      isPaid: synced.isPaid,
      creditStatus: order.creditStatus,
    })
  ) {
    await ensureCreditOrderActive(orderId, {
      paymentStatus: synced.paymentStatus,
      isPaid: synced.isPaid,
    });
  }

  if (needsReconcile && reconcileItems.length > 0) {
    await applyReconciliation(orderId, reconcileItems);
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: synced.paymentStatus,
        paidAmount: synced.paidAmount,
        isPaid: synced.isPaid,
        paidAt: synced.paymentStatus === "UNPAID" ? null : paidAt,
        creditStatus,
      },
    });

    let recId = "";

    if (options?.existingRecordId) {
      await tx.creditReconciliationRecord.update({
        where: { id: options.existingRecordId },
        data: {
          paidAmount: synced.paidAmount,
          paymentStatus: synced.paymentStatus,
          performanceAmount,
          paidAt: synced.paymentStatus === "UNPAID" ? null : paidAt,
          reviewStatus: "APPROVED",
          reviewedById: options.reviewerId,
          reviewedByName: options.reviewerName,
          reviewedAt: new Date(),
          rejectReason: null,
        },
      });
      recId = options.existingRecordId;
    } else if (reconcileItems.length > 0) {
      const rec = await tx.creditReconciliationRecord.create({
        data: {
          orderId,
          customerId: order.customerId,
          userId,
          userName,
          action: "RECONCILE",
          paidAmount: synced.paidAmount,
          paymentStatus: synced.paymentStatus,
          performanceAmount,
          paidAt: synced.paymentStatus === "UNPAID" ? null : paidAt,
          detail: JSON.stringify(reconcileItems),
          reviewStatus: "APPROVED",
        },
      });
      recId = rec.id;
    }

    if (
      recId &&
      performanceAmount > 0 &&
      synced.paymentStatus !== "UNPAID" &&
      paidAt
    ) {
      await recordCollectPerformance(tx, {
        orderId,
        salesId: order.salesId,
        amount: performanceAmount,
        eventAt: paidAt,
        reconciliationRecordId: recId,
        detail:
          reconcileItems.length > 0
            ? JSON.stringify(reconcileItems)
            : JSON.stringify({ directPayment: true }),
      });
    } else if (
      !options?.existingRecordId &&
      performanceAmount > 0 &&
      synced.paymentStatus !== "UNPAID" &&
      paidAt
    ) {
      await recordCollectPerformance(tx, {
        orderId,
        salesId: order.salesId,
        amount: performanceAmount,
        eventAt: paidAt,
        detail: JSON.stringify({ directPayment: true }),
      });
    }
    if (
      (synced.paymentStatus === "PAID" || synced.paymentStatus === "PARTIAL") &&
      synced.paidAmount > 0
    ) {
      await markCustomerClosedOnPayment(order.customerId, tx);
    }
  });

  return synced;
}

export async function getCreditStats(salesId?: string) {
  const orderWhere: Record<string, unknown> = {
    deletedAt: null,
    creditStatus: { in: ["ACTIVE", "BAD_DEBT"] },
  };
  if (salesId) orderWhere.salesId = salesId;

  const inventoryWhere: Record<string, unknown> = {};
  if (salesId) {
    inventoryWhere.customer = { salesId };
  }

  const [inventories, activeCustomers, activeOrders, badDebtOrders, specMap] =
    await Promise.all([
    prisma.customerInventory.findMany({
      where: inventoryWhere,
      select: {
        unreconciledQty: true,
        productSpecId: true,
        specName: true,
        unitType: true,
      },
    }),
    prisma.order.findMany({
      where: { ...orderWhere, creditStatus: "ACTIVE" },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
    prisma.order.findMany({
      where: { ...orderWhere, creditStatus: "ACTIVE" },
      select: { totalAmount: true, paidAmount: true },
    }),
    prisma.order.findMany({
      where: { ...orderWhere, creditStatus: "BAD_DEBT" },
      include: {
        creditLines: true,
      },
    }),
    prisma.productSpec.findMany({
      select: { id: true, name: true, unitType: true, bottlesPerUnit: true },
    }).then((specs) => new Map(specs.map((s) => [s.id, s]))),
  ]);

  const specBottles = (specId: string, specName: string, unitType: SpecUnit) => {
    const spec = specMap.get(specId);
    return resolveBottlesPerUnit(
      spec?.name ?? specName,
      spec?.unitType ?? unitType,
      spec?.bottlesPerUnit
    );
  };

  const totalUnreconciled = inventories.reduce(
    (s, i) =>
      s +
      toBottleCount(
        i.unreconciledQty,
        specBottles(i.productSpecId, i.specName, i.unitType)
      ),
    0
  );
  const totalUnreconciledAmount = activeOrders.reduce(
    (s, o) => s + Math.max(0, o.totalAmount - o.paidAmount),
    0
  );

  let badDebtRecoveredQty = 0;
  let badDebtUnrecoveredQty = 0;
  let badDebtAmount = 0;
  for (const o of badDebtOrders) {
    badDebtAmount += o.badDebtAmount ?? 0;
    for (const line of o.creditLines) {
      badDebtRecoveredQty += toBottleCount(
        line.badDebtRecoveredQty,
        specBottles(line.productSpecId, line.specName, line.unitType)
      );
      badDebtUnrecoveredQty += toBottleCount(
        line.unreconciledQty,
        specBottles(line.productSpecId, line.specName, line.unitType)
      );
    }
  }

  return {
    totalUnreconciled,
    totalUnreconciledAmount,
    creditCustomerCount: activeCustomers.length,
    badDebtOrderCount: badDebtOrders.length,
    badDebtAmount,
    badDebtRecoveredQty,
    badDebtUnrecoveredQty,
  };
}
