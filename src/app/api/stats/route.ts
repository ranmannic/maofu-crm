import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  calcOrderProfit,
  calcPerformanceAmount,
  getDateRange,
  type Period,
} from "@/lib/utils";
import { handleApiError } from "@/lib/api";

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

    const orderWhere: Record<string, unknown> = {
      orderedAt: { gte: start, lte: end },
      deletedAt: null,
    };
    const customerWhere: Record<string, unknown> = {
      createdAt: { gte: start, lte: end },
    };

    if (session.role === "SALES") {
      orderWhere.salesId = session.id;
      customerWhere.salesId = session.id;
    } else if (salesIdFilter) {
      orderWhere.salesId = salesIdFilter;
      customerWhere.salesId = salesIdFilter;
    }

    const channelInclude = {
      select: {
        name: true,
        parentId: true,
        parent: { select: { id: true, name: true } },
      },
    };

    const [orders, customers, salesUsers, allOrdersForCurves, allCustomersForCurves, topCategories] =
      await Promise.all([
        prisma.order.findMany({
          where: orderWhere,
          include: {
            items: true,
            customer: { select: { channel: channelInclude } },
            sales: { select: { id: true, name: true } },
          },
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
        prisma.order.findMany({
          where: buildCurveOrderWhere(session, salesIdFilter),
          select: {
            orderedAt: true,
            totalAmount: true,
            shippingFee: true,
            otherFee: true,
            salesId: true,
            deletedAt: true,
          },
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
      ]);

    function getPerformance(o: {
      totalAmount: number;
      shippingFee?: number;
      otherFee?: number;
    }) {
      return calcPerformanceAmount(
        o.totalAmount,
        o.shippingFee ?? 0,
        o.otherFee ?? 0
      );
    }

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + getPerformance(o), 0);
    const totalPaid = orders.reduce((s, o) => s + o.paidAmount, 0);
    const totalProfit = isAdmin
      ? orders.reduce(
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

    const channelMap = new Map<string, number>();
    for (const c of customers) {
      const ch = c.channel?.name || "未分类";
      channelMap.set(ch, (channelMap.get(ch) || 0) + 1);
    }

    const orderChannelMap = new Map<
      string,
      { count: number; amount: number }
    >();
    for (const o of orders) {
      const ch = o.customer.channel?.name || "未分类";
      const cur = orderChannelMap.get(ch) || { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += getPerformance(o);
      orderChannelMap.set(ch, cur);
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

          const categoryOrders = orders.filter((o) => {
            const name = o.customer.channel?.name;
            return name && childNames.has(name);
          });

          const totalAmount = categoryOrders.reduce(
            (s, o) => s + getPerformance(o),
            0
          );

          return {
            categoryId: category.id,
            categoryName: category.name,
            totalAmount,
            orderCount: categoryOrders.length,
            channels: childStats.filter(
              (c) => c.orderCount > 0 || c.amount > 0
            ),
          };
        })
      : undefined;

    const salesStats = isAdmin
      ? salesUsers.map((sales) => {
          const salesOrders = orders.filter((o) => o.salesId === sales.id);
          return {
            salesId: sales.id,
            salesName: sales.name,
            orderCount: salesOrders.length,
            totalAmount: salesOrders.reduce((s, o) => s + getPerformance(o), 0),
            paidAmount: salesOrders.reduce((s, o) => s + o.paidAmount, 0),
            profit: salesOrders.reduce(
              (s, o) =>
                s +
                calcOrderProfit(
                  o.totalAmount,
                  o.productCostTotal,
                  o.shippingFee ?? 0,
                  o.otherFee ?? 0
                ),
              0
            ),
          };
        })
      : undefined;

    const year = new Date().getFullYear();
    const monthlyCurves = {
      performance: buildMonthlyYoY(
        allOrdersForCurves.map((o) => ({
          date: o.orderedAt,
          value: getPerformance(o),
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
        paidAmount: totalPaid,
        unpaidAmount: totalRevenue - totalPaid,
        shippedCount: orders.filter((o) => o.isShipped).length,
        unshippedCount: orders.filter((o) => !o.isShipped).length,
        totalProfit,
      },
      salesStats,
      monthlyCurves,
      salesUsers: isAdmin ? salesUsers : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function buildCurveOrderWhere(
  session: { role: string; id: string },
  salesIdFilter?: string
) {
  const where: Record<string, unknown> = { deletedAt: null };
  if (session.role === "SALES") where.salesId = session.id;
  else if (salesIdFilter) where.salesId = salesIdFilter;
  return where;
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
