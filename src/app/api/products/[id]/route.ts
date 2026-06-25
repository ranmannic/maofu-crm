import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { serializeProductForAdmin } from "@/lib/product-serializers";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  alcoholContent: z.string().nullable().optional(),
  aromaType: z.string().nullable().optional(),
  origin: z.string().nullable().optional(),
  thumbnailKey: z.string().nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        specs: { orderBy: { createdAt: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!product) return apiError("产品不存在", 404);
    if (session.role === "ADMIN") {
      return NextResponse.json(serializeProductForAdmin(product));
    }
    const { serializeProductForSales } = await import("@/lib/product-serializers");
    return NextResponse.json(serializeProductForSales(product, true));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(["ADMIN"]);
    const { id } = await params;
    const data = updateSchema.parse(await request.json());

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        specs: true,
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    return NextResponse.json(serializeProductForAdmin(product));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(["ADMIN"]);
    const { id } = await params;
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
