import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import { applyPoolMovement } from "@/lib/inventory";
import {
  inventoryErrorResponse,
  requirePremiumInventoryManager,
} from "@/lib/inventory-api";

const movementSchema = z.object({
  quantity: z.number().int().positive(),
  type: z.enum(["PURCHASE_IN", "MANUAL_WRITE_OFF", "MANUAL_ADJUST"]),
  targetQty: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePremiumInventoryManager();
    const { id: materialId } = await params;
    const body = movementSchema.parse(await request.json());

    if (body.type === "MANUAL_ADJUST") {
      if (body.targetQty === undefined) {
        return apiError("盘点调整须提供目标数量");
      }
      const material = await prisma.material.findUnique({ where: { id: materialId } });
      if (!material) return apiError("物料不存在", 404);
      const delta = body.targetQty - material.stockQty;
      if (delta === 0) {
        return NextResponse.json({ stockQty: material.stockQty });
      }
      const result = await applyPoolMovement({
        poolType: "MATERIAL",
        materialId,
        delta,
        reason: "MANUAL_ADJUST",
        notes: body.notes ?? "物料盘点调整",
        userId: session.id,
        userName: session.name,
      });
      return NextResponse.json({ stockQty: result.stockAfter });
    }

    const delta =
      body.type === "PURCHASE_IN" ? body.quantity : -body.quantity;
    const result = await applyPoolMovement({
      poolType: "MATERIAL",
      materialId,
      delta,
      reason: body.type === "PURCHASE_IN" ? "PURCHASE_IN" : "MANUAL_WRITE_OFF",
      notes:
        body.notes ??
        (body.type === "PURCHASE_IN" ? "物料采购入库" : "物料手工销库"),
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
