"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { shareLinkToWeChat } from "@/lib/wechat-share";

function WeChatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8.5 4C4.91 4 2 6.28 2 9.14c0 1.57.84 2.98 2.16 3.95l-.55 2.03 2.18-1.12c.73.2 1.51.31 2.31.31.17 0 .34-.01.5-.03A5.5 5.5 0 0 1 8.5 4zm-2.2 3.6c-.45 0-.82-.35-.82-.78s.37-.78.82-.78.82.35.82.78-.37.78-.82.78zm4.4 0c-.45 0-.82-.35-.82-.78s.37-.78.82-.78.82.35.82.78-.37.78-.82.78zM21.5 11.5c0-2.4-2.35-4.35-5.25-4.35-2.9 0-5.25 1.95-5.25 4.35s2.35 4.35 5.25 4.35c.68 0 1.33-.12 1.93-.33l1.82.94-.46-1.7c1.1-.82 1.96-1.98 1.96-3.26zm-7.1-1.05c-.36 0-.65-.28-.65-.62s.29-.62.65-.62.65.28.65.62-.29.62-.65.62zm2.9 0c-.36 0-.65-.28-.65-.62s.29-.62.65-.62.65.28.65.62-.29.62-.65.62z" />
    </svg>
  );
}

export function ShareLinkModal({
  open,
  onClose,
  url,
  title,
  hint,
  isPremium,
  initialCopied = false,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  hint?: string;
  isPremium: boolean;
  initialCopied?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(initialCopied);
  const [wechatHint, setWechatHint] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setCopied(initialCopied);
      setWechatHint("");
    }
  }, [open, initialCopied, url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function handleCopy() {
    const ok = await copyToClipboard(url);
    setCopied(ok);
  }

  async function handleWeChatShare() {
    const result = await shareLinkToWeChat(url);
    setCopied(result.copied || copied);
    if (!result.isMobile) {
      setWechatHint("链接已复制，请在手机微信中选择好友粘贴发送（将以链接卡片展示）");
      return;
    }
    if (result.opened) {
      setWechatHint("链接已复制，请在微信中选择好友粘贴发送（将以链接卡片展示）");
      return;
    }
    setWechatHint("链接已复制，请打开微信选择好友粘贴发送");
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-t-xl bg-white shadow-xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          {hint && <p className="text-sm text-muted">{hint}</p>}
          {copied && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              链接已自动复制到剪贴板
            </p>
          )}

          <div>
            <div className="text-xs text-muted mb-1.5">分享链接</div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-paper px-3 py-2.5 text-sm break-all leading-relaxed">
                {url}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 self-start"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    复制
                  </>
                )}
              </Button>
            </div>
          </div>

          {isPremium && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="text-sm font-medium">分享到微信</div>
              <p className="text-xs text-muted">
                点击后将复制链接并尝试打开微信，选择好友粘贴发送即可生成链接卡片
              </p>
              <Button
                type="button"
                className="w-full bg-[#07c160] hover:bg-[#06ad56] text-white"
                onClick={handleWeChatShare}
              >
                <WeChatIcon className="h-5 w-5 mr-2" />
                分享到微信好友
              </Button>
              {wechatHint && (
                <p className="text-xs text-muted">{wechatHint}</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 sm:px-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
