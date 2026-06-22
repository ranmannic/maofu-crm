import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";

const channelSchema = z.object({
  name: z.string().min(1, "渠道名称不能为空"),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  try {
    await requireSession();
    const channels = await prisma.channelType.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { customers: true } } },
    });
    return NextResponse.json(channels);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession(["ADMIN"]);
    const body = channelSchema.parse(await request.json());
    const channel = await prisma.channelType.create({ data: body });
    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
