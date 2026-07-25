import fs from "fs/promises";
import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { ensureSiteSettings, resolveSiteIconPath } from "@/lib/site-settings";

export async function GET() {
  try {
    const settings = await ensureSiteSettings();
    if (!settings.siteIconKey) return apiError("网站图标不存在", 404);

    const abs = resolveSiteIconPath(settings.siteIconKey);
    const buffer = await fs.readFile(abs);
    const ext = settings.siteIconKey.split(".").pop()?.toLowerCase();
    let mimeType = "image/png";
    if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "gif") mimeType = "image/gif";
    else if (ext === "webp") mimeType = "image/webp";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
