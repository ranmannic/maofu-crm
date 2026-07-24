import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, withSalesManagerAccess } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { getCustomerLastPrices } from "@/lib/customer-last-prices";
import { canReadCustomerRecord } from "@/lib/sales-team";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(
      withSalesManagerAccess(["ADMIN", "SALES", "OPERATIONS"])
    );
    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, salesId: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) return apiError("客户不存在", 404);
    if (!(await canReadCustomerRecord(session, customer))) {
      return apiError("无权限", 403);
    }

    const prices = await getCustomerLastPrices(id);
    return NextResponse.json(prices);
  } catch (error) {
    return handleApiError(error);
  }
}
