import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, PRODUCT_MANAGER_ROLES } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import {
  deleteProductMediaFile,
  saveSpecThumbnailFile,
} from "@/lib/product-media";
import { serializeSpecForAdmin } from "@/lib/product-serializers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(PRODUCT_MANAGER_ROLES);
    const { id } = await params;

    const spec = await prisma.productSpec.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!spec) return apiError("规格不存在", 404);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return apiError("请选择图片文件");

    if (spec.thumbnailKey) {
      await deleteProductMediaFile(spec.thumbnailKey);
    }

    const { storageKey } = await saveSpecThumbnailFile(
      spec.productId,
      spec.id,
      file
    );

    const updated = await prisma.productSpec.update({
      where: { id },
      data: { thumbnailKey: storageKey },
    });

    return NextResponse.json(
      serializeSpecForAdmin(spec.productId, updated)
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("图片")) {
      return apiError(error.message);
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(PRODUCT_MANAGER_ROLES);
    const { id } = await params;

    const spec = await prisma.productSpec.findUnique({ where: { id } });
    if (!spec) return apiError("规格不存在", 404);

    if (spec.thumbnailKey) {
      await deleteProductMediaFile(spec.thumbnailKey);
    }

    const updated = await prisma.productSpec.update({
      where: { id },
      data: { thumbnailKey: null },
    });

    return NextResponse.json(
      serializeSpecForAdmin(spec.productId, updated)
    );
  } catch (error) {
    return handleApiError(error);
  }
}
