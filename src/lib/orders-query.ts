import type { SessionUser } from "@/lib/auth-types";
import type { Prisma } from "@/generated/prisma/client";

export type OrderListFilters = {
  customer?: string;
  sales?: string;
  orderNo?: string;
  orderedStart?: string;
  orderedEnd?: string;
  paidStart?: string;
  paidEnd?: string;
  isPaid?: string;
  paymentStatus?: string;
  isShipped?: string;
  showDeleted?: boolean;
};

export function parseOrderListFilters(
  searchParams: URLSearchParams
): OrderListFilters {
  return {
    customer: searchParams.get("customer")?.trim() || undefined,
    sales: searchParams.get("sales")?.trim() || undefined,
    orderNo: searchParams.get("orderNo")?.trim() || undefined,
    orderedStart: searchParams.get("orderedStart") || undefined,
    orderedEnd: searchParams.get("orderedEnd") || undefined,
    paidStart: searchParams.get("paidStart") || undefined,
    paidEnd: searchParams.get("paidEnd") || undefined,
    isPaid: searchParams.get("isPaid") || undefined,
    paymentStatus: searchParams.get("paymentStatus") || undefined,
    isShipped: searchParams.get("isShipped") || undefined,
    showDeleted: searchParams.get("showDeleted") === "true",
  };
}

export function buildOrderListWhere(
  session: SessionUser,
  filters: OrderListFilters
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (session.role === "SALES") {
    where.salesId = session.id;
  }

  if (filters.showDeleted) {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }

  if (filters.orderNo) {
    where.orderNo = { contains: filters.orderNo };
  }

  if (filters.customer) {
    where.OR = [
      { customerName: { contains: filters.customer } },
      { customerId: { contains: filters.customer } },
    ];
  }

  if (filters.sales && session.role !== "SALES") {
    where.sales = {
      OR: [
        { name: { contains: filters.sales } },
        { id: { contains: filters.sales } },
      ],
    };
  }

  if (filters.orderedStart || filters.orderedEnd) {
    where.orderedAt = {};
    if (filters.orderedStart) {
      where.orderedAt.gte = new Date(filters.orderedStart + "T00:00:00");
    }
    if (filters.orderedEnd) {
      where.orderedAt.lte = new Date(filters.orderedEnd + "T23:59:59");
    }
  }

  if (filters.paidStart || filters.paidEnd) {
    where.paidAt = {};
    if (filters.paidStart) {
      where.paidAt.gte = new Date(filters.paidStart + "T00:00:00");
    }
    if (filters.paidEnd) {
      where.paidAt.lte = new Date(filters.paidEnd + "T23:59:59");
    }
  }

  if (filters.isPaid === "true") where.isPaid = true;
  if (filters.isPaid === "false") where.isPaid = false;
  if (
    filters.paymentStatus === "UNPAID" ||
    filters.paymentStatus === "PARTIAL" ||
    filters.paymentStatus === "PAID"
  ) {
    where.paymentStatus = filters.paymentStatus;
  }
  if (filters.isShipped === "true") where.isShipped = true;
  if (filters.isShipped === "false") where.isShipped = false;

  return where;
}

export const orderListInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      channel: {
        select: {
          name: true,
          parent: { select: { name: true } },
        },
      },
    },
  },
  sales: { select: { id: true, name: true } },
  handler: { select: { id: true, name: true } },
  items: true,
  shipping: true,
} satisfies Prisma.OrderInclude;
