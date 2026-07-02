import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import { getLowStockAlerts, WINE_SKU_LABELS } from "@/lib/inventory";
import {
  inventoryErrorResponse,
  requirePremiumInventoryManager,
} from "@/lib/inventory-api";

export async function GET() {
  try {
    await requirePremiumInventoryManager();

    const stocks = await prisma.wineStock.findMany({
      orderBy: [{ product: { name: "asc" } }, { skuType: "asc" }],
      include: { product: { select: { id: true, name: true } } },
    });

    const alerts = await getLowStockAlerts();

    return NextResponse.json({
      items: stocks.map((w) => ({
        id: w.id,
        productId: w.productId,
        productName: w.product.name,
        skuType: w.skuType,
        skuLabel: WINE_SKU_LABELS[w.skuType],
        stockQty: w.stockQty,
        lowStockThreshold: w.lowStockThreshold,
        notes: w.notes,
        isLowStock:
          w.lowStockThreshold > 0 && w.stockQty <= w.lowStockThreshold,
      })),
      lowStockCount: alerts.filter((a) => a.type === "WINE").length,
    });
  } catch (error) {
    const inv = inventoryErrorResponse(error);
    if (inv) return apiError(inv.message, inv.status);
    return handleApiError(error);
  }
}

const createSchema = z.object({
  productId: z.string().min(1, "请选择产品"),
  skuType: z.enum(["BOTTLE", "LITER"]),
  lowStockThreshold: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requirePremiumInventoryManager();
    const body = createSchema.parse(await request.json());

    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      select: { id: true, name: true },
    });
    if (!product) return apiError("产品不存在", 404);

    const existing = await prisma.wineStock.findUnique({
      where: {
        productId_skuType: {
          productId: body.productId,
          skuType: body.skuType,
        },
      },
    });
    if (existing) {
      return apiError(
        `该产品已存在「${WINE_SKU_LABELS[body.skuType]}」酒体库存记录`
      );
    }

    const stock = await prisma.wineStock.create({
      data: {
        productId: body.productId,
        skuType: body.skuType,
        lowStockThreshold: body.lowStockThreshold ?? 0,
        notes: body.notes?.trim() || null,
      },
      include: { product: { select: { name: true } } },
    });

    return NextResponse.json(
      {
        id: stock.id,
        productId: stock.productId,
        productName: stock.product.name,
        skuType: stock.skuType,
        skuLabel: WINE_SKU_LABELS[stock.skuType],
        stockQty: stock.stockQty,
        lowStockThreshold: stock.lowStockThreshold,
        notes: stock.notes,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    const inv = inventoryErrorResponse(error);
    if (inv) return apiError(inv.message, inv.status);
    return handleApiError(error);
  }
}
