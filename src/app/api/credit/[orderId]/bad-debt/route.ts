import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { markBadDebt } from "@/lib/credit";
import { logOrderChange } from "@/lib/order-audit";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  badDebtAmount: z.number().min(0),
  goodsRecovered: z.boolean(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      orderItemId: z.string(),
      recoveredQty: z.number().int().min(0),
    })
  ),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await requireSession(["OPERATIONS", "ADMIN"]);
    const { orderId } = await params;
    const body = bodySchema.parse(await request.json());

    await markBadDebt(orderId, body, session.id, session.name);

    await logOrderChange(orderId, session.id, session.name, "标记坏账", body);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, creditLines: true },
    });

    return NextResponse.json({ success: true, order });
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
