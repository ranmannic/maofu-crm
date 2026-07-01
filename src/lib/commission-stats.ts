import { prisma } from "@/lib/prisma";
import {
  calcCommissionAmount,
  findBestCommissionRule,
  monthRange,
  type CommissionRuleRecord,
} from "@/lib/sales-commission";
import { parseReconcileItemsFromDetail } from "@/lib/performance";

const PAGE_SIZE = 20;

type OrderItemRow = {
  id: string;
  productId: string;
  productSpecId: string;
  unitPrice: number;
  quantity: number;
};

type CommissionBaseItem = {
  productId: string;
  productSpecId: string;
  unitPrice: number;
  quantity: number;
};

async function fetchCommissionRules(): Promise<CommissionRuleRecord[]> {
  const rules = await prisma.salesCommissionRule.findMany({
    include: { salesTargets: { select: { salesId: true } } },
  });
  return rules.map((r) => ({
    id: r.id,
    productId: r.productId,
    productSpecId: r.productSpecId,
    appliesToAllSales: r.appliesToAllSales,
    kind: r.kind,
    value: r.value,
    salesTargetIds: r.salesTargets.map((t) => t.salesId),
  }));
}

/**
 * 将一条业绩事件（收款/退款）拆解为「计提成的产品明细」。
 * 优先使用核销明细（detail 中的 orderItemId + quantity）；
 * 否则按当前订单产品金额占比，将业绩金额分摊到各产品行。
 */
function resolveBaseItems(
  orderItems: OrderItemRow[] | undefined,
  detail: string | null,
  performanceAmount: number
): CommissionBaseItem[] {
  if (!orderItems || orderItems.length === 0 || performanceAmount <= 0) {
    return [];
  }

  const reconcileItems = parseReconcileItemsFromDetail(detail);
  if (reconcileItems.length > 0) {
    const byId = new Map(orderItems.map((i) => [i.id, i]));
    return reconcileItems
      .map((r) => {
        const item = byId.get(r.orderItemId);
        if (!item || r.quantity <= 0) return null;
        return {
          productId: item.productId,
          productSpecId: item.productSpecId,
          unitPrice: item.unitPrice,
          quantity: r.quantity,
        };
      })
      .filter(Boolean) as CommissionBaseItem[];
  }

  // 无核销明细（直接收款 / 历史数据 / 退款）：按产品金额占比分摊
  const productTotal = orderItems.reduce(
    (s, i) => s + i.unitPrice * i.quantity,
    0
  );
  if (productTotal <= 0) return [];

  return orderItems
    .map((item) => {
      const ratio = (item.unitPrice * item.quantity) / productTotal;
      const allocated = performanceAmount * ratio;
      const qty = item.unitPrice > 0 ? allocated / item.unitPrice : 0;
      return {
        productId: item.productId,
        productSpecId: item.productSpecId,
        unitPrice: item.unitPrice,
        quantity: qty,
      };
    })
    .filter((i) => i.quantity > 0);
}

function commissionForEvent(
  rules: CommissionRuleRecord[],
  salesId: string,
  items: CommissionBaseItem[]
): number {
  let total = 0;
  for (const item of items) {
    const rule = findBestCommissionRule(rules, {
      productId: item.productId,
      productSpecId: item.productSpecId,
      salesId,
    });
    if (!rule) continue;
    const lineAmount = item.unitPrice * item.quantity;
    total += calcCommissionAmount(
      rule.kind,
      rule.value,
      lineAmount,
      item.quantity
    );
  }
  return total;
}

export interface SalesCommissionStatRow {
  salesId: string;
  salesName: string;
  paidPerformance: number;
  commission: number;
  reversalCommission: number;
  netCommission: number;
}

