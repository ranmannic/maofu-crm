"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Crown, Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  "现代蓝白简约 UI 风格",
  "规格级库存管理",
  "后续高级版功能持续更新",
];

export function PremiumExperienceModal({
  open,
  onClose,
  onStartTrial,
  starting,
}: {
  open: boolean;
  onClose: () => void;
  onStartTrial: () => void;
  starting?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-gradient-to-br from-[#4361ee]/85 via-[#5b7cfa]/80 to-[#7b93ff]/85 backdrop-blur-sm safe-top safe-bottom"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        className="fixed left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/35 safe-top"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="m-4 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-[#4361ee] via-[#5b7cfa] to-[#7b93ff] px-6 py-6 text-white">
          <div
            className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <div className="relative space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs tracking-widest">
              <Sparkles className="h-3.5 w-3.5 text-[#ffd76a]" />
              MAOFU PREMIUM
            </div>
            <h2 className="text-xl font-bold">升级高级版</h2>
            <p className="text-sm text-white/85">
              简约优雅的现代界面，库存管理等高级能力。免费体验 30 天，年付折合每月仅 ¥20。
            </p>
            <div className="flex flex-wrap items-baseline gap-4 pt-1">
              <div>
                <span className="text-3xl font-bold text-[#ffd76a]">¥29</span>
                <span className="ml-1 text-sm text-white/75">/月</span>
              </div>
              <div className="text-sm text-white/70">
                年付优惠{" "}
                <span className="font-semibold text-[#ffd76a]">¥20/月</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-5">
          {FEATURES.map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#5b7cfa]" />
              {f}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            暂不体验
          </Button>
          <Button
            onClick={onStartTrial}
            disabled={starting}
            className="bg-[#5b7cfa] text-white hover:bg-[#4361ee]"
          >
            <Crown className="mr-2 h-4 w-4" />
            {starting ? "开启中..." : "立即体验"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
