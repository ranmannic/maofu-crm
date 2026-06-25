import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { resolveProductMediaPath } from "@/lib/product-media";
import fs from "fs/promises";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; file: string }> }
) {
  try {
    await requireSession();
    const { id, file } = await params;
    const decoded = decodeURIComponent(file);

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        specs: true,
      },
    });
    if (!product) return apiError("产品不存在", 404);

    const storageKey =
      product.images.find((i) => i.storageKey.endsWith(decoded))?.storageKey ??
      (product.thumbnailKey?.endsWith(decoded) ? product.thumbnailKey : null) ??
      product.specs.find((s) => s.thumbnailKey?.endsWith(decoded))?.thumbnailKey ??
      null;

    if (!storageKey) return apiError("文件不存在", 404);

    const abs = resolveProductMediaPath(storageKey);
    const buffer = await fs.readFile(abs);
    const ext = decoded.split(".").pop()?.toLowerCase();
    let mimeType = "image/jpeg";
    if (ext === "png") mimeType = "image/png";
    else if (ext === "webp") mimeType = "image/webp";
    else if (ext === "gif") mimeType = "image/gif";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