export async function computeMonthlyCommissionStats(
  month: string,
  page: number
): Promise<{
  month: string;
  data: (SalesCommissionStatRow & { rank: number })[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}> {
  const { start, end } = monthRange(month);

  const [rules, salesUsers, collectRecords, refundRecords] = await Promise.all([
    fetchCommissionRules(),
    prisma.user.findMany({
      where: { role: "SALES" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.performanceRecord.findMany({
      where: {
        type: "COLLECT",
        eventAt: { gte: start, lte: end },
        order: { deletedAt: null },
      },
      select: {
        orderId: true,
        salesId: true,
        amount: true,
        detail: true,
      },
    }),
    prisma.performanceRecord.findMany({
      where: {
        type: "REFUND",
        eventAt: { gte: start, lte: end },
        order: { deletedAt: null },
      },
      select: {
        orderId: true,
        salesId: true,
        amount: true,
        detail: true,
      },
    }),
  ]);

  // 涉及到的订单 id（一次性批量取产品明细，避免每条业绩记录重复 include）
  const orderIds = [
    ...new Set([
      ...collectRecords.map((r) => r.orderId),
      ...refundRecords.map((r) => r.orderId),
    ]),
  ];

  const orderItemsMap = new Map<string, OrderItemRow[]>();
  if (orderIds.length > 0) {
    const items = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds }, isGift: false },
      select: {
        orderId: true,
        id: true,
        productId: true,
        productSpecId: true,
        unitPrice: true,
        quantity: true,
      },
    });
    for (const it of items) {
      const list = orderItemsMap.get(it.orderId) ?? [];
      list.push({
        id: it.id,
        productId: it.productId,
        productSpecId: it.productSpecId,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
      });
      orderItemsMap.set(it.orderId, list);
    }
  }

  const collectedThisMonthOrderIds = new Set(
    collectRecords.map((r) => r.orderId)
  );

  // 跨月退款：本月有退款、但收款发生在本月之前 → 需红冲
  const priorCollectOrderIds = new Set<string>();
  if (refundRecords.length > 0) {
    const prior = await prisma.performanceRecord.findMany({
      where: {
        orderId: { in: refundRecords.map((r) => r.orderId) },
        type: "COLLECT",
        eventAt: { lt: start },
      },
      select: { orderId: true },
    });
    for (const p of prior) priorCollectOrderIds.add(p.orderId);
  }

  const statsMap = new Map<string, SalesCommissionStatRow>();
  for (const sales of salesUsers) {
    statsMap.set(sales.id, {
      salesId: sales.id,
      salesName: sales.name,
      paidPerformance: 0,
      commission: 0,
      reversalCommission: 0,
      netCommission: 0,
    });
  }

  // 收款：累计业绩与提成（全额计入，退款在下方处理）
  for (const rec of collectRecords) {
    const row = statsMap.get(rec.salesId);
    if (!row) continue;
    const amount = Number(rec.amount) || 0;
    if (amount <= 0) continue;

    row.paidPerformance += amount;

    const items = resolveBaseItems(
      orderItemsMap.get(rec.orderId),
      rec.detail,
      amount
    );
    row.commission += commissionForEvent(rules, rec.salesId, items);
  }

  // 退款：
  //  - 当月退款（收款也在当月）→ 抵减业绩，并直接扣减当月提成（即「当月退款不计提成」）
  //  - 跨月退款（收款在更早月份）→ 计入「需红冲提成」
  for (const rec of refundRecords) {
    const row = statsMap.get(rec.salesId);
    if (!row) continue;
    const amount = Number(rec.amount) || 0;
    if (amount <= 0) continue;

    const items = resolveBaseItems(
      orderItemsMap.get(rec.orderId),
      rec.detail,
      amount
    );
    const refundCommission = commissionForEvent(rules, rec.salesId, items);

    if (collectedThisMonthOrderIds.has(rec.orderId)) {
      row.paidPerformance -= amount;
      row.commission -= refundCommission;
    } else if (priorCollectOrderIds.has(rec.orderId)) {
      row.reversalCommission += refundCommission;
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const allRows = [...statsMap.values()]
    .map((r) => {
      const paidPerformance = round2(Math.max(0, r.paidPerformance));
      const commission = round2(Math.max(0, r.commission));
      const reversalCommission = round2(r.reversalCommission);
      return {
        ...r,
        paidPerformance,
        commission,
        reversalCommission,
        netCommission: round2(commission - reversalCommission),
      };
    })
    .filter(
      (r) =>
        r.paidPerformance > 0 ||
        r.commission > 0 ||
        r.reversalCommission > 0
    )
    .sort((a, b) => b.paidPerformance - a.paidPerformance);

  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const data = allRows
    .slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    .map((row, idx) => ({
      ...row,
      rank: (safePage - 1) * PAGE_SIZE + idx + 1,
    }));

  return {
    month,
    data,
    pagination: { page: safePage, pageSize: PAGE_SIZE, total, totalPages },
  };
}
