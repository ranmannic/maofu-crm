import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, PRODUCT_MANAGER_ROLES, canManageProducts } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { serializeProductForAdmin } from "@/lib/product-serializers";
import {
  activeSpecsInclude,
  isProductActive,
} from "@/lib/product-query";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  alcoholContent: z.string().nullable().optional(),
  aromaType: z.string().nullable().optional(),
  origin: z.string().nullable().optional(),
  thumbnailKey: z.string().nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        specs: activeSpecsInclude(),
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!product || !isProductActive(product)) return apiError("产品不存在", 404);
    if (canManageProducts(session.role)) {
      return NextResponse.json(serializeProductForAdmin(product));
    }
    const { serializeProductForSales } = await import("@/lib/product-serializers");
    return NextResponse.json(serializeProductForSales(product, true));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(PRODUCT_MANAGER_ROLES);
    const { id } = await params;
    const data = updateSchema.parse(await request.json());

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || !isProductActive(existing)) {
      return apiError("产品不存在", 404);
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        specs: activeSpecsInclude(),
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    return NextResponse.json(serializeProductForAdmin(product));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
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
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return apiError("产品不存在", 404);
    if (!isProductActive(existing)) {
      return NextResponse.json({ success: true });
    }

    const deletedAt = new Date();
    await prisma.$transaction([
      prisma.productSpec.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt },
      }),
      prisma.product.update({
        where: { id },
        data: { deletedAt },
      }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
