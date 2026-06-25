import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { serializeCustomer } from "@/lib/serializers";
import { PAID_ORDER_FILTER } from "@/lib/customer-status";
import {
  getChurnLevel,
  getCustomerSegment,
  getReminderStatus,
  getBirthdayReminderStatus,
  formatSinceLastOrder,
  formatBirthdayDisplay,
  canAbandonCustomer,
} from "@/lib/follow-up";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(["ADMIN", "SALES", "OPERATIONS"]);
    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: { select: { id: true, name: true } },
        channel: {
          select: {
            id: true,
            name: true,
            parent: { select: { id: true, name: true } },
          },
        },
        followUpRecords: { orderBy: { followedAt: "desc" }, take: 50 },
        orders: {
          where: { deletedAt: null },
          orderBy: { orderedAt: "desc" },
          take: 30,
          select: {
            id: true,
            orderNo: true,
            totalAmount: true,
            paymentStatus: true,
            isPaid: true,
            isShipped: true,
            orderedAt: true,
          },
        },
        shippingAddresses: { orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] },
        _count: {
          select: {
            orders: { where: PAID_ORDER_FILTER },
            followUpRecords: true,
          },
        },
      },
    });

    if (!customer || customer.deletedAt) return apiError("客户不存在", 404);
    if (session.role === "SALES" && customer.salesId !== session.id) {
      return apiError("无权限", 403);
    }

    const paidOrders = await prisma.order.findMany({
      where: { customerId: id, ...PAID_ORDER_FILTER, deletedAt: null },
      select: { orderedAt: true },
      orderBy: { orderedAt: "desc" },
      take: 1,
    });
    const lastOrderAt = paidOrders[0]?.orderedAt ?? null;
    const segment = getCustomerSegment(customer.customerStatus, lastOrderAt);
    const latestFollowUp = customer.followUpRecords[0] ?? null;
    const serialized = serializeCustomer(customer, session);

    const profile = {
      id: customer.id,
      name: customer.name,
      phone: serialized.phone,
      channelName: serialized.channelName,
      channelParentName: customer.channel?.parent?.name ?? null,
      address: customer.address,
      followUpNotes: customer.followUpNotes,
      birthday: customer.birthday,
      birthdayDisplay: formatBirthdayDisplay(customer.birthday),
      birthdayReminderStatus: getBirthdayReminderStatus(customer.birthday),
      sales: customer.sales,
      customerStatus: customer.customerStatus,
      followUpStatus: customer.followUpStatus,
      abandonedAt: customer.abandonedAt,
      abandonReason: customer.abandonReason,
      paidOrderCount: customer._count.orders,
      followUpCount: customer._count.followUpRecords,
      lastOrderAt,
      sinceLastOrder: formatSinceLastOrder(lastOrderAt),
      segment,
      churnLevel:
        customer.customerStatus === "CLOSED" && lastOrderAt
          ? getChurnLevel(lastOrderAt)
          : null,
      reminderStatus: getReminderStatus(latestFollowUp?.nextFollowUpAt),
      canAbandon:
        customer.followUpStatus === "ACTIVE" && canAbandonCustomer(segment),
      shippingAddressCount: customer.shippingAddresses.length,
    };

    type TimelineItem = {
      id: string;
      type: "order" | "follow_up";
      at: string;
      title: string;
      summary: string;
      href?: string;
    };

    const timeline: TimelineItem[] = [];

    for (const o of customer.orders) {
      const pay =
        o.paymentStatus === "PAID" || o.isPaid
          ? "已收款"
          : o.paymentStatus === "PARTIAL"
            ? "部分收款"
            : "未收款";
      timeline.push({
        id: o.id,
        type: "order",
        at: o.orderedAt.toISOString(),
        title: `订单 ${o.orderNo}`,
        summary: `${formatCurrency(o.totalAmount)} · ${pay} · ${o.isShipped ? "已发货" : "未发货"}`,
        href: `/orders?highlight=${o.id}`,
      });
    }

    for (const r of customer.followUpRecords) {
      timeline.push({
        id: r.id,
        type: "follow_up",
        at: r.followedAt.toISOString(),
        title: "客户跟进",
        summary: r.content.slice(0, 120) + (r.content.length > 120 ? "…" : ""),
      });
    }

    timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return NextResponse.json({
      profile,
      timeline: timeline.slice(0, 60),
      recentFollowUps: customer.followUpRecords.slice(0, 5).map((r) => ({
        id: r.id,
        followedAt: formatDate(r.followedAt),
        content: r.content,
        nextPlan: r.nextPlan,
        nextFollowUpAt: r.nextFollowUpAt ? formatDate(r.nextFollowUpAt) : null,
        userName: r.userName,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
