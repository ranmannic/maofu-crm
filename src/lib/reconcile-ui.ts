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
  items: { productSpecId: string; isGift?: boolean }[],
  specPrices: Map<string, number>,
  qtyMap: Record<number, number>
) {
  const sessionAmount = items.reduce((sum, item, idx) => {
    const qty = qtyMap[idx] ?? 0;
    if (qty <= 0 || item.isGift) return sum;
    return sum + (specPrices.get(item.productSpecId) ?? 0) * qty;
  }, 0);
  return Math.round(sessionAmount * 100) / 100;
}

/** 账期行或核销项均未核销数量时，视为产品已全部核销（可仅收运费/其它费用） */
export function allProductsFullyReconciled(
  lines: { unreconciledQty: number }[] | null | undefined
): boolean {
  if (!lines || lines.length === 0) return false;
  return lines.every((l) => l.unreconciledQty <= 0);
}
