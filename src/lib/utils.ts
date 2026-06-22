import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(amount);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateOrderNo() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `MF${date}${rand}`;
}

export function calcOrderProfit(
  totalAmount: number,
  productCostTotal: number
) {
  return totalAmount - productCostTotal;
}

/** @deprecated use calcOrderProfit(totalAmount, productCostTotal) */
export function calcOrderProfitFromItems(
  items: { quantity: number; unitPrice: number; unitCost: number }[]
) {
  const revenue = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const cost = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  return revenue - cost;
}

export type Period = "day" | "month" | "year" | "custom";

export function getDateRange(
  period: Period,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === "custom" && customStart && customEnd) {
    return {
      start: new Date(customStart + "T00:00:00"),
      end: new Date(customEnd + "T23:59:59"),
    };
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "month") {
    start.setDate(1);
  } else if (period === "year") {
    start.setMonth(0, 1);
  }

  return { start, end };
}
