"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Crown, Sparkles, Check, X, MessageSquare, ImageIcon, Brain, Boxes, TrendingUp, BadgePercent, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";

const STANDARD_FEATURES = [
  { icon: MessageSquare, text: "订单、客户、跟进基础管理" },
  { icon: ImageIcon, text: "上传空间上限 200MB" },
  { icon: Brain, text: "适合刚开始记单和客户维护" },
];

const PREMIUM_FEATURES = [
  { icon: Boxes, text: "酒体 / 物料 / 规格最大可售数联动" },
  { icon: BadgePercent, text: "销售提成、账期账龄、利润分析" },
  { icon: Palette, text: "网站品牌设置、更多展示能力" },
  { icon: TrendingUp, text: "基础空间提升到 1GB，可继续扩容" },
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
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/95 px-3 py-4 backdrop-blur-sm safe-top safe-bottom sm:flex sm:items-center sm:justify-center sm:px-4 sm:py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        className="fixed right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 safe-top"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 text-center text-white sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-widest text-white/85">
            <Sparkles className="h-3.5 w-3.5 text-[#6cb6ff]" />
            免费试用高级版 30 天
          </div>
          <h2 className="mt-4 text-xl font-semibold sm:text-4xl">选择更适合经营阶段的版本</h2>
          <p className="mx-auto mt-3 max-w-2xl text-xs text-white/65 sm:text-base">
            普通版适合先把业务跑起来，高级版适合把库存、利润、品牌和团队管理做得更专业。
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-[#232323] p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] sm:rounded-[28px] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-semibold sm:text-4xl">普通版</div>
                <div className="mt-6 flex items-end gap-2 sm:mt-8">
                  <span className="text-5xl font-semibold leading-none sm:text-6xl">¥0</span>
                  <span className="pb-1 text-sm text-white/60">/ 月</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/80 sm:mt-6 sm:text-base">先把订单和客户管理跑顺，适合初期使用。</p>
            <div className="mt-4 rounded-full border border-white/10 px-4 py-2.5 text-center text-sm text-white/45 sm:mt-6 sm:py-3">
              当前默认套餐
            </div>
            <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
              {STANDARD_FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-3 text-sm text-white/90">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <p className="mt-8 text-xs text-white/35 sm:mt-12">
              适合刚起步团队，先建立订单、客户和跟进数据。
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[24px] border border-[#90c8ff] bg-[linear-gradient(180deg,#2c4e76_0%,#24384f_100%)] p-4 text-white shadow-[0_0_0_1px_rgba(144,200,255,0.35),0_0_40px_rgba(77,154,255,0.35)] sm:rounded-[28px] sm:p-6">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(120,190,255,0.25),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_35%)]"
              aria-hidden
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-3xl font-semibold sm:text-4xl">高级版</div>
                  <div className="mt-6 flex items-end gap-2 sm:mt-8 sm:gap-3">
                    <span className="text-2xl text-white/35 line-through">¥29</span>
                    <span className="text-5xl font-semibold leading-none sm:text-6xl">¥0</span>
                    <span className="pb-1 text-sm text-white/75">首月试用</span>
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80">
                  限时体验
                </div>
              </div>

              <p className="mt-4 text-sm text-white/90 sm:mt-6 sm:text-base">
                更适合真正拿来经营生意：库存更准，利润更清，客户体验更专业。
              </p>

              <Button
                onClick={onStartTrial}
                disabled={starting}
                className="mt-5 h-11 w-full rounded-full bg-[#4ea9ff] text-sm font-medium text-white hover:bg-[#3699f5] sm:mt-6 sm:h-12 sm:text-base"
              >
                <Crown className="mr-2 h-4 w-4" />
                {starting ? "开启中..." : "领取免费试用"}
              </Button>

              <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
                {PREMIUM_FEATURES.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-3 text-sm text-white/95">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#99d1ff]" />
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              <p className="mt-8 text-xs leading-5 text-white/55 sm:mt-10">
                试用结束后可继续按月使用，年付折合仅
                <span className="mx-1 font-semibold text-white">¥20/月</span>
                。适合需要精细库存、销售提成、利润分析和品牌展示的团队。
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center pb-2 sm:mt-8">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-white/60 underline-offset-4 transition hover:text-white hover:underline"
          >
            暂不体验，继续使用普通版
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
