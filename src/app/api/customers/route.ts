import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { serializeCustomer } from "@/lib/serializers";
import type { Prisma } from "@/generated/prisma/client";

const customerSchema = z.object({
  name: z.string().min(1, "客户名称不能为空"),
  phone: z.string().optional(),
  channelId: z.string().optional(),
  address: z.string().optional(),
  salesId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = parsePagination(searchParams);
    const q = searchParams.get("q")?.trim();
    const salesId = searchParams.get("salesId")?.trim();
    const showDeleted = searchParams.get("showDeleted") === "true";

    const where: Prisma.CustomerWhereInput = {};

    if (session.role === "SALES") {
      where.salesId = session.id;
      where.deletedAt = null;
    } else if (showDeleted) {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    if (salesId && session.role === "ADMIN") {
      where.salesId = salesId;
    }

    if (q) {
      where.OR = [
        { id: { contains: q } },
        { name: { contains: q } },
        { sales: { name: { contains: q } } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          sales: { select: { id: true, name: true } },
          channel: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.customer.count({ where }),
    ]);

    const data = customers.map((c) => serializeCustomer(c, session));
    return NextResponse.json(paginatedResponse(data, total, page, pageSize));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(["SALES", "ADMIN"]);
    const body = customerSchema.parse(await request.json());

    const salesId =
      session.role === "ADMIN" && body.salesId ? body.salesId : session.id;

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone,
        channelId: body.channelId,
        address: body.address,
        salesId,
        customerStatus: "LEAD",
      },
      include: {
        sales: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json(serializeCustomer(customer, session), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
