import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getOpsWorkbench } from "@/lib/ops-workbench";
import type { OpsTaskType } from "@/lib/ops-workbench-types";

const PAGE_SIZE = 20;
const VALID_TYPES = new Set<OpsTaskType>([
  "UNSHIPPED",
  "UNPAID",
  "RECONCILE_REVIEW",
  "CREDIT_RECONCILE",
]);

export async function GET(request: NextRequest) {
  try {
    await requireSession(["OPERATIONS"]);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const typeParam = searchParams.get("type");
    const typeFilter =
      typeParam && VALID_TYPES.has(typeParam as OpsTaskType)
        ? (typeParam as OpsTaskType)
        : null;
    const data = await getOpsWorkbench(page, PAGE_SIZE, typeFilter);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
