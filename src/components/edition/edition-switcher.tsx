"use client";

import { useState } from "react";
import { Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { EDITION_LABELS, type EditionKind } from "@/lib/edition-types";
import { useEdition } from "@/components/edition/edition-provider";
import { PremiumExperienceModal } from "@/components/edition/premium-experience-modal";
import type { SessionUser } from "@/lib/auth-types";

export function EditionSwitcher({
  user,
  className,
  layout = "inline",
}: {
  user: SessionUser;
  className?: string;
  layout?: "inline" | "stacked";
}) {
  const {
    edition,
    premiumAccess,
    loading,
    switchEdition,
    startTrial,
  } = useEdition();
  const [modalOpen, setModalOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  if (loading || user.role !== "ADMIN") return null;

  async function handleSwitch(next: EditionKind) {
    if (next === edition) return;
    if (next === "PREMIUM" && !premiumAccess) {
      setModalOpen(true);
      return;
    }
    await switchEdition(next);
  }

  async function handleStartTrial() {
    setStarting(true);
    const ok = await startTrial();
    setStarting(false);
    if (ok) setModalOpen(false);
  }

  return (
    <>
      <div
        className={cn(
          "inline-flex items-center rounded-full border border-border bg-paper p-0.5 text-xs shadow-sm",
          layout === "stacked" && "w-full",
          className
        )}
      >
        {(["STANDARD", "PREMIUM"] as EditionKind[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleSwitch(key)}
            className={cn(
              "rounded-full px-3 py-1.5 font-medium transition-colors",
              layout === "stacked" && "flex-1 text-center",
              edition === key
                ? key === "PREMIUM"
                  ? "bg-[#5b7cfa] text-white"
                  : "bg-wine text-white"
                : "text-muted hover:text-foreground"
            )}
          >
            {key === "PREMIUM" && (
              <Crown className="inline h-3 w-3 mr-1 -mt-0.5" />
            )}
            {EDITION_LABELS[key]}
          </button>
        ))}
      </div>

      <PremiumExperienceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onStartTrial={handleStartTrial}
        starting={starting}
      />
    </>
  );
}

export function EditionBadge() {
  const { isPremiumActive, loading } = useEdition();
  if (loading || !isPremiumActive) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#5b7cfa]/10 px-2 py-0.5 text-[10px] font-medium text-[#5b7cfa]">
      <Sparkles className="h-3 w-3" />
      高级版
    </span>
  );
}
