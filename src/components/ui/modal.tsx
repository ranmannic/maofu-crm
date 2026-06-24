"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./button";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl",
          "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto",
          className
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="pr-2 text-base font-semibold sm:text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 form-fill">{children}</div>
      </div>
    </div>
  );
}

export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-4 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}

export { Button };
