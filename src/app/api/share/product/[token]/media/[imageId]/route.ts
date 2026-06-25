import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import { resolveProductMediaPath } from "@/lib/product-media";
import fs from "fs/promises";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; imageId: string }> }
) {
  try {
    const { token, imageId } = await params;
    const product = await prisma.product.findUnique({
      where: { shareToken: token },
      include: {
        images: true,
        specs: true,
      },
    });
    if (!product) return apiError("无效链接", 404);

    let storageKey: string | null = null;
    let mimeType = "image/jpeg";

    if (imageId === "thumb" && product.thumbnailKey) {
      storageKey = product.thumbnailKey;
    } else if (imageId.startsWith("spec-")) {
      const specId = imageId.slice(5);
      const spec = product.specs.find((s) => s.id === specId);
      if (!spec?.thumbnailKey) return apiError("图片不存在", 404);
      storageKey = spec.thumbnailKey;
    } else {
      const img = product.images.find((i) => i.id === imageId);
      if (!img) return apiError("图片不存在", 404);
      storageKey = img.storageKey;
    }

    const abs = resolveProductMediaPath(storageKey);
    const buffer = await fs.readFile(abs);
    const ext = storageKey.split(".").pop()?.toLowerCase();
    if (ext === "png") mimeType = "image/png";
    else if (ext === "webp") mimeType = "image/webp";
    else if (ext === "gif") mimeType = "image/gif";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
