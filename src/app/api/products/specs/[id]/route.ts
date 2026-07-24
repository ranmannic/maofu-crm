import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, PRODUCT_MANAGER_ROLES } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import type { SpecUnit } from "@/generated/prisma/client";
import {
  isProductActive,
  isSpecActive,
} from "@/lib/product-query";

const specUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  unitType: z.enum(["BOTTLE", "BOX", "PIECE", "SET"]).optional(),
  bottlesPerUnit: z.number().int().min(1).optional(),
  price: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  retailGuidePrice: z.number().min(0).nullable().optional(),
  retailFloorPrice: z.number().min(0).nullable().optional(),
  groupGuidePrice: z.number().min(0).nullable().optional(),
  groupFloorPrice: z.number().min(0).nullable().optional(),
  wholesaleGuidePrice: z.number().min(0).nullable().optional(),
  wholesaleFloorPrice: z.number().min(0).nullable().optional(),
  description: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(PRODUCT_MANAGER_ROLES);
    const { id } = await params;
    const data = specUpdateSchema.parse(await request.json());

    const existing = await prisma.productSpec.findUnique({
      where: { id },
      include: { product: { select: { deletedAt: true } } },
    });
    if (
      !existing ||
      !isSpecActive(existing) ||
      !isProductActive(existing.product)
    ) {
      return apiError("规格不存在", 404);
    }

    const spec = await prisma.productSpec.update({
      where: { id },
      data: {
        ...data,
        unitType: data.unitType as SpecUnit | undefined,
      },
    });
    return NextResponse.json(spec);
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
    const existing = await prisma.productSpec.findUnique({
      where: { id },
      include: { product: { select: { deletedAt: true } } },
    });
    if (
      !existing ||
      !isProductActive(existing.product)
    ) {
      return apiError("规格不存在", 404);
    }
    if (!isSpecActive(existing)) {
      return NextResponse.json({ success: true });
    }

    await prisma.productSpec.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
