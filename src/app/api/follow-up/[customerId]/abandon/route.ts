import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import {
  getCustomerSegment,
  canAbandonCustomer,
} from "@/lib/follow-up";
import { PAID_ORDER_FILTER } from "@/lib/customer-status";

const abandonSchema = z.object({
  reason: z.string().min(1, "请填写放弃理由"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const session = await requireSession(["ADMIN", "SALES"]);
    const { customerId } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        orders: {
          where: PAID_ORDER_FILTER,
          select: { orderedAt: true },
          orderBy: { orderedAt: "desc" },
          take: 1,
        },
        _count: { select: { orders: { where: PAID_ORDER_FILTER } } },
      },
    });

    if (!customer || customer.deletedAt) return apiError("客户不存在", 404);
    if (session.role === "SALES" && customer.salesId !== session.id) {
      return apiError("无权限", 403);
    }
    if (customer.followUpStatus === "ABANDONED") {
      return apiError("客户已放弃");
    }

    const lastOrderAt = customer.orders[0]?.orderedAt ?? null;
    const segment = getCustomerSegment(customer.customerStatus, lastOrderAt);
    if (!canAbandonCustomer(segment)) {
      return apiError("仅线索客户或流失客户可放弃");
    }

    const body = abandonSchema.parse(await request.json());

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        followUpStatus: "ABANDONED",
        abandonedAt: new Date(),
        abandonReason: body.reason,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}

