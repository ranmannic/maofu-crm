"use client";

import { useEffect, useRef, useState } from "react";
import {
  SceneQuote,
  WORKFLOW_CAPTIONS,
  WORKFLOW_LABELS,
  WORKFLOW_SCENES,
} from "@/components/welcome/workflow-line-scenes";
import { cn } from "@/lib/utils";

const STEP_MS = 2400;
const QUOTE_MS = 4000;

export function CrmWorkflowAnimation() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showQuote, setShowQuote] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const stepRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stepTimer: ReturnType<typeof setTimeout>;
    let quoteTimer: ReturnType<typeof setTimeout>;

    function scheduleStep(index: number) {
      if (index >= WORKFLOW_SCENES.length) {
        setShowQuote(true);
        setSceneKey((k) => k + 1);
        quoteTimer = setTimeout(() => {
          setShowQuote(false);
          setActiveIndex(0);
          setSceneKey((k) => k + 1);
          scheduleStep(0);
        }, QUOTE_MS);
        return;
      }

      setActiveIndex(index);
      setSceneKey((k) => k + 1);
      stepTimer = setTimeout(() => scheduleStep(index + 1), STEP_MS);
    }

    scheduleStep(0);

    return () => {
      clearTimeout(stepTimer);
      clearTimeout(quoteTimer);
    };
  }, []);

  useEffect(() => {
    if (showQuote) return;
    const container = scrollRef.current;
    const el = stepRefs.current[activeIndex];
    if (!container || !el) return;
    const targetLeft = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [activeIndex, showQuote]);

  const progress = showQuote
    ? 100
    : ((activeIndex + 1) / WORKFLOW_SCENES.length) * 100;

  const ActiveScene = showQuote ? null : WORKFLOW_SCENES[activeIndex];

  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-[#90c8ff]/40 bg-[linear-gradient(165deg,#ffffff_0%,#eef4fb_55%,#e3edf7_100%)] shadow-[0_8px_32px_rgba(44,78,118,0.08)]">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#4ea9ff]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-[#2c4e76]/8 blur-3xl"
        aria-hidden
      />

      <div className="relative overflow-hidden p-4 sm:p-6">
        <div
          className="wf-stage relative mx-auto w-full overflow-hidden rounded-xl border border-[#c5d5e8]/80 bg-white/60"
          aria-live="polite"
          aria-label={showQuote ? "有 YesCRM 帮忙，一切都变简单了" : WORKFLOW_LABELS[activeIndex]}
        >
          <div className="relative aspect-[2/1] w-full">
            <div key={sceneKey} className="wf-scene-enter absolute inset-0">
              {showQuote ? <SceneQuote /> : ActiveScene && <ActiveScene />}
            </div>
          </div>
        </div>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#d8e4f0]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4ea9ff] to-[#2c4e76] transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          ref={scrollRef}
          className="mt-4 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-max gap-2 sm:min-w-0 sm:justify-between">
            {WORKFLOW_LABELS.map((label, index) => {
              const isActive = !showQuote && activeIndex === index;
              const isDone = showQuote || activeIndex > index;

              return (
                <button
                  key={label}
                  ref={(el) => {
                    stepRefs.current[index] = el;
                  }}
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  className={cn(
                    "flex shrink-0 flex-col items-center gap-1.5 transition-opacity duration-500",
                    "w-[4.5rem] sm:w-auto sm:flex-1",
                    !isActive && !isDone && !showQuote && "opacity-40"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold sm:h-8 sm:w-8 sm:text-xs",
                      isActive &&
                        "border-[#4ea9ff] bg-[#4ea9ff] text-white shadow-[0_0_12px_rgba(78,169,255,0.5)]",
                      isDone && !showQuote && "border-[#4ea9ff]/50 bg-[#4ea9ff]/15 text-[#4ea9ff]",
                      showQuote && "border-[#4ea9ff]/50 bg-[#4ea9ff]/15 text-[#4ea9ff]",
                      !isActive && !isDone && !showQuote && "border-[#c5d5e8] bg-white text-[#94a3b8]"
                    )}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={cn(
                      "max-w-[4.5rem] text-center text-[10px] leading-tight sm:max-w-none sm:text-xs",
                      isActive && "font-medium text-[#2c4e76]",
                      (isDone || showQuote) && "text-[#4ea9ff]",
                      !isActive && !isDone && !showQuote && "text-[#94a3b8]"
                    )}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 min-h-[56px] rounded-xl border border-[#90c8ff]/25 bg-white/80 px-4 py-3">
          {showQuote ? (
            <p className="welcome-step-in text-center text-sm font-medium leading-relaxed text-[#24384f] sm:text-base">
              有 <span className="text-[#4ea9ff]">YesCRM</span> 帮忙，一切都变简单了
            </p>
          ) : (
            <div key={activeIndex} className="welcome-step-in text-center sm:text-left">
              <p className="text-sm font-semibold text-[#2c4e76]">{WORKFLOW_LABELS[activeIndex]}</p>
              <p className="mt-0.5 text-xs text-[#64748b] sm:text-sm">
                {WORKFLOW_CAPTIONS[activeIndex]}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
