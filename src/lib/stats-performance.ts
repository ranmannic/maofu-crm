/** 与 stats API 共用的周期业绩汇总 */
export function summarizePeriodPerformance(
  orders: {
    productAmount: number;
    performanceRecords: { amount: number }[];
  }[]
) {
  return orders.reduce(
    (acc, order) => {
      const maxPerf = Number(order.productAmount) || 0;
      const collected = order.performanceRecords.reduce(
        (s, r) => s + (Number(r.amount) || 0),
        0
      );
      const capped = Math.min(collected, maxPerf);
      acc.total += maxPerf;
      acc.collected += capped;
      acc.uncollected += Math.max(0, maxPerf - capped);
      return acc;
    },
    { total: 0, collected: 0, uncollected: 0 }
  );
}
