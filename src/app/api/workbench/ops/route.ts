import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getOpsWorkbench } from "@/lib/ops-workbench";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    await requireSession(["OPERATIONS"]);
    const page = Math.max(1, parseInt(new URL(request.url).searchParams.get("page") || "1", 10) || 1);
    const data = await getOpsWorkbench(page, PAGE_SIZE);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
