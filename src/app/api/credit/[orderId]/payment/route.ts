import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { processPaymentWithReconciliation } from "@/lib/credit";
import { logOrderChange } from "@/lib/order-audit";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  payment: z.object({
    paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]),
    paidAmount: z.number().min(0),
    paidAt: z.string().optional(),
  }),
  reconcileItems: z
    .array(
      z.object({
        orderItemId: z.string(),
        quantity: z.number().int().min(0),
      })
    )
    .default([]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await requireSession(["OPERATIONS", "ADMIN"]);
    const { orderId } = await params;
    const body = bodySchema.parse(await request.json());

    const synced = await processPaymentWithReconciliation(
      orderId,
      body.payment,
      body.reconcileItems.filter((i) => i.quantity > 0),
      session.id,
      session.name
    );

    await logOrderChange(orderId, session.id, session.name, "账期核销", {
      payment: synced,
      reconcileItems: body.reconcileItems,
    });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, creditLines: true },
    });

    return NextResponse.json({ success: true, order, payment: synced });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    if (error instanceof Error) {
      return apiError(error.message);
    }
    return handleApiError(error);
  }
}
