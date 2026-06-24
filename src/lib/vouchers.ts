import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

export const VOUCHER_MAX_BYTES = 10 * 1024 * 1024;

export const VOUCHER_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

export function getUploadsRoot() {
  return path.join(process.cwd(), "data/uploads/orders");
}

export function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()\u4e00-\u9fa5]/g, "_").slice(0, 120) || "file";
}

export async function saveVoucherFile(orderId: string, file: File) {
  if (file.size > VOUCHER_MAX_BYTES) {
    throw new Error("文件大小不能超过 10MB");
  }
  if (!VOUCHER_ALLOWED_MIME.has(file.type)) {
    throw new Error("仅支持图片（JPG/PNG/GIF/WebP）或 PDF");
  }

  const dir = path.join(getUploadsRoot(), orderId);
  await fs.mkdir(dir, { recursive: true });

  const safeName = sanitizeFileName(file.name);
  const storageKey = `${orderId}/${randomBytes(8).toString("hex")}-${safeName}`;
  const absPath = path.join(getUploadsRoot(), storageKey);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buffer);

  return { storageKey, fileName: file.name, mimeType: file.type };
}

export function resolveVoucherPath(storageKey: string) {
  const root = getUploadsRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root))) {
    throw new Error("非法文件路径");
  }
  return abs;
}

export async function deleteVoucherFile(storageKey: string) {
  try {
    await fs.unlink(resolveVoucherPath(storageKey));
  } catch {
    // ignore missing files
  }
}
