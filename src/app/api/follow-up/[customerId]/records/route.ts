import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const session = await requireSession(["ADMIN", "SALES"]);
    const { customerId } = await params;
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = parsePagination(searchParams, 10);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, salesId: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) {
      return NextResponse.json({ error: "客户不存在" }, { status: 404 });
    }
    if (session.role === "SALES" && customer.salesId !== session.id) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const [records, total] = await Promise.all([
      prisma.customerFollowUpRecord.findMany({
        where: { customerId },
        orderBy: { followedAt: "desc" },
        skip,
        take,
      }),
      prisma.customerFollowUpRecord.count({ where: { customerId } }),
    ]);

    return NextResponse.json(
      paginatedResponse(
        records.map((r) => ({
          id: r.id,
          followedAt: r.followedAt,
          content: r.content,
          nextPlan: r.nextPlan,
          nextFollowUpAt: r.nextFollowUpAt,
          userName: r.userName,
          createdAt: r.createdAt,
        })),
        total,
        page,
        pageSize
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}
