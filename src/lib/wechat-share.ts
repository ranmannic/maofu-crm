import { copyToClipboard } from "@/lib/copy-to-clipboard";

/** 尝试唤起微信 App（链接需已复制，用户粘贴后将以链接卡片形式发送） */
export async function shareLinkToWeChat(url: string): Promise<{
  opened: boolean;
  copied: boolean;
  isMobile: boolean;
}> {
  const copied = await copyToClipboard(url);
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /iphone|ipad|ipod|android|mobile/.test(ua);

  if (!isMobile) {
    return { opened: false, copied, isMobile: false };
  }

  const schemes = ["weixin://", "weixin://dl/chat"];
  for (const scheme of schemes) {
    try {
      window.location.href = scheme;
      return { opened: true, copied, isMobile: true };
    } catch {
      /* try next */
    }
  }

  return { opened: false, copied, isMobile: true };
}
