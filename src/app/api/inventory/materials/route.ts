import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import {
  inventoryErrorResponse,
  requirePremiumInventoryManager,
} from "@/lib/inventory-api";

export async function GET() {
  try {
    await requirePremiumInventoryManager();
    const materials = await prisma.material.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({
      items: materials.map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        stockQty: m.stockQty,
        lowStockThreshold: m.lowStockThreshold,
        notes: m.notes,
        isLowStock: m.stockQty <= m.lowStockThreshold,
      })),
    });
  } catch (error) {
    const inv = inventoryErrorResponse(error);
    if (inv) return apiError(inv.message, inv.status);
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(1, "物料名称不能为空"),
  unit: z.string().min(1).optional(),
  notes: z.string().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requirePremiumInventoryManager();
    const body = createSchema.parse(await request.json());
    const material = await prisma.material.create({
      data: {
        name: body.name.trim(),
        unit: body.unit?.trim() || "个",
        notes: body.notes?.trim() || null,
        lowStockThreshold: body.lowStockThreshold ?? 10,
      },
    });
    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    const inv = inventoryErrorResponse(error);
    if (inv) return apiError(inv.message, inv.status);
    if (
      error instanceof Error &&
      error.message.includes("no such table") &&
      error.message.includes("Material")
    ) {
      return apiError("物料表未初始化，请执行数据库迁移（npx prisma migrate deploy）", 503);
    }
    return handleApiError(error);
  }
}
