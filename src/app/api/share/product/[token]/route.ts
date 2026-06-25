import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import { serializeProductForPublicShare } from "@/lib/product-serializers";
import { resolveProductMediaPath } from "@/lib/product-media";
import fs from "fs/promises";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const product = await prisma.product.findUnique({
      where: { shareToken: token },
      include: {
        specs: { orderBy: { createdAt: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!product) return apiError("分享链接无效或已失效", 404);
    return NextResponse.json(serializeProductForPublicShare(product, token));
  } catch (error) {
    return handleApiError(error);
  }
}
