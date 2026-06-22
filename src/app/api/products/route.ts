import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";

const productSchema = z.object({
  name: z.string().min(1, "产品名称不能为空"),
  description: z.string().optional(),
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

export async function GET() {
  try {
    await requireSession();
    const products = await prisma.product.findMany({
      include: { specs: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession(["ADMIN"]);
    const body = productSchema.parse(await request.json());

    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description,
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
