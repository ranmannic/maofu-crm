import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import type { Role } from "@/generated/prisma/client";

const userSchema = z.object({
  username: z.string().min(3, "用户名至少3个字符"),
  password: z.string().min(6, "密码至少6个字符"),
  name: z.string().min(1, "姓名不能为空"),
  role: z.enum(["SALES", "OPERATIONS", "ADMIN"]),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") as Role | null;

    if (session.role === "SALES") {
      if (role !== "OPERATIONS") {
        return apiError("无权限", 403);
      }
    } else if (session.role !== "ADMIN") {
      return apiError("无权限", 403);
    }

    const users = await prisma.user.findMany({
      where: role ? { role } : undefined,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            customers: true,
            salesOrders: true,
            handledOrders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession(["ADMIN"]);
    const body = userSchema.parse(await request.json());

    const exists = await prisma.user.findUnique({
      where: { username: body.username },
    });
    if (exists) return apiError("用户名已存在");

    const password = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { ...body, password },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
