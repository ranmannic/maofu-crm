import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { serializeCustomer } from "@/lib/serializers";
import { PAID_ORDER_FILTER } from "@/lib/customer-status";
import type { SessionUser } from "@/lib/auth-types";
import {
  getChurnLevel,
  getCustomerSegment,
  getReminderStatus,
  getBirthdayReminderStatus,
  formatSinceLastOrder,
  canAbandonCustomer,
  type CustomerSegment,
  type ReminderStatus,
} from "@/lib/follow-up";

const customerInclude = {
  sales: { select: { id: true, name: true } },
  channel: {
    select: {
      id: true,
      name: true,
      parent: { select: { id: true, name: true } },
    },
  },
  followUpRecords: {
    orderBy: { followedAt: "desc" as const },
    take: 1,
  },
  orders: {
    where: PAID_ORDER_FILTER,
    select: { orderedAt: true },
    orderBy: { orderedAt: "desc" as const },
    take: 1,
  },
  _count: {
    select: {
      orders: { where: PAID_ORDER_FILTER },
      followUpRecords: true,
    },
  },
};

function mapCustomerRow(
  c: Awaited<ReturnType<typeof prisma.customer.findMany>>[number] & {
    sales: { id: string; name: string };
    followUpRecords: {
      id: string;
      followedAt: Date;
      content: string;
      nextPlan: string | null;
      nextFollowUpAt: Date | null;
      userName: string;
    }[];
    orders: { orderedAt: Date }[];
    _count: { orders: number; followUpRecords: number };
  },
  session: SessionUser
) {
  const lastOrderAt = c.orders[0]?.orderedAt ?? null;
  const paidOrderCount = c._count.orders;
  const customerSegment = getCustomerSegment(c.customerStatus, lastOrderAt);
  const churnLevel =
    c.customerStatus === "CLOSED" && lastOrderAt
      ? getChurnLevel(lastOrderAt)
      : null;
  const latest = c.followUpRecords[0] ?? null;
  const reminderStatus = getReminderStatus(latest?.nextFollowUpAt);
  const serialized = serializeCustomer(c, session);

  return {
    id: c.id,
    name: c.name,
    phone: serialized.phone,
    channelName: serialized.channelName,
    sales: c.sales,
    customerStatus: c.customerStatus,
    followUpStatus: c.followUpStatus,
    abandonedAt: c.abandonedAt,
    abandonReason: c.abandonReason,
    paidOrderCount,
    lastOrderAt,
    sinceLastOrder: formatSinceLastOrder(lastOrderAt),
    segment: customerSegment,
    churnLevel,
    reminderStatus,
    birthday: c.birthday,
    birthdayReminderStatus: getBirthdayReminderStatus(c.birthday),
    latestFollowUp: latest
      ? {
          id: latest.id,
          followedAt: latest.followedAt,
          content: latest.content,
          nextPlan: latest.nextPlan,
          nextFollowUpAt: latest.nextFollowUpAt,
          userName: latest.userName,
        }
      : null,
    followUpCount: c._count.followUpRecords,
    canAbandon:
      c.followUpStatus === "ACTIVE" && canAbandonCustomer(customerSegment),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(["ADMIN", "SALES"]);
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = parsePagination(searchParams);
    const q = searchParams.get("q")?.trim();
    const salesIdFilter = searchParams.get("salesId")?.trim();
    const segment = searchParams.get("segment")?.trim() as
      | CustomerSegment
      | "ABANDONED"
      | "REMINDER"
      | "";
    const closedOnly = searchParams.get("closedOnly") === "true";
    const isAdmin = session.role === "ADMIN";

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (session.role === "SALES") {
      where.salesId = session.id;
    } else if (salesIdFilter) {
      where.salesId = salesIdFilter;
    }

    if (segment === "ABANDONED") {
      where.followUpStatus = "ABANDONED";
    } else {
      where.followUpStatus = "ACTIVE";
    }

    if (q) {
      where.OR = [{ name: { contains: q } }, { phone: { contains: q } }];
    }

    if (closedOnly) {
      where.customerStatus = "CLOSED";
    }

    const customers = await prisma.customer.findMany({
      where,
      include: customerInclude,
      orderBy: { updatedAt: "desc" },
    });

    let rows = customers.map((c) => mapCustomerRow(c, session));

    if (segment === "LEAD" || segment === "CLOSED" || segment === "CHURNED") {
      rows = rows.filter((r) => r.segment === segment);
    }

    if (segment === "REMINDER") {
      rows = rows.filter(
        (r) =>
          r.reminderStatus === "DUE_SOON" || r.reminderStatus === "OVERDUE"
      );
    }

    rows.sort((a, b) => {
      const rank = (s: ReminderStatus) =>
        s === "OVERDUE" ? 0 : s === "DUE_SOON" ? 1 : 2;
      const diff = rank(a.reminderStatus) - rank(b.reminderStatus);
      if (diff !== 0) return diff;
      return b.name.localeCompare(a.name, "zh-CN");
    });

    const total = rows.length;
    const paged = rows.slice(skip, skip + take);

    const statsWhere: Record<string, unknown> = { deletedAt: null };
    if (session.role === "SALES") {
      statsWhere.salesId = session.id;
    } else if (salesIdFilter) {
      statsWhere.salesId = salesIdFilter;
    }

    const statsCustomers = await prisma.customer.findMany({
      where: statsWhere,
      include: customerInclude,
    });

    const activeStats = statsCustomers.filter(
      (c) => c.followUpStatus === "ACTIVE"
    );
    const stats = {
      total: activeStats.length,
      lead: activeStats.filter((c) => {
        const last = c.orders[0]?.orderedAt ?? null;
        return getCustomerSegment(c.customerStatus, last) === "LEAD";
      }).length,
      closed: activeStats.filter((c) => {
        const last = c.orders[0]?.orderedAt ?? null;
        return getCustomerSegment(c.customerStatus, last) === "CLOSED";
      }).length,
      churned: activeStats.filter((c) => {
        const last = c.orders[0]?.orderedAt ?? null;
        return getCustomerSegment(c.customerStatus, last) === "CHURNED";
      }).length,
      abandoned: statsCustomers.filter((c) => c.followUpStatus === "ABANDONED")
        .length,
      dueSoon: activeStats.filter((c) => {
        const latest = c.followUpRecords[0];
        return getReminderStatus(latest?.nextFollowUpAt) === "DUE_SOON";
      }).length,
      overdue: activeStats.filter((c) => {
        const latest = c.followUpRecords[0];
        return getReminderStatus(latest?.nextFollowUpAt) === "OVERDUE";
      }).length,
    };

    return NextResponse.json({
      ...paginatedResponse(paged, total, page, pageSize),
      stats,
      salesUsers: isAdmin
        ? await prisma.user.findMany({
            where: { role: "SALES" },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
