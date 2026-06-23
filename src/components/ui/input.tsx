"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useState } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-wine focus:ring-2 focus:ring-wine/20",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

/** 数量输入：编辑时不保留前置 0，空值视为 0 */
export function QtyInput({
  value,
  onChange,
  min = 0,
  max,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const display =
    draft !== null ? draft : value === 0 ? "" : String(value);

  function commit(raw: string) {
    if (raw === "") {
      onChange(0);
      return;
    }
    let n = parseInt(raw, 10);
    if (Number.isNaN(n)) n = 0;
    if (n < min) n = min;
    if (max !== undefined && n > max) n = max;
    onChange(n);
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      className={className}
      onFocus={(e) => {
        setDraft(value === 0 ? "" : String(value));
        e.target.select();
      }}
      onBlur={() => {
        if (draft !== null) commit(draft);
        setDraft(null);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "");
        setDraft(raw);
        if (raw !== "") commit(raw);
        else onChange(0);
      }}
      {...props}
    />
  );
}

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-wine focus:ring-2 focus:ring-wine/20",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-wine focus:ring-2 focus:ring-wine/20 min-h-[80px]",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({
  children,
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-sm font-medium text-foreground mb-1", className)}
      {...props}
    >
      {children}
    </label>
  );
}
