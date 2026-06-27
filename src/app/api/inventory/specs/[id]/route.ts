import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, PRODUCT_MANAGER_ROLES } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { getEditionState, isPremiumEdition } from "@/lib/edition";
import { SPEC_UNIT_LABELS } from "@/lib/constants";

const patchSchema = z.object({
  stockQty: z.number().int().min(0),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(PRODUCT_MANAGER_ROLES);
    const edition = await getEditionState();
    if (!isPremiumEdition(edition)) {
      return apiError("库存管理为高级版功能", 403);
    }

    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const spec = await prisma.productSpec.update({
      where: { id },
      data: { stockQty: body.stockQty },
      include: { product: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      id: spec.id,
      productId: spec.productId,
      productName: spec.product.name,
      specName: spec.name,
      unitType: spec.unitType,
      unitLabel: SPEC_UNIT_LABELS[spec.unitType],
      bottlesPerUnit: spec.bottlesPerUnit,
      stockQty: spec.stockQty,
      updatedAt: spec.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
