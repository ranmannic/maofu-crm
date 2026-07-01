import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { serializeProductForSales } from "@/lib/product-serializers";

export async function GET() {
  try {
    await requireSession(["ADMIN", "SALES", "OPERATIONS"]);
    const products = await prisma.product.findMany({
      include: {
        specs: { orderBy: { createdAt: "asc" } },
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
