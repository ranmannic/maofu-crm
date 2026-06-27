/** 按月度固定成本，按所选日期范围内各天占当月比例分摊 */
export function calcProratedFixedCost(
  monthlyFixedCost: number,
  start: Date,
  end: Date
): number {
  if (monthlyFixedCost <= 0) return 0;

  let total = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  while (cursor <= endDay) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthEnd = new Date(year, month + 1, 0);
    monthEnd.setHours(0, 0, 0, 0);
    const segmentEnd = monthEnd < endDay ? monthEnd : endDay;

    const daysInSegment =
      Math.floor(
        (segmentEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

    total += monthlyFixedCost * (daysInSegment / daysInMonth);

    cursor.setFullYear(year, month + 1, 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return Math.round(total * 100) / 100;
}

export function describeFixedCostPeriod(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${fmt(start)} 至 ${fmt(end)}`;
}
