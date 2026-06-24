import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const session = await requireSession(["ADMIN", "SALES"]);
    const { customerId } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer || customer.deletedAt) return apiError("客户不存在", 404);
    if (session.role === "SALES" && customer.salesId !== session.id) {
      return apiError("无权限", 403);
    }
    if (customer.followUpStatus !== "ABANDONED") {
      return apiError("客户未处于放弃状态");
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        followUpStatus: "ACTIVE",
        abandonedAt: null,
        abandonReason: null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
