import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, PRODUCT_MANAGER_ROLES } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { getEditionState, isPremiumEdition } from "@/lib/edition";
import { SPEC_UNIT_LABELS } from "@/lib/constants";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    await requireSession(PRODUCT_MANAGER_ROLES);
    const edition = await getEditionState();
    if (!isPremiumEdition(edition)) {
      return apiError("库存管理为高级版功能", 403);
    }

    const page = Math.max(1, parseInt(new URL(request.url).searchParams.get("page") || "1", 10) || 1);
    const q = new URL(request.url).searchParams.get("q")?.trim() || "";

    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { product: { name: { contains: q } } },
          ],
        }
      : {};

    const [total, specs] = await Promise.all([
      prisma.productSpec.count({ where }),
      prisma.productSpec.findMany({
        where,
        include: { product: { select: { id: true, name: true } } },
        orderBy: [{ product: { name: "asc" } }, { createdAt: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return NextResponse.json({
      items: specs.map((s) => ({
        id: s.id,
        productId: s.productId,
        productName: s.product.name,
        specName: s.name,
        unitType: s.unitType,
        unitLabel: SPEC_UNIT_LABELS[s.unitType],
        bottlesPerUnit: s.bottlesPerUnit,
        stockQty: s.stockQty,
        updatedAt: s.updatedAt.toISOString(),
      })),
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
