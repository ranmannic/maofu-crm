import sharp from "sharp";

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 82;
const PNG_COMPRESSION = 8;

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export function isCompressibleImage(mimeType: string) {
  return IMAGE_MIME.has(mimeType);
}

function replaceExtension(fileName: string, ext: string) {
  const base = fileName.replace(/\.[^.]+$/, "");
  return `${base}${ext}`;
}

export async function compressImageBuffer(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  if (!isCompressibleImage(mimeType)) {
    return { buffer, mimeType, fileName: originalName };
  }

  let pipeline = sharp(buffer, { animated: mimeType === "image/gif" }).rotate();
  const meta = await pipeline.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  if (mimeType === "image/png" && meta.hasAlpha) {
    const out = await pipeline
      .png({ compressionLevel: PNG_COMPRESSION })
      .toBuffer();
    return {
      buffer: out,
      mimeType: "image/png",
      fileName: replaceExtension(originalName, ".png"),
    };
  }

  if (mimeType === "image/webp") {
    const out = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
    return {
      buffer: out,
      mimeType: "image/webp",
      fileName: replaceExtension(originalName, ".webp"),
    };
  }

  const out = await pipeline
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return {
    buffer: out,
    mimeType: "image/jpeg",
    fileName: replaceExtension(originalName, ".jpg"),
  };
}
