import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, PRODUCT_MANAGER_ROLES } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import {
  saveProductImageFile,
  deleteProductMediaFile,
  resolveProductMediaPath,
} from "@/lib/product-media";
import fs from "fs/promises";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(PRODUCT_MANAGER_ROLES);
    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return apiError("产品不存在", 404);

    const form = await request.formData();
    const file = form.get("file");
    const asThumbnail = form.get("asThumbnail") === "true";
    if (!(file instanceof File)) return apiError("请上传图片");

    const saved = await saveProductImageFile(id, file);
    const maxOrder = await prisma.productImage.aggregate({
      where: { productId: id },
      _max: { sortOrder: true },
    });

    const image = await prisma.productImage.create({
      data: {
        productId: id,
        storageKey: saved.storageKey,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    if (asThumbnail || !product.thumbnailKey) {
      await prisma.product.update({
        where: { id },
        data: { thumbnailKey: saved.storageKey },
      });
    }

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(PRODUCT_MANAGER_ROLES);
    const { id } = await params;
    const imageId = new URL(request.url).searchParams.get("imageId");
    if (!imageId) return apiError("缺少 imageId");

    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
    });
    if (!image) return apiError("图片不存在", 404);

    const product = await prisma.product.findUnique({ where: { id } });
    await prisma.productImage.delete({ where: { id: imageId } });
    await deleteProductMediaFile(image.storageKey);

    if (product?.thumbnailKey === image.storageKey) {
      const next = await prisma.productImage.findFirst({
        where: { productId: id },
        orderBy: { sortOrder: "asc" },
      });
      await prisma.product.update({
        where: { id },
        data: { thumbnailKey: next?.storageKey ?? null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
