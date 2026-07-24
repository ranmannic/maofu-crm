import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, withSalesManagerAccess } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { serializeProductForSales } from "@/lib/product-serializers";
import { activeProductWhere, activeSpecsInclude } from "@/lib/product-query";

export async function GET() {
  try {
    await requireSession(withSalesManagerAccess(["ADMIN", "SALES", "OPERATIONS"]));
    const products = await prisma.product.findMany({
      where: activeProductWhere,
      include: {
        specs: activeSpecsInclude(),
        images: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      products.map((p) => serializeProductForSales(p, true))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
