import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getPublicSiteSettings } from "@/lib/site-settings";

export async function GET() {
  try {
    return NextResponse.json(await getPublicSiteSettings());
  } catch (error) {
    return handleApiError(error);
  }
}
