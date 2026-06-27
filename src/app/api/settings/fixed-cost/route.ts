import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { getEditionState } from "@/lib/edition";

const GLOBAL_ID = "global";

const patchSchema = z.object({
  monthlyFixedCost: z.number().min(0, "固定成本不能为负数"),
});

export async function GET() {
  try {
    const session = await requireSession(["ADMIN"]);
    const edition = await getEditionState();
    if (edition.edition !== "PREMIUM" || !edition.premiumAccess) {
      return apiError("仅高级版可用", 403);
    }

    const settings = await prisma.appSetting.findUnique({
      where: { id: GLOBAL_ID },
      select: { monthlyFixedCost: true },
    });

    return NextResponse.json({
      monthlyFixedCost: settings?.monthlyFixedCost ?? 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(["ADMIN"]);
    const edition = await getEditionState();
    if (edition.edition !== "PREMIUM" || !edition.premiumAccess) {
      return apiError("仅高级版可用", 403);
    }

    const body = patchSchema.parse(await request.json());

    const updated = await prisma.appSetting.upsert({
      where: { id: GLOBAL_ID },
      create: {
        id: GLOBAL_ID,
        edition: "STANDARD",
        monthlyFixedCost: body.monthlyFixedCost,
        updatedById: session.id,
      },
      update: {
        monthlyFixedCost: body.monthlyFixedCost,
        updatedById: session.id,
      },
      select: { monthlyFixedCost: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
