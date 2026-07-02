import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import { WINE_SKU_LABELS } from "@/lib/inventory";
import {
  inventoryErrorResponse,
  requirePremiumInventoryManager,
} from "@/lib/inventory-api";

const patchSchema = z.object({
  lowStockThreshold: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePremiumInventoryManager();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const stock = await prisma.wineStock.update({
      where: { id },
      data: {
        lowStockThreshold: body.lowStockThreshold,
        notes: body.notes,
      },
      include: { product: { select: { name: true } } },
    });

    return NextResponse.json({
      id: stock.id,
      productId: stock.productId,
      productName: stock.product.name,
      skuType: stock.skuType,
      skuLabel: WINE_SKU_LABELS[stock.skuType],
      stockQty: stock.stockQty,
      lowStockThreshold: stock.lowStockThreshold,
      notes: stock.notes,
    });
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

    const stock = await prisma.wineStock.findUnique({ where: { id } });
    if (!stock) return apiError("酒体库存不存在", 404);
    if (stock.stockQty !== 0) {
      return apiError("库存不为零，无法删除。请先销库或盘点归零。");
    }

    const used = await prisma.productSpecStockBasisLine.count({
      where: {
        wineProductId: stock.productId,
        wineSkuType: stock.skuType,
        lineType: "WINE",
      },
    });
    if (used > 0) {
      return apiError("该酒体 SKU 已被规格库存依据引用，无法删除");
    }

    await prisma.wineStock.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const inv = inventoryErrorResponse(error);
    if (inv) return apiError(inv.message, inv.status);
    return handleApiError(error);
  }
}
