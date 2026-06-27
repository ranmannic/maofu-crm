import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  calcOrderProfit,
  getDateRange,
  type Period,
} from "@/lib/utils";
import { handleApiError } from "@/lib/api";
import {
  calcProratedFixedCost,
  describeFixedCostPeriod,
} from "@/lib/fixed-cost";
import { getEditionState } from "@/lib/edition";
import {
  calcRefundPerformanceAmount,
  syncPerformanceData,
} from "@/lib/performance";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(["ADMIN", "SALES"]);
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as Period;
    const customStart = searchParams.get("start") || undefined;
    const customEnd = searchParams.get("end") || undefined;
    const salesIdFilter = searchParams.get("salesId") || undefined;

    const { start, end } = getDateRange(period, customStart, customEnd);
    const isAdmin = session.role === "ADMIN";

    const salesScope =
      session.role === "SALES"
        ? session.id
        : salesIdFilter || undefined;

    try {
      await syncPerformanceData(salesScope);
    } catch (error) {
      console.error("[stats] syncPerformanceData", error);
    }

    const customerWhere: Record<string, unknown> = {
      createdAt: { gte: start, lte: end },
    };
    if (salesScope) customerWhere.salesId = salesScope;

    const perfWhere: Record<string, unknown> = {
      type: "COLLECT",
      eventAt: { gte: start, lte: end },
      order: { deletedAt: null },
    };
    if (salesScope) perfWhere.salesId = salesScope;

    const refundOrderWhere: Record<string, unknown> = {
      deletedAt: null,
      refundAmount: { gt: 0 },
      refundedAt: { gte: start, lte: end },
    };
    if (salesScope) refundOrderWhere.salesId = salesScope;

    const channelInclude = {
      select: {
        name: true,
        parentId: true,
        parent: { select: { id: true, name: true } },
      },
    };

    const [
      collectRecords,
      refundOrders,
      customers,
      salesUsers,
      allCollectForCurves,
      allCustomersForCurves,
      topCategories,
      periodOrdersForShip,
      periodOrdersForStats,
    ] = await Promise.all([
      prisma.performanceRecord.findMany({
        where: perfWhere,
        include: {
          order: {
            include: {
              customer: { select: { channel: channelInclude } },
              sales: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.order.findMany({
        where: refundOrderWhere,
        include: {
          sales: { select: { id: true, name: true } },
        },
        orderBy: { refundedAt: "desc" },
      }),
      prisma.customer.findMany({
        where: customerWhere,
        include: { channel: channelInclude },
      }),
      isAdmin
        ? prisma.user.findMany({
            where: { role: "SALES" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      prisma.performanceRecord.findMany({
        where: {
          type: "COLLECT",
          ...(salesScope ? { salesId: salesScope } : {}),
          order: { deletedAt: null },
        },
        select: { eventAt: true, amount: true, salesId: true },
      }),
      prisma.customer.findMany({
        where: buildCurveCustomerWhere(session, salesIdFilter),
        select: {
          createdAt: true,
          deletedAt: true,
          salesId: true,
        },
      }),
      isAdmin
        ? prisma.channelType.findMany({
            where: { parentId: null },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              children: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
            },
          })
        : Promise.resolve([]),
      prisma.order.findMany({
        where: {
          deletedAt: null,
          orderedAt: { gte: start, lte: end },
          ...(salesScope ? { salesId: salesScope } : {}),
        },
        select: { isShipped: true, productCostTotal: true, totalAmount: true, shippingFee: true, otherFee: true },
      }),
      prisma.order.findMany({
        where: {
          deletedAt: null,
          orderedAt: { gte: start, lte: end },
          ...(salesScope ? { salesId: salesScope } : {}),
        },
        select: {
          id: true,
          salesId: true,
          orderNo: true,
          customerName: true,
          productAmount: true,
          sales: { select: { name: true } },
          performanceRecords: {
            where: { type: "COLLECT" },
            select: { amount: true, eventAt: true },
          },
        },
      }),
    ]);

    const periodPerf = summarizePeriodPerformance(periodOrdersForStats);
    const totalOrders = periodOrdersForStats.length;
    const totalRevenue = periodPerf.total;
    const paidPerformance = periodPerf.collected;
    const unpaidPerformance = periodPerf.uncollected;

    const refundPerformanceOrders = refundOrders.map((o) => {
      const perfAmount = calcRefundPerformanceAmount({
        totalAmount: o.totalAmount,
        productAmount: o.productAmount,
        shippingFee: o.shippingFee,
        otherFee: o.otherFee,
        refundAmount: o.refundAmount,
      });
      return {
        id: o.id,
        orderNo: o.orderNo,
        customerName: o.customerName,
        refundAmount: o.refundAmount,
        refundPerformanceAmount: perfAmount,
        refundedAt: o.refundedAt,
        refundStatus: o.refundStatus,
        salesName: o.sales.name,
      };
    });
    const totalRefundPerformance = refundPerformanceOrders.reduce(
      (s, o) => s + o.refundPerformanceAmount,
      0
    );

    const totalProfit = isAdmin
      ? periodOrdersForShip.reduce(
          (s, o) =>
            s +
            calcOrderProfit(
              o.totalAmount,
              o.productCostTotal,
              o.shippingFee ?? 0,
              o.otherFee ?? 0
            ),
          0
        )
      : undefined;

    const totalProfitRevenue = isAdmin
      ? periodOrdersForShip.reduce(
          (s, o) =>
            s +
            Math.max(
              0,
              o.totalAmount - (o.shippingFee ?? 0) - (o.otherFee ?? 0)
            ),
          0
        )
      : undefined;

    const grossProfitMargin =
      isAdmin && totalProfit !== undefined && totalProfitRevenue && totalProfitRevenue > 0
        ? Math.round((totalProfit / totalProfitRevenue) * 1000) / 10
        : null;

    const channelMap = new Map<string, number>();
    for (const c of customers) {
      const ch = c.channel?.name || "未分类";
      channelMap.set(ch, (channelMap.get(ch) || 0) + 1);
    }

    const orderChannelAmount = new Map<string, number>();
    const orderChannelIds = new Map<string, Set<string>>();
    for (const r of collectRecords) {
      const ch = r.order.customer.channel?.name || "未分类";
      orderChannelAmount.set(ch, (orderChannelAmount.get(ch) || 0) + (Number(r.amount) || 0));
      if (!orderChannelIds.has(ch)) orderChannelIds.set(ch, new Set());
      orderChannelIds.get(ch)!.add(r.orderId);
    }

    const orderChannelMap = new Map<
      string,
      { count: number; amount: number }
    >();
    for (const [ch, ids] of orderChannelIds) {
      orderChannelMap.set(ch, {
        count: ids.size,
        amount: orderChannelAmount.get(ch) ?? 0,
      });
    }

    const allChannels = new Set([
      ...channelMap.keys(),
      ...orderChannelMap.keys(),
    ]);

    const channelStats = Array.from(allChannels).map((channel) => {
      const orderData = orderChannelMap.get(channel) || { count: 0, amount: 0 };
      return {
        channel,
        orderCount: orderData.count,
        amount: orderData.amount,
        customerCount: channelMap.get(channel) || 0,
      };
    });

    const categoryPerformanceStats = isAdmin
      ? topCategories.map((category) => {
          const childNames = new Set(category.children.map((c) => c.name));
          const childStats = category.children.map((child) => {
            const orderData = orderChannelMap.get(child.name) || {
              count: 0,
              amount: 0,
            };
            return {
              channel: child.name,
              orderCount: orderData.count,
              amount: orderData.amount,
            };
          });

          const categoryAmount = collectRecords
            .filter((r) => {
              const name = r.order.customer.channel?.name;
              return name && childNames.has(name);
            })
            .reduce((s, r) => s + (Number(r.amount) || 0), 0);

          const categoryOrderIds = new Set(
            collectRecords
              .filter((r) => {
                const name = r.order.customer.channel?.name;
                return name && childNames.has(name);
              })
              .map((r) => r.orderId)
          );

          return {
            categoryId: category.id,
            categoryName: category.name,
            totalAmount: categoryAmount,
            orderCount: categoryOrderIds.size,
            channels: childStats.filter(
              (c) => c.orderCount > 0 || c.amount > 0
            ),
          };
        })
      : undefined;

    const salesStats = isAdmin
      ? salesUsers.map((sales) => {
          const salesOrders = periodOrdersForStats.filter(
            (o) => o.salesId === sales.id
          );
          const salesPerf = summarizePeriodPerformance(salesOrders);
          const salesOrderIds = new Set(salesOrders.map((o) => o.id));
          const salesRefund = refundPerformanceOrders.filter(
            (o) =>
              refundOrders.find((ro) => ro.id === o.id)?.salesId === sales.id
          );
          return {
            salesId: sales.id,
            salesName: sales.name,
            orderCount: salesOrderIds.size,
            totalAmount: salesPerf.total,
            paidAmount: salesPerf.collected,
            refundAmount: salesRefund.reduce(
              (s, o) => s + o.refundPerformanceAmount,
              0
            ),
            profit: 0,
          };
        })
      : undefined;

    if (isAdmin && salesStats) {
      const profitOrders = await prisma.order.findMany({
        where: {
          deletedAt: null,
          orderedAt: { gte: start, lte: end },
        },
        select: {
          salesId: true,
          totalAmount: true,
          productCostTotal: true,
          shippingFee: true,
          otherFee: true,
        },
      });
      for (const row of salesStats) {
        row.profit = profitOrders
          .filter((o) => o.salesId === row.salesId)
          .reduce(
            (s, o) =>
              s +
              calcOrderProfit(
                o.totalAmount,
                o.productCostTotal,
                o.shippingFee ?? 0,
                o.otherFee ?? 0
              ),
            0
          );
      }
    }

    const year = new Date().getFullYear();
    const performanceDetails = buildPerformanceDetails(
      periodOrdersForStats,
      collectRecords,
      isAdmin
    );

    let fixedCostStats:
      | {
          monthlyFixedCost: number;
          proratedFixedCost: number;
          netProfitAfterFixedCost: number;
          coversFixedCost: boolean;
          periodLabel: string;
        }
      | undefined;

    if (isAdmin) {
      const edition = await getEditionState();
      if (edition.edition === "PREMIUM" && edition.premiumAccess) {
        const settings = await prisma.appSetting.findUnique({
          where: { id: "global" },
          select: { monthlyFixedCost: true },
        });
        const monthlyFixedCost = settings?.monthlyFixedCost ?? 0;
        const proratedFixedCost = calcProratedFixedCost(
          monthlyFixedCost,
          start,
          end
        );
        const grossProfit = totalProfit ?? 0;
        const netProfitAfterFixedCost = grossProfit - proratedFixedCost;
        fixedCostStats = {
          monthlyFixedCost,
          proratedFixedCost,
          netProfitAfterFixedCost,
          coversFixedCost: netProfitAfterFixedCost >= 0,
          periodLabel: describeFixedCostPeriod(start, end),
        };
      }
    }

    const monthlyCurves = {
      performance: buildMonthlyYoY(
        allCollectForCurves.map((r) => ({
          date: r.eventAt,
          value: Number(r.amount) || 0,
        })),
        year
      ),
      newCustomers: buildMonthlyYoY(
        allCustomersForCurves
          .filter((c) => c.createdAt)
          .map((c) => ({ date: c.createdAt, value: 1 })),
        year
      ),
      churnCustomers: buildMonthlyYoY(
        allCustomersForCurves
          .filter((c) => c.deletedAt)
          .map((c) => ({ date: c.deletedAt!, value: 1 })),
        year
      ),
    };

    return NextResponse.json({
      period: { start, end, type: period },
      customerStats: {
        total: customers.length,
        byChannel: Array.from(channelMap.entries()).map(([channel, count]) => ({
          channel,
          count,
        })),
      },
      channelStats,
      categoryPerformanceStats,
      orderStats: {
        total: totalOrders,
        totalAmount: totalRevenue,
        paidAmount: paidPerformance,
        unpaidAmount: unpaidPerformance,
        shippedCount: periodOrdersForShip.filter((o) => o.isShipped).length,
        unshippedCount: periodOrdersForShip.filter((o) => !o.isShipped).length,
        totalProfit,
        grossProfitMargin,
      },
      refundStats: {
        totalAmount: totalRefundPerformance,
        orders: refundPerformanceOrders,
      },
      performanceDetails,
      salesStats,
      monthlyCurves,
      fixedCostStats,
      salesUsers: isAdmin ? salesUsers : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function summarizePeriodPerformance(
  orders: {
    productAmount: number;
    performanceRecords: { amount: number }[];
  }[]
) {
  return orders.reduce(
    (acc, order) => {
      const maxPerf = Number(order.productAmount) || 0;
      const collected = order.performanceRecords.reduce(
        (s, r) => s + (Number(r.amount) || 0),
        0
      );
      const capped = Math.min(collected, maxPerf);
      acc.total += maxPerf;
      acc.collected += capped;
      acc.uncollected += Math.max(0, maxPerf - capped);
      return acc;
    },
    { total: 0, collected: 0, uncollected: 0 }
  );
}

function buildPerformanceDetails(
  periodOrders: {
    id: string;
    orderNo: string;
    customerName: string;
    sales: { name: string };
    productAmount: number;
    performanceRecords: { amount: number; eventAt: Date }[];
  }[],
  collectRecords: {
    id: string;
    orderId: string;
    amount: number;
    eventAt: Date;
    order: {
      orderNo: string;
      customerName: string;
      sales: { name: string };
    };
  }[],
  showSales: boolean
) {
  const events = collectRecords
    .map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNo: r.order.orderNo,
      customerName: r.order.customerName,
      salesName: r.order.sales.name,
      amount: Number(r.amount) || 0,
      eventAt: r.eventAt,
    }))
    .sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime());

  const orders = periodOrders
    .map((order) => {
      const totalPerformance = Number(order.productAmount) || 0;
      const paidPerformance = order.performanceRecords.reduce(
        (sum, record) => sum + (Number(record.amount) || 0),
        0
      );
      const cappedPaidPerformance = Math.min(paidPerformance, totalPerformance);
      const unpaidPerformance = Math.max(0, totalPerformance - cappedPaidPerformance);
      const lastEventAt = order.performanceRecords.reduce<Date | null>(
        (latest, record) =>
          !latest || record.eventAt > latest ? record.eventAt : latest,
        null
      );

      return {
        id: order.id,
        orderNo: order.orderNo,
        customerName: order.customerName,
        salesName: order.sales.name,
        totalPerformance,
        paidPerformance: cappedPaidPerformance,
        unpaidPerformance,
        eventCount: order.performanceRecords.length,
        lastEventAt: lastEventAt?.toISOString() ?? null,
      };
    })
    .sort((a, b) => {
      const aTime = a.lastEventAt ? new Date(a.lastEventAt).getTime() : 0;
      const bTime = b.lastEventAt ? new Date(b.lastEventAt).getTime() : 0;
      return bTime - aTime;
    });

  const unpaidOrders = orders.filter((order) => order.unpaidPerformance > 0);
  const paidOrders = orders.filter((order) => order.paidPerformance > 0);

  return {
    orders,
    paidOrders,
    unpaidOrders,
    events: events.map((e) => ({
      ...e,
      eventAt: e.eventAt.toISOString(),
    })),
    showSales,
  };
}

function buildCurveCustomerWhere(
  session: { role: string; id: string },
  salesIdFilter?: string
) {
  const where: Record<string, unknown> = {};
  if (session.role === "SALES") where.salesId = session.id;
  else if (salesIdFilter) where.salesId = salesIdFilter;
  return where;
}

function buildMonthlyYoY(
  records: { date: Date; value: number }[],
  currentYear: number
) {
  const lastYear = currentYear - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const label = `${month}月`;
    const current = records
      .filter(
        (r) =>
          r.date.getFullYear() === currentYear &&
          r.date.getMonth() + 1 === month
      )
      .reduce((s, r) => s + r.value, 0);
    const previous = records
      .filter(
        (r) =>
          r.date.getFullYear() === lastYear && r.date.getMonth() + 1 === month
      )
      .reduce((s, r) => s + r.value, 0);
    return { month: label, currentYear: current, lastYear: previous };
  });
}
