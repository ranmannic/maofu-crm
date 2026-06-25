import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { generateShareToken } from "@/lib/share-token";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(["ADMIN", "SALES", "OPERATIONS"]);
    const { id } = await params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order || order.deletedAt) return apiError("订单不存在", 404);
    if (session.role === "SALES" && order.salesId !== session.id) {
      return apiError("无权限", 403);
    }

    const shareToken = order.shareToken ?? generateShareToken();
    const updated = await prisma.order.update({
      where: { id },
      data: { shareToken },
      select: { shareToken: true },
    });

    return NextResponse.json({
      shareToken: updated.shareToken,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/share/order/${updated.shareToken}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
