import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { getEditionState, setEdition } from "@/lib/edition";

export async function GET() {
  try {
    await requireSession();
    const state = await getEditionState();
    return NextResponse.json(state);
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  edition: z.enum(["STANDARD", "PREMIUM"]),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(["ADMIN"]);
    const body = patchSchema.parse(await request.json());
    const state = await setEdition(body.edition, session.id);
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof Error && error.message === "PREMIUM_ACCESS_REQUIRED") {
      return apiError("请先开启高级版体验或订阅", 403);
    }
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
