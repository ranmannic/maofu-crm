import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import {
  inventoryErrorResponse,
  requirePremiumInventoryManager,
} from "@/lib/inventory-api";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePremiumInventoryManager();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const material = await prisma.material.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        unit: body.unit?.trim(),
        notes: body.notes,
        lowStockThreshold: body.lowStockThreshold,
      },
    });

    return NextResponse.json(material);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    const inv = inventoryErrorResponse(error);
    if (inv) return apiError(inv.message, inv.status);
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePremiumInventoryManager();
    const { id } = await params;

    const used = await prisma.productSpecStockBasisLine.count({
      where: { materialId: id },
    });
    if (used > 0) {
      return apiError("物料已被规格库存依据引用，无法删除");
    }

    await prisma.material.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const inv = inventoryErrorResponse(error);
    if (inv) return apiError(inv.message, inv.status);
    return handleApiError(error);
  }
}
