import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import type { SpecUnit } from "@/generated/prisma/client";

const specSchema = z.object({
  name: z.string().min(1),
  unitType: z.enum(["BOTTLE", "BOX", "PIECE", "SET"]),
  bottlesPerUnit: z.number().int().min(1).default(1),
  price: z.number().min(0),
  cost: z.number().min(0).default(0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(["ADMIN"]);
    const { id: productId } = await params;
    const data = specSchema.parse(await request.json());

    const spec = await prisma.productSpec.create({
      data: { ...data, unitType: data.unitType as SpecUnit, productId },
    });
    return NextResponse.json(spec, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
