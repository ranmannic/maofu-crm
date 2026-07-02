import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, PRODUCT_MANAGER_ROLES } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { getEditionState, isPremiumEdition } from "@/lib/edition";
import {
  getSpecStockBasisLines,
  replaceSpecStockBasis,
  calcSpecMaxSellable,
  WINE_SKU_LABELS,
  type StockBasisLine,
} from "@/lib/inventory";

const lineSchema = z.object({
  lineType: z.enum(["WINE", "MATERIAL"]),
  materialId: z.string().nullable().optional(),
  wineProductId: z.string().nullable().optional(),
  wineSkuType: z.enum(["BOTTLE", "LITER"]).nullable().optional(),
  quantity: z.number().int().positive(),
});

const putSchema = z.object({
  lines: z.array(lineSchema).min(1),
});

async function requirePremiumProductManager() {
  const session = await requireSession(PRODUCT_MANAGER_ROLES);
  const edition = await getEditionState();
  if (!isPremiumEdition(edition)) {
    throw new Error("PREMIUM_REQUIRED");
  }
  return session;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePremiumProductManager();
    const { id } = await params;
    const spec = await prisma.productSpec.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        stockBasisLines: {
          include: { material: { select: { id: true, name: true, unit: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!spec) return apiError("规格不存在", 404);

    const stockConfigured = spec.stockBasisLines.length > 0;
    const lines = spec.stockBasisLines;
    const maxSellable = stockConfigured
      ? await calcSpecMaxSellable(id)
      : null;

    return NextResponse.json({
      productSpecId: id,
      productId: spec.productId,
      productName: spec.product.name,
      specName: spec.name,
      stockConfigured,
      maxSellable,
      lines: lines.map((l) => ({
        lineType: l.lineType,
        materialId: l.materialId,
        wineProductId: l.wineProductId,
        wineSkuType: l.wineSkuType ?? (l.lineType === "WINE" ? "BOTTLE" : null),
        quantity: l.quantity,
        materialName: l.material?.name ?? null,
        materialUnit: l.material?.unit ?? null,
        wineSkuLabel:
          l.lineType === "WINE"
            ? WINE_SKU_LABELS[l.wineSkuType ?? "BOTTLE"]
            : null,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PREMIUM_REQUIRED") {
      return apiError("库存依据为高级版功能", 403);
    }
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePremiumProductManager();
    const { id } = await params;
    const body = putSchema.parse(await request.json());

    const spec = await prisma.productSpec.findUnique({ where: { id } });
    if (!spec) return apiError("规格不存在", 404);

    const lines: StockBasisLine[] = body.lines.map((l) => ({
      lineType: l.lineType,
      materialId:
        l.lineType === "MATERIAL" ? l.materialId?.trim() || null : null,
      wineProductId:
        l.lineType === "WINE"
          ? l.wineProductId?.trim() || spec.productId
          : null,
      wineSkuType: l.lineType === "WINE" ? l.wineSkuType ?? "BOTTLE" : null,
      quantity: l.quantity,
    }));

    await replaceSpecStockBasis(id, lines);
    const maxSellable = await calcSpecMaxSellable(id);

    return NextResponse.json({ maxSellable });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    if (error instanceof Error && error.message === "PREMIUM_REQUIRED") {
      return apiError("库存依据为高级版功能", 403);
    }
    if (error instanceof Error) return apiError(error.message);
    return handleApiError(error);
  }
}
