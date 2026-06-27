import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { startPremiumTrial } from "@/lib/edition";

export async function POST() {
  try {
    const session = await requireSession(["ADMIN"]);
    const state = await startPremiumTrial(session.id);
    return NextResponse.json(state);
  } catch (error) {
    return handleApiError(error);
  }
}
