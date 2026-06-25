import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

export const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export const PRODUCT_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export function getProductUploadsRoot() {
  return path.join(process.cwd(), "data/uploads/products");
}

export function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()\u4e00-\u9fa5]/g, "_").slice(0, 120) || "image";
}

export async function saveProductImageFile(productId: string, file: File) {
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error("图片大小不能超过 8MB");
  }
  if (!PRODUCT_IMAGE_MIME.has(file.type)) {
    throw new Error("仅支持 JPG/PNG/GIF/WebP 图片");
  }

  const dir = path.join(getProductUploadsRoot(), productId);
  await fs.mkdir(dir, { recursive: true });

  const safeName = sanitizeFileName(file.name);
  const storageKey = `${productId}/${randomBytes(8).toString("hex")}-${safeName}`;
  const absPath = path.join(getProductUploadsRoot(), storageKey);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buffer);

  return { storageKey, mimeType: file.type };
}

export function resolveProductMediaPath(storageKey: string) {
  const root = getProductUploadsRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root))) {
    throw new Error("非法文件路径");
  }
  return abs;
}

export async function deleteProductMediaFile(storageKey: string) {
  try {
    await fs.unlink(resolveProductMediaPath(storageKey));
  } catch {
    // ignore
  }
}

export function productMediaUrl(productId: string, storageKey: string) {
  const fileName = storageKey.split("/").pop() ?? storageKey;
  return `/api/products/${productId}/media/${encodeURIComponent(fileName)}`;
}

export function shareProductMediaUrl(token: string, imageId: string) {
  return `/api/share/product/${token}/media/${imageId}`;
}

export function shareSpecMediaUrl(token: string, specId: string) {
  return `/api/share/product/${token}/media/spec-${specId}`;
}

export async function saveSpecThumbnailFile(
  productId: string,
  specId: string,
  file: File
) {
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error("图片大小不能超过 8MB");
  }
  if (!PRODUCT_IMAGE_MIME.has(file.type)) {
    throw new Error("仅支持 JPG/PNG/GIF/WebP 图片");
  }

  const dir = path.join(getProductUploadsRoot(), productId, "specs", specId);
  await fs.mkdir(dir, { recursive: true });

  const safeName = sanitizeFileName(file.name);
  const storageKey = `${productId}/specs/${specId}/${randomBytes(8).toString("hex")}-${safeName}`;
  const absPath = path.join(getProductUploadsRoot(), storageKey);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buffer);

  return { storageKey, mimeType: file.type };
}

export function specMediaUrl(productId: string, storageKey: string) {
  return productMediaUrl(productId, storageKey);
}
