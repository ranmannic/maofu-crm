import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { StockPoolType } from "@/generated/prisma/client";
import { apiError, handleApiError } from "@/lib/api";
import { STOCK_MOVEMENT_LABELS, WINE_SKU_LABELS } from "@/lib/inventory";
import {
  inventoryErrorResponse,
  requirePremiumInventoryManager,
} from "@/lib/inventory-api";

const PAGE_SIZE = 30;

export async function GET(request: NextRequest) {
  try {
    await requirePremiumInventoryManager();
    const page = Math.max(
      1,
      parseInt(new URL(request.url).searchParams.get("page") || "1", 10) || 1
    );
    const poolType = new URL(request.url).searchParams.get("poolType");

    const where: { poolType?: StockPoolType } | undefined =
      poolType === "WINE" || poolType === "MATERIAL"
        ? { poolType }
        : undefined;

    const [total, rows] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    const productIds = [
      ...new Set(rows.map((r) => r.productId).filter(Boolean) as string[]),
    ];
    const materialIds = [
      ...new Set(rows.map((r) => r.materialId).filter(Boolean) as string[]),
    ];

    const [products, materials] = await Promise.all([
      productIds.length
        ? prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : [],
      materialIds.length
        ? prisma.material.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, name: true, unit: true },
          })
        : [],
    ]);

    const productMap = new Map(products.map((p) => [p.id, p.name]));
    const materialMap = new Map(materials.map((m) => [m.id, m]));

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        poolType: r.poolType,
        targetName:
          r.poolType === "WINE"
            ? `${productMap.get(r.productId ?? "") ?? "酒体"}（${WINE_SKU_LABELS[r.wineSkuType ?? "BOTTLE"]}）`
            : materialMap.get(r.materialId ?? "")?.name ?? "物料",
        unitLabel:
          r.poolType === "WINE"
            ? WINE_SKU_LABELS[r.wineSkuType ?? "BOTTLE"]
            : materialMap.get(r.materialId ?? "")?.unit ?? "个",
        delta: r.delta,
        stockAfter: r.stockAfter,
        reason: r.reason,
        reasonLabel: STOCK_MOVEMENT_LABELS[r.reason],
        notes: r.notes,
        userName: r.userName,
        createdAt: r.createdAt.toISOString(),
      })),
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (error) {
    const inv = inventoryErrorResponse(error);
    if (inv) return apiError(inv.message, inv.status);
    return handleApiError(error);
  }
}
