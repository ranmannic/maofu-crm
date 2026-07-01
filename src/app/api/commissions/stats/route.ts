import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { getEditionState, isPremiumEdition } from "@/lib/edition";
import { computeMonthlyCommissionStats } from "@/lib/commission-stats";
import { currentMonthKey } from "@/lib/sales-commission";

async function requirePremiumAdmin() {
  await requireSession(["ADMIN"]);
  const edition = await getEditionState();
  if (!isPremiumEdition(edition)) {
    throw new Error("PREMIUM_REQUIRED");
  }
}

function parseMonth(value: string | null): string | null {
  if (!value) return currentMonthKey();
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  return value;
}

export async function GET(request: NextRequest) {
  try {
    await requirePremiumAdmin();
    const searchParams = new URL(request.url).searchParams;
    const month = parseMonth(searchParams.get("month"));
    if (!month) return apiError("月份格式应为 YYYY-MM");

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const result = await computeMonthlyCommissionStats(month, page);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "PREMIUM_REQUIRED") {
      return apiError("销售提成为高级版功能", 403);
    }
    return handleApiError(error);
  }
}
