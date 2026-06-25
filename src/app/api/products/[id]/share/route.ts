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
    await requireSession(["ADMIN", "SALES"]);
    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return apiError("产品不存在", 404);

    const shareToken = product.shareToken ?? generateShareToken();
    const updated = await prisma.product.update({
      where: { id },
      data: { shareToken },
      select: { shareToken: true },
    });

    return NextResponse.json({
      shareToken: updated.shareToken,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/share/product/${updated.shareToken}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
