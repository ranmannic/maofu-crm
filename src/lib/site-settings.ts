import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { compressImageBuffer } from "@/lib/image-compress";
import { getEditionState, isPremiumEdition } from "@/lib/edition";

const GLOBAL_ID = "global";
const SITE_ICON_MAX_BYTES = 4 * 1024 * 1024;
const SITE_ICON_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function getSiteUploadsRoot() {
  return path.join(process.cwd(), "data/uploads/site");
}

export function siteIconUrl() {
  return "/api/site/icon";
}

export function versionedSiteIconUrl(updatedAt: Date | string | null | undefined) {
  if (!updatedAt) return siteIconUrl();
  const v = typeof updatedAt === "string" ? updatedAt : updatedAt.toISOString();
  return `${siteIconUrl()}?v=${encodeURIComponent(v)}`;
}

export async function ensureSiteSettings() {
  return prisma.appSetting.upsert({
    where: { id: GLOBAL_ID },
    create: { id: GLOBAL_ID, edition: "STANDARD", siteName: "毛府酒庄" },
    update: {},
  });
}

export async function getPublicSiteSettings() {
  const settings = await ensureSiteSettings();
  return {
    siteName: settings.siteName || "毛府酒庄",
    siteIconUrl: settings.siteIconKey ? versionedSiteIconUrl(settings.updatedAt) : null,
  };
}

export async function saveSiteIconFile(file: File) {
  if (file.size > SITE_ICON_MAX_BYTES) {
    throw new Error("网站图标大小不能超过 4MB");
  }
  if (!SITE_ICON_MIME.has(file.type)) {
    throw new Error("网站图标仅支持 JPG/PNG/GIF/WebP");
  }

  await fs.mkdir(getSiteUploadsRoot(), { recursive: true });
  const raw = Buffer.from(await file.arrayBuffer());
  const compressed = await compressImageBuffer(raw, file.type, file.name);
  const ext = compressed.fileName.split(".").pop() || "png";
  const storageKey = `${randomBytes(8).toString("hex")}.${ext}`;
  const absPath = path.join(getSiteUploadsRoot(), storageKey);
  await fs.writeFile(absPath, compressed.buffer);
  return storageKey;
}

export function resolveSiteIconPath(storageKey: string) {
  const root = getSiteUploadsRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root))) {
    throw new Error("非法文件路径");
  }
  return abs;
}

export async function deleteSiteIconFile(storageKey: string | null | undefined) {
  if (!storageKey) return;
  try {
    await fs.unlink(resolveSiteIconPath(storageKey));
  } catch {
    // ignore
  }
}

async function getDirSizeBytes(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await getDirSizeBytes(abs);
      } else if (entry.isFile()) {
        const stat = await fs.stat(abs);
        total += stat.size;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export async function getStorageUsageSummary() {
  const edition = await getEditionState();
  const usedBytes = await getDirSizeBytes(path.join(process.cwd(), "data/uploads"));
  const limitBytes = isPremiumEdition(edition)
    ? 1024 * 1024 * 1024
    : 200 * 1024 * 1024;

  return {
    usedBytes,
    limitBytes,
    canUpgradeToPremium: !isPremiumEdition(edition),
    isPremium: isPremiumEdition(edition),
  };
}
