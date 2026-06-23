import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";

const channelSchema = z.object({
  name: z.string().min(1, "渠道名称不能为空"),
  sortOrder: z.number().int().optional(),
  parentId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const leafOnly = searchParams.get("leafOnly") === "true";

    const channels = await prisma.channelType.findMany({
      where: leafOnly ? { parentId: { not: null } } : undefined,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, sortOrder: true } },
        _count: { select: { customers: true, children: true } },
      },
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

    if (body.parentId) {
      const parent = await prisma.channelType.findUnique({
        where: { id: body.parentId },
      });
      if (!parent) return apiError("上级分类不存在");
      if (parent.parentId) return apiError("仅支持两级渠道分类");
    }

    const channel = await prisma.channelType.create({ data: body });
    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
