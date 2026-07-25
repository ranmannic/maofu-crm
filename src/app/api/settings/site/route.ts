import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import {
  deleteSiteIconFile,
  ensureSiteSettings,
  getStorageUsageSummary,
  saveSiteIconFile,
  versionedSiteIconUrl,
} from "@/lib/site-settings";

const patchSchema = z.object({
  siteName: z.string().min(1, "网站名称不能为空").max(40, "网站名称最多 40 字"),
});

export async function GET() {
  try {
    await requireSession(["ADMIN"]);
    const settings = await ensureSiteSettings();
    const storage = await getStorageUsageSummary();

    return NextResponse.json({
      siteName: settings.siteName,
      siteIconUrl: settings.siteIconKey ? versionedSiteIconUrl(settings.updatedAt) : null,
      storage,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(["ADMIN"]);
    const body = patchSchema.parse(await request.json());

    const updated = await prisma.appSetting.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        edition: "STANDARD",
        siteName: body.siteName.trim(),
        updatedById: session.id,
      },
      update: {
        siteName: body.siteName.trim(),
        updatedById: session.id,
      },
    });

    return NextResponse.json({
      siteName: updated.siteName,
      siteIconUrl: updated.siteIconKey ? versionedSiteIconUrl(updated.updatedAt) : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(["ADMIN"]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("请选择网站图标");

    const current = await ensureSiteSettings();
    const storageKey = await saveSiteIconFile(file);
    const updated = await prisma.appSetting.update({
      where: { id: "global" },
      data: {
        siteIconKey: storageKey,
        updatedById: session.id,
      },
    });
    await deleteSiteIconFile(current.siteIconKey);

    return NextResponse.json({
      siteName: updated.siteName,
      siteIconUrl: updated.siteIconKey ? versionedSiteIconUrl(updated.updatedAt) : null,
    });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message);
    return handleApiError(error);
  }
}
