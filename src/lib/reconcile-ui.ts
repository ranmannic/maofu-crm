export function calcReconcilePaidAmount(
  items: { id: string; unitPrice: number; isGift?: boolean }[],
  existingPaid: number,
  qtyMap: Record<string, number>
) {
  const sessionAmount = items.reduce((sum, item) => {
    const qty = qtyMap[item.id] ?? 0;
    if (qty <= 0 || item.isGift) return sum;
    return sum + item.unitPrice * qty;
  }, 0);
  return Math.round((existingPaid + sessionAmount) * 100) / 100;
}

export function calcCreateReconcilePaidAmount(
  items: { productSpecId: string; isGift?: boolean; unitPrice?: number }[],
  specPrices: Map<string, number>,
  qtyMap: Record<number, number>
) {
  const sessionAmount = items.reduce((sum, item, idx) => {
    const qty = qtyMap[idx] ?? 0;
    if (qty <= 0 || item.isGift) return sum;
    const price = item.unitPrice ?? specPrices.get(item.productSpecId) ?? 0;
    return sum + price * qty;
  }, 0);
  return Math.round(sessionAmount * 100) / 100;
}

/** 账期行均已核销数量时，视为产品已全部核销（可仅按实收金额补记业绩） */
export function allProductsFullyReconciled(
  lines: { unreconciledQty: number }[] | null | undefined
): boolean {
  if (!lines || lines.length === 0) return false;
  return lines.every((l) => l.unreconciledQty <= 0);
}

export type ReconcilePaymentLine = {
  unitPrice: number;
  isGift?: boolean;
  unreconciledQty: number;
};

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** 未核销产品按标准单价折算的金额 */
export function calcUnreconciledProductAmount(
  lines: ReconcilePaymentLine[]
): number {
  return roundMoney(
    lines.reduce((sum, line) => {
      if (line.isGift || line.unreconciledQty <= 0) return sum;
      return sum + line.unitPrice * line.unreconciledQty;
    }, 0)
  );
}

/**
 * 订单已收/未收与未核销产品金额不一致（常见于订单管理先登记收款、账期尚未核销）
 */
export function isCreditReconcilePaymentMismatch(
  totalAmount: number,
  paidAmount: number,
  lines: ReconcilePaymentLine[]
): boolean {
  const unpaid = roundMoney(Math.max(0, totalAmount - paidAmount));
  const unreconciledValue = calcUnreconciledProductAmount(lines);
  return Math.abs(unreconciledValue - unpaid) > 0.02;
}

export const RECONCILE_PAYMENT_MISMATCH_HINT =
  "未核销数量与收款情况不匹配，请您自行设置本次核销数量和核销金额，不再为您自动计算";
