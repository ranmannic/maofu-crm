import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { serializeCustomer } from "@/lib/serializers";
import type { SessionUser } from "@/lib/auth-types";
import { PAID_ORDER_FILTER } from "@/lib/customer-status";
import {
  getChurnLevel,
  getCustomerSegment,
  getReminderStatus,
  formatSinceLastOrder,
  canAbandonCustomer,
} from "@/lib/follow-up";

async function loadCustomer(
  customerId: string,
  session: { role: string; id: string }
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      sales: { select: { id: true, name: true } },
      channel: {
        select: {
          id: true,
          name: true,
          parent: { select: { id: true, name: true } },
        },
      },
      followUpRecords: {
        orderBy: { followedAt: "desc" },
        take: 1,
        select: { nextFollowUpAt: true },
      },
      orders: {
        where: PAID_ORDER_FILTER,
        select: { orderedAt: true },
        orderBy: { orderedAt: "desc" },
        take: 1,
      },
      _count: {
        select: {
          orders: { where: PAID_ORDER_FILTER },
          followUpRecords: true,
        },
      },
    },
  });

  if (!customer || customer.deletedAt) return null;
  if (session.role === "SALES" && customer.salesId !== session.id) return null;
  return customer;
}

function mapProfile(
  customer: NonNullable<Awaited<ReturnType<typeof loadCustomer>>>,
  session: SessionUser
) {
  const lastOrderAt = customer.orders[0]?.orderedAt ?? null;
  const segment = getCustomerSegment(customer.customerStatus, lastOrderAt);
  const latest = customer.followUpRecords[0] ?? null;
  const serialized = serializeCustomer(customer, session);

  return {
    id: customer.id,
    name: customer.name,
    phone: serialized.phone,
    channelName: serialized.channelName,
    address: customer.address,
    followUpNotes: customer.followUpNotes,
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
    reminderStatus: getReminderStatus(latest?.nextFollowUpAt),
    canAbandon:
      customer.followUpStatus === "ACTIVE" && canAbandonCustomer(segment),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const session = await requireSession(["ADMIN", "SALES"]);
    const { customerId } = await params;
    const customer = await loadCustomer(customerId, session);
    if (!customer) return apiError("客户不存在", 404);
    return NextResponse.json(mapProfile(customer, session));
  } catch (error) {
    return handleApiError(error);
  }
}

const recordSchema = z.object({
  followedAt: z.string().min(1, "请填写跟进时间"),
  content: z.string().min(1, "请填写跟进内容"),
  nextPlan: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
});

const patchSchema = z.object({
  followUpNotes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const session = await requireSession(["ADMIN", "SALES"]);
    const { customerId } = await params;
    const customer = await loadCustomer(customerId, session);
    if (!customer) return apiError("客户不存在", 404);

    const body = patchSchema.parse(await request.json());
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { followUpNotes: body.followUpNotes ?? null },
      include: {
        sales: { select: { id: true, name: true } },
        channel: {
          select: {
            id: true,
            name: true,
            parent: { select: { id: true, name: true } },
          },
        },
        followUpRecords: {
          orderBy: { followedAt: "desc" },
          take: 1,
          select: { nextFollowUpAt: true },
        },
        orders: {
          where: PAID_ORDER_FILTER,
          select: { orderedAt: true },
          orderBy: { orderedAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            orders: { where: PAID_ORDER_FILTER },
            followUpRecords: true,
          },
        },
      },
    });

    return NextResponse.json(mapProfile(updated, session));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const session = await requireSession(["ADMIN", "SALES"]);
    const { customerId } = await params;
    const customer = await loadCustomer(customerId, session);
    if (!customer) return apiError("客户不存在", 404);
    if (customer.followUpStatus === "ABANDONED") {
      return apiError("已放弃客户不可添加跟进，请先恢复跟进");
    }

    const body = recordSchema.parse(await request.json());

    const record = await prisma.customerFollowUpRecord.create({
      data: {
        customerId,
        userId: session.id,
        userName: session.name,
        followedAt: new Date(body.followedAt),
        content: body.content,
        nextPlan: body.nextPlan || null,
        nextFollowUpAt: body.nextFollowUpAt
          ? new Date(body.nextFollowUpAt)
          : null,
      },
    });

    await prisma.customer.update({
      where: { id: customerId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
