import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import {
  approveReconciliationRecord,
  rejectReconciliationRecord,
} from "@/lib/credit";
import { logOrderChange } from "@/lib/order-audit";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectReason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const session = await requireSession(["OPERATIONS", "ADMIN"]);
    const { recordId } = await params;
    const body = bodySchema.parse(await request.json());

    const rec = await prisma.creditReconciliationRecord.findUnique({
      where: { id: recordId },
      select: { id: true, orderId: true, reviewStatus: true },
    });
    if (!rec) return apiError("核销记录不存在", 404);
    if (rec.reviewStatus !== "PENDING") {
      return apiError("该核销记录不在待审核状态");
    }

    if (body.action === "approve") {
      const synced = await approveReconciliationRecord(
        recordId,
        session.id,
        session.name
      );
      await logOrderChange(rec.orderId, session.id, session.name, "审核通过核销", {
        recordId,
        payment: synced,
      });
      const order = await prisma.order.findUnique({
        where: { id: rec.orderId },
        include: { items: true, creditLines: true },
      });
      return NextResponse.json({ success: true, order, payment: synced });
    }

    await rejectReconciliationRecord(
      recordId,
      session.id,
      session.name,
      body.rejectReason
    );
    await logOrderChange(rec.orderId, session.id, session.name, "驳回核销申请", {
      recordId,
      rejectReason: body.rejectReason,
    });
    return NextResponse.json({ success: true });
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
