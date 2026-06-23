import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import type { SpecUnit } from "@/generated/prisma/client";

const specUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  unitType: z.enum(["BOTTLE", "BOX", "PIECE", "SET"]).optional(),
  bottlesPerUnit: z.number().int().min(1).optional(),
  price: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(["ADMIN"]);
    const { id } = await params;
    const data = specUpdateSchema.parse(await request.json());

    const spec = await prisma.productSpec.update({
      where: { id },
      data: {
        ...data,
        unitType: data.unitType as SpecUnit | undefined,
      },
    });
    return NextResponse.json(spec);
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
    await prisma.productSpec.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
