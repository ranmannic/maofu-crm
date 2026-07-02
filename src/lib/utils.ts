import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 库存数量（升等）保留小数位，避免浮点误差 */
export function roundStockQty(value: number, decimals = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

export function formatStockQty(value: number, allowDecimal = false) {
  const n = roundStockQty(value);
  if (!allowDecimal || Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, "");
}

export function formatCurrency(amount: number) {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(safe);
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
  productCostTotal: number,
  shippingFee = 0,
  otherFee = 0
) {
  const performanceAmount = Math.max(0, totalAmount - shippingFee - otherFee);
  return performanceAmount - productCostTotal;
}

export function calcPerformanceAmount(
  totalAmount: number,
  shippingFee: number,
  otherFee: number
) {
  return Math.max(0, totalAmount - shippingFee - otherFee);
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
