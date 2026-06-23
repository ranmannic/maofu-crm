import type { PaymentStatus } from "@/generated/prisma/client";

export function calcProductCostTotal(
  items: { quantity: number; unitCost: number }[]
) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
}

export function calcCalculatedAmount(
  items: { quantity: number; unitPrice: number }[]
) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function calcOrderTotalAmount(
  productAmount: number,
  shippingFee: number,
  otherFee: number
) {
  return productAmount + shippingFee + otherFee;
}

/** 业绩金额：不含运费与其它费用 */
export function calcPerformanceAmount(
  totalAmount: number,
  shippingFee: number,
  otherFee: number
) {
  return Math.max(0, totalAmount - shippingFee - otherFee);
}

export function calcOrderProfit(
  totalAmount: number,
  productCostTotal: number,
  shippingFee = 0,
  otherFee = 0
) {
  return (
    calcPerformanceAmount(totalAmount, shippingFee, otherFee) - productCostTotal
  );
}

export function calcProfitMargin(revenue: number, profit: number) {
  if (revenue <= 0) return 0;
  return (profit / revenue) * 100;
}

export function derivePaymentStatus(
  paidAmount: number,
  totalAmount: number
): PaymentStatus {
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount >= totalAmount) return "PAID";
  return "PARTIAL";
}

export function syncPaymentFields(
  paymentStatus: PaymentStatus,
  paidAmount: number,
  totalAmount: number
) {
  let amount = paidAmount;
  if (paymentStatus === "UNPAID") amount = 0;
  else if (paymentStatus === "PAID") amount = totalAmount;
  else amount = Math.min(Math.max(0, paidAmount), totalAmount);

  const status = derivePaymentStatus(amount, totalAmount);
  return {
    paymentStatus: status,
    paidAmount: amount,
    isPaid: status === "PAID",
    paidAt: amount > 0 ? new Date() : null,
  };
}

export function formatItemsSummary(
  items: {
    productName: string;
    quantity: number;
    unitType: string;
    isGift?: boolean;
  }[],
  unitLabels: Record<string, string>
) {
  return items
    .map(
      (i) =>
        `${i.productName}${i.isGift ? "（赠）" : ""}×${i.quantity}${unitLabels[i.unitType] || ""}`
    )
    .join("、");
}
