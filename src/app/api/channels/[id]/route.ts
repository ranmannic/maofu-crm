import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  parentId: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(["ADMIN"]);
    const { id } = await params;
    const data = updateSchema.parse(await request.json());

    if (data.parentId) {
      const parent = await prisma.channelType.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) return apiError("上级分类不存在");
      if (parent.parentId) return apiError("仅支持两级渠道分类");
    }

    const channel = await prisma.channelType.update({ where: { id }, data });
    return NextResponse.json(channel);
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

    const channel = await prisma.channelType.findUnique({
      where: { id },
      include: { _count: { select: { customers: true, children: true } } },
    });
    if (!channel) return apiError("渠道不存在", 404);

    if (channel._count.children > 0) {
      return apiError("请先删除该分类下的二级渠道");
    }
    if (channel._count.customers > 0) {
      return apiError(`该渠道下仍有 ${channel._count.customers} 个客户，无法删除`);
    }

    await prisma.channelType.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
