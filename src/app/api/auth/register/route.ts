import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { seedDefaultChannels } from "@/lib/bootstrap";
import { startPremiumTrial } from "@/lib/edition";
import { isValidCnMobile, normalizePhone } from "@/lib/phone";
import {
  DEFAULT_REGISTER_PASSWORD,
  isRegisterAvailable,
} from "@/lib/register";
import {
  deleteSiteIconFile,
  ensureSiteSettings,
  saveSiteIconFile,
} from "@/lib/site-settings";

export async function POST(request: NextRequest) {
  try {
    if (!(await isRegisterAvailable())) {
      return apiError("当前环境已开通，请使用已有账号登录", 403);
    }

    const form = await request.formData();
    const phoneRaw = String(form.get("phone") ?? "").trim();
    const companyName = String(form.get("companyName") ?? "").trim();
    const logo = form.get("logo");

    if (!phoneRaw) return apiError("请输入手机号");
    if (!isValidCnMobile(phoneRaw)) return apiError("请输入正确的 11 位手机号");
    if (!companyName) return apiError("请输入公司品牌名");
    if (companyName.length > 40) return apiError("公司品牌名最多 40 字");

    const username = normalizePhone(phoneRaw);
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return apiError("该手机号已注册，请直接登录");

    let siteIconKey: string | null = null;
    if (logo instanceof File && logo.size > 0) {
      siteIconKey = await saveSiteIconFile(logo);
    }

    const passwordHash = await hashPassword(DEFAULT_REGISTER_PASSWORD);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          password: passwordHash,
          name: companyName,
          role: "ADMIN",
        },
      });

      const current = await ensureSiteSettings();
      await tx.appSetting.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          edition: "STANDARD",
          siteName: companyName,
          siteIconKey,
          updatedById: created.id,
        },
        update: {
          siteName: companyName,
          ...(siteIconKey ? { siteIconKey } : {}),
          updatedById: created.id,
        },
      });

      if (siteIconKey && current.siteIconKey && current.siteIconKey !== siteIconKey) {
        await deleteSiteIconFile(current.siteIconKey);
      }

      return created;
    });

    await seedDefaultChannels();
    await startPremiumTrial(user.id);

    await createSession({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
      defaultPassword: DEFAULT_REGISTER_PASSWORD,
      redirect: "/",
    });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message);
    return handleApiError(error);
  }
}
