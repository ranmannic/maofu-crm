import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getCustomerLastPrices } from "@/lib/customer-last-prices";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession(["ADMIN", "SALES", "OPERATIONS"]);
    const { id } = await params;
    const prices = await getCustomerLastPrices(id);
    return NextResponse.json(prices);
  } catch (error) {
    return handleApiError(error);
  }
}
