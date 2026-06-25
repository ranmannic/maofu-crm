import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { serializeCustomer } from "@/lib/serializers";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "请输入有效的11位手机号")
    .optional(),
  channelId: z.string().nullable().optional(),
  address: z.string().optional(),
  salesId: z.string().optional(),
  customerStatus: z.enum(["LEAD", "CLOSED"]).optional(),
  restore: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
        orders: { orderBy: { orderedAt: "desc" }, take: 20 },
      },
    });

    if (!customer) return apiError("客户不存在", 404);
    if (session.role === "SALES") {
      if (customer.salesId !== session.id || customer.deletedAt) {
        return apiError("无权限", 403);
      }
    }

    return NextResponse.json(serializeCustomer(customer, session));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(["SALES", "ADMIN"]);
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return apiError("客户不存在", 404);

    if (session.role === "SALES") {
      if (existing.salesId !== session.id || existing.deletedAt) {
        return apiError("无权限", 403);
      }
      if (body.salesId || body.restore || body.customerStatus) {
        return apiError("销售无法转移、恢复或修改客户状态", 403);
      }
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.channelId !== undefined) data.channelId = body.channelId;
    if (body.address !== undefined) data.address = body.address;

    if (session.role === "ADMIN" && body.phone !== undefined) {
      const duplicate = await prisma.customer.findFirst({
        where: { phone: body.phone, id: { not: id }, deletedAt: null },
      });
      if (duplicate) return apiError("该手机号已被其他客户使用");
      data.phone = body.phone;
    }
    if (session.role === "ADMIN" && body.salesId) {
      data.salesId = body.salesId;
    }
    if (session.role === "ADMIN" && body.restore) {
      data.deletedAt = null;
    }
    if (session.role === "ADMIN" && body.customerStatus) {
      data.customerStatus = body.customerStatus;
    }

    const customer = await prisma.customer.update({
      where: { id },
      data,
      include: {
        sales: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json(serializeCustomer(customer, session));
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
    const session = await requireSession();
    const { id } = await params;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return apiError("客户不存在", 404);

    if (session.role === "SALES") {
      if (existing.salesId !== session.id) {
        return apiError("无权限", 403);
      }
      if (existing.deletedAt) {
        return apiError("客户已删除", 400);
      }
      await prisma.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return NextResponse.json({ success: true, softDeleted: true });
    }

    if (session.role === "ADMIN") {
      if (existing.deletedAt) {
        return apiError("客户已删除", 400);
      }
      await prisma.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return NextResponse.json({ success: true, softDeleted: true });
    }

    return apiError("无权限", 403);
  } catch (error) {
    return handleApiError(error);
  }
}
