import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, PRODUCT_MANAGER_ROLES, canManageProducts } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { calcSpecMaxSellableBatch } from "@/lib/inventory";
import {
  serializeProductForAdmin,
  serializeProductForSales,
} from "@/lib/product-serializers";

const productSchema = z.object({
  name: z.string().min(1, "产品名称不能为空"),
  description: z.string().optional(),
  alcoholContent: z.string().optional(),
  aromaType: z.string().optional(),
  origin: z.string().optional(),
  specs: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.number().min(0),
        cost: z.number().min(0).default(0),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const products = await prisma.product.findMany({
      include: {
        specs: {
          orderBy: { createdAt: "asc" },
          include: {
            stockBasisLines: { select: { id: true }, take: 1 },
          },
        },
        images: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    const forAdmin = canManageProducts(session.role);

    let sellableMap = new Map<string, number>();
    if (forAdmin) {
      const configuredSpecIds = products.flatMap((p) =>
        p.specs.filter((s) => s.stockBasisLines.length > 0).map((s) => s.id)
      );
      if (configuredSpecIds.length > 0) {
        sellableMap = await calcSpecMaxSellableBatch(configuredSpecIds);
      }
    }

    return NextResponse.json(
      products.map((p) => {
        const base = forAdmin
          ? serializeProductForAdmin(p)
          : serializeProductForSales(p);
        if (!forAdmin) return base;
        return {
          ...base,
          specs: base.specs.map((s) => {
            const raw = p.specs.find((rs) => rs.id === s.id);
            const stockConfigured = (raw?.stockBasisLines.length ?? 0) > 0;
            return {
              ...s,
              stockConfigured,
              maxSellable: stockConfigured
                ? (sellableMap.get(s.id) ?? 0)
                : null,
            };
          }),
        };
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession(PRODUCT_MANAGER_ROLES);
    const body = productSchema.parse(await request.json());

    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description,
        alcoholContent: body.alcoholContent,
        aromaType: body.aromaType,
        origin: body.origin,
        specs: body.specs
          ? { create: body.specs }
          : undefined,
      },
      include: { specs: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
