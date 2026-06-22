import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  calcOrderProfit,
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

    const [orders, customers, salesUsers, allOrdersForCurves, allCustomersForCurves] =
      await Promise.all([
        prisma.order.findMany({
          where: orderWhere,
          include: {
            items: true,
            customer: { select: { channel: { select: { name: true } } } },
            sales: { select: { id: true, name: true } },
          },
        }),
        prisma.customer.findMany({
          where: customerWhere,
          include: { channel: { select: { name: true } } },
        }),
        isAdmin
          ? prisma.user.findMany({
              where: { role: "SALES" },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        prisma.order.findMany({
          where: buildCurveOrderWhere(session, salesIdFilter),
          select: { orderedAt: true, totalAmount: true, salesId: true },
        }),
        prisma.customer.findMany({
          where: buildCurveCustomerWhere(session, salesIdFilter),
          select: {
            createdAt: true,
            deletedAt: true,
            salesId: true,
          },
        }),
      ]);

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalPaid = orders.reduce((s, o) => s + o.paidAmount, 0);
    const totalProfit = isAdmin
      ? orders.reduce(
          (s, o) => s + calcOrderProfit(o.totalAmount, o.productCostTotal),
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
      cur.amount += o.totalAmount;
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

    const salesStats = isAdmin
      ? salesUsers.map((sales) => {
          const salesOrders = orders.filter((o) => o.salesId === sales.id);
          return {
            salesId: sales.id,
            salesName: sales.name,
            orderCount: salesOrders.length,
            totalAmount: salesOrders.reduce((s, o) => s + o.totalAmount, 0),
            paidAmount: salesOrders.reduce((s, o) => s + o.paidAmount, 0),
            profit: salesOrders.reduce(
              (s, o) =>
                s + calcOrderProfit(o.totalAmount, o.productCostTotal),
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
          value: o.totalAmount,
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
  const where: Record<string, unknown> = {};
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
