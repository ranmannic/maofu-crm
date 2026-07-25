"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SeriesMeta = {
  productSpecId: string;
  label: string;
  unitLabel: string;
  totalQty: number;
};

type ChartRow = Record<string, string | number>;

const COLORS = [
  "#8b2e2e",
  "#4361ee",
  "#2a9d8f",
  "#e9c46a",
  "#f4a261",
  "#6d597a",
  "#118ab2",
  "#ef476f",
  "#073b4c",
  "#06d6a0",
];

export function CustomerPurchaseChart({ customerId }: { customerId: string }) {
  const [granularity, setGranularity] = useState<"month" | "year">("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [series, setSeries] = useState<SeriesMeta[]>([]);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const load = useCallback(async (g: "month" | "year") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/customers/${customerId}/purchase-stats?granularity=${g}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "加载失败");
        return;
      }
      setSeries(data.series ?? []);
      setChartData(data.chartData ?? []);
      setHidden({});
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load(granularity);
  }, [load, granularity]);

  const visibleSeries = useMemo(
    () => series.filter((s) => !hidden[s.productSpecId]),
    [series, hidden]
  );

  const chartHeight = Math.min(360, Math.max(220, 180 + visibleSeries.length * 8));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="font-serif text-base">拿货仪表盘</CardTitle>
          <div className="inline-flex rounded-sm border border-border overflow-hidden self-start">
            <button
              type="button"
              onClick={() => setGranularity("month")}
              className={cn(
                "px-3 py-1.5 text-xs font-serif",
                granularity === "month"
                  ? "bg-wine text-paper"
                  : "bg-paper text-muted hover:bg-black/5"
              )}
            >
              按月
            </button>
            <button
              type="button"
              onClick={() => setGranularity("year")}
              className={cn(
                "px-3 py-1.5 text-xs font-serif border-l border-border",
                granularity === "year"
                  ? "bg-wine text-paper"
                  : "bg-paper text-muted hover:bg-black/5"
              )}
            >
              按年
            </button>
          </div>
        </div>
        <p className="text-xs text-muted mt-1">
          各规格拿货数量折线；时间轴从最早拿货{granularity === "month" ? "月份" : "年份"}起算
        </p>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {loading ? (
          <div className="text-center py-10 text-muted text-sm">加载中...</div>
        ) : series.length === 0 ? (
          <div className="text-center py-10 text-muted text-sm">暂无拿货记录</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {series.map((s, i) => {
                const color = COLORS[i % COLORS.length];
                const isHidden = !!hidden[s.productSpecId];
                return (
                  <button
                    key={s.productSpecId}
                    type="button"
                    onClick={() =>
                      setHidden((prev) => ({
                        ...prev,
                        [s.productSpecId]: !prev[s.productSpecId],
                      }))
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-opacity",
                      isHidden ? "opacity-40 border-border" : "border-border bg-paper"
                    )}
                    title={`${s.label} · 合计 ${s.totalQty}${s.unitLabel}`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="max-w-[9rem] sm:max-w-[14rem] truncate">
                      {s.label}
                    </span>
                    <span className="text-muted tabular-nums">
                      {s.totalQty}
                      {s.unitLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="w-full overflow-x-auto -mx-1 px-1">
              <div
                className="min-w-[280px]"
                style={{
                  width: "100%",
                  minWidth:
                    granularity === "month" && chartData.length > 12
                      ? Math.max(320, chartData.length * 36)
                      : undefined,
                }}
              >
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d8" vertical={false} />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 10, fill: "#6e655c" }}
                      axisLine={{ stroke: "#d9cfc0" }}
                      tickLine={false}
                      interval={granularity === "month" ? "preserveStartEnd" : 0}
                      minTickGap={granularity === "month" ? 28 : 8}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#6e655c" }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const meta = series.find((s) => s.productSpecId === name);
                        return [
                          `${Number(value)}${meta?.unitLabel || ""}`,
                          meta?.label || String(name),
                        ];
                      }}
                      labelFormatter={(label) =>
                        granularity === "month" ? `${label}` : `${label} 年`
                      }
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #d9cfc0",
                        fontSize: 12,
                        maxWidth: 260,
                      }}
                    />
                    {visibleSeries.map((s) => {
                      const colorIdx = series.findIndex(
                        (x) => x.productSpecId === s.productSpecId
                      );
                      return (
                        <Line
                          key={s.productSpecId}
                          type="monotone"
                          dataKey={s.productSpecId}
                          name={s.productSpecId}
                          stroke={COLORS[colorIdx % COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 2.5, strokeWidth: 0 }}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {visibleSeries.length === 0 && (
              <p className="text-center text-xs text-muted">
                已隐藏全部规格，点击上方标签可重新显示
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
