export function resolveShareUrl(
  data: { shareUrl?: string; shareToken?: string },
  kind: "order" | "product"
): string {
  const token = data.shareToken;
  if (data.shareUrl) {
    const raw = data.shareUrl.trim();
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
    if (raw) return `${window.location.origin}/${raw.replace(/^\//, "")}`;
  }
  if (token) {
    return `${window.location.origin}/share/${kind}/${token}`;
  }
  throw new Error("无法生成分享链接");
}
