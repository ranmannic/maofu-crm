"use client";

import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("filter-field flex flex-col gap-1 min-w-0", className)}>
      <Label className="text-xs text-muted font-serif mb-0">{label}</Label>
      {children}
    </div>
  );
}
