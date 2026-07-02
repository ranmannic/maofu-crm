import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import { applyPoolMovement } from "@/lib/inventory";
import {
  inventoryErrorResponse,
  requirePremiumInventoryManager,
} from "@/lib/inventory-api";
import { roundStockQty } from "@/lib/utils";

const movementSchema = z.object({
  quantity: z.number().positive(),
  type: z.enum(["PURCHASE_IN", "MANUAL_WRITE_OFF", "MANUAL_ADJUST"]),
  targetQty: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePremiumInventoryManager();
    const { id } = await params;
    const body = movementSchema.parse(await request.json());

    const stock = await prisma.wineStock.findUnique({ where: { id } });
    if (!stock) return apiError("酒体库存不存在", 404);

    const allowDecimal = stock.skuType === "LITER";

    if (!allowDecimal) {
      if (!Number.isInteger(body.quantity)) {
        return apiError("瓶装酒体数量须为整数");
      }
      if (
        body.targetQty !== undefined &&
        !Number.isInteger(body.targetQty)
      ) {
        return apiError("瓶装酒体数量须为整数");
      }
    }

    if (body.type === "MANUAL_ADJUST") {
      if (body.targetQty === undefined) {
        return apiError("盘点调整须提供目标数量");
      }
      const targetQty = allowDecimal
        ? roundStockQty(body.targetQty)
        : body.targetQty;
      const delta = roundStockQty(targetQty - stock.stockQty);
      if (delta === 0) {
        return NextResponse.json({ stockQty: stock.stockQty });
      }
      const result = await applyPoolMovement({
        poolType: "WINE",
        productId: stock.productId,
        wineSkuType: stock.skuType,
        delta,
        reason: "MANUAL_ADJUST",
        notes: body.notes ?? "酒体盘点调整",
        userId: session.id,
        userName: session.name,
      });
      return NextResponse.json({ stockQty: result.stockAfter });
    }

    const qty = allowDecimal ? roundStockQty(body.quantity) : body.quantity;
    const delta = body.type === "PURCHASE_IN" ? qty : -qty;
    const result = await applyPoolMovement({
      poolType: "WINE",
      productId: stock.productId,
      wineSkuType: stock.skuType,
      delta,
      reason: body.type === "PURCHASE_IN" ? "PURCHASE_IN" : "MANUAL_WRITE_OFF",
      notes:
        body.notes ??
        (body.type === "PURCHASE_IN" ? "酒体采购入库" : "酒体手工销库"),
      userId: session.id,
      userName: session.name,
    });

    return NextResponse.json({ stockQty: result.stockAfter }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    const inv = inventoryErrorResponse(error);
    if (inv) return apiError(inv.message, inv.status);
    if (error instanceof Error) return apiError(error.message);
    return handleApiError(error);
  }
}
