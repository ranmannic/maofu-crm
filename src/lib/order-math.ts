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

export function calcOrderProfit(totalAmount: number, productCostTotal: number) {
  return totalAmount - productCostTotal;
}

export function calcProfitMargin(totalAmount: number, profit: number) {
  if (totalAmount <= 0) return 0;
  return (profit / totalAmount) * 100;
}

export function formatItemsSummary(
  items: {
    productName: string;
    quantity: number;
    unitType: string;
  }[],
  unitLabels: Record<string, string>
) {
  return items
    .map(
      (i) =>
        `${i.productName}×${i.quantity}${unitLabels[i.unitType] || ""}`
    )
    .join("、");
}
