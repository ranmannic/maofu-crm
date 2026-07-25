"use client";

import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEdition } from "@/components/edition/edition-provider";
import { cn } from "@/lib/utils";

const STANDARD_COLORS = [
  "#8b2e2e",
  "#6e655c",
  "#a67c3d",
  "#4a5d4a",
  "#5c4a6e",
  "#8b6914",
  "#3d5a6c",
  "#7a4e3a",
  "#4a6e6a",
  "#6e5c4a",
];

const PREMIUM_COLORS = [
  "#4361ee",
  "#5b7cfa",
  "#22b8cf",
  "#e0a83e",
  "#845ef7",
  "#2dd4a7",
  "#7c9cff",
  "#f06595",
  "#15aabf",
  "#7950f2",
];

/** 过小的切片合并为「其他」，避免图例过长难读 */
const OTHER_THRESHOLD = 0.03;
const MAX_SLICES = 8;

type Slice = {
  name: string;
  value: number;
  percent: number;
  color: string;
  isOther?: boolean;
};

export function ChannelPieChart({
  title,
  data,
  formatValue,
}: {
  title: string;
  data: { name: string; value: number }[];
  formatValue?: (v: number) => string;
}) {
  const { isPremiumActive } = useEdition();
  const fmt = formatValue || ((v: number) => String(v));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const colors = isPremiumActive ? PREMIUM_COLORS : STANDARD_COLORS;

  const { slices, total } = useMemo(() => {
    const raw = data
      .filter((d) => d.value > 0)
      .map((d) => ({ name: d.name || "未分类", value: d.value }))
      .sort((a, b) => b.value - a.value);

    const sum = raw.reduce((s, d) => s + d.value, 0);
    if (sum <= 0) return { slices: [] as Slice[], total: 0 };

    const majors: { name: string; value: number }[] = [];
    let otherValue = 0;

    raw.forEach((d, i) => {
      const pct = d.value / sum;
      if (i < MAX_SLICES && pct >= OTHER_THRESHOLD) {
        majors.push(d);
      } else {
        otherValue += d.value;
      }
    });

    if (otherValue > 0) {
      majors.push({ name: "其他", value: otherValue });
    }

    const slices: Slice[] = majors.map((d, i) => ({
      name: d.name,
      value: d.value,
      percent: d.value / sum,
      color: colors[i % colors.length]!,
      isOther: d.name === "其他",
    }));

    return { slices, total: sum };
  }, [data, colors]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-base">{title}</CardTitle>
        {total > 0 && (
          <p className="text-xs text-muted mt-1">
            合计 {fmt(total)}
            {slices.some((s) => s.isOther) ? " · 占比过小的渠道已合并为「其他」" : ""}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <div className="text-center py-16 text-muted text-sm font-serif">
            暂无数据
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* 饼图：不绘制外标，避免文字重叠 */}
            <div className="relative mx-auto h-[200px] w-full max-w-[220px] shrink-0 sm:mx-0 sm:h-[220px] sm:max-w-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="78%"
                    innerRadius={isPremiumActive ? "48%" : "0%"}
                    paddingAngle={slices.length > 1 ? 2 : 0}
                    stroke="#ffffff"
                    strokeWidth={2}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {slices.map((s, i) => (
                      <Cell
                        key={s.name}
                        fill={s.color}
                        opacity={
                          activeIndex === null || activeIndex === i ? 1 : 0.45
                        }
                        style={{
                          outline: "none",
                          filter:
                            activeIndex === i
                              ? "drop-shadow(0 2px 6px rgba(0,0,0,0.18))"
                              : undefined,
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [fmt(Number(value)), String(name)]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--ink-border, #d9cfc0)",
                      boxShadow: "0 8px 20px rgba(43, 38, 32, 0.08)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {isPremiumActive && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center leading-tight">
                    <div className="text-[10px] text-muted">合计</div>
                    <div className="text-sm font-semibold text-[#2c4e76] tabular-nums max-w-[5.5rem] truncate px-1">
                      {fmt(total)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 图例列表：完整展示名称、占比、数值 */}
            <ul className="min-w-0 flex-1 space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {slices.map((s, i) => (
                <li key={s.name}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                      activeIndex === i ? "bg-black/[0.04]" : "hover:bg-black/[0.03]"
                    )}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onFocus={() => setActiveIndex(i)}
                    onBlur={() => setActiveIndex(null)}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        s.isOther ? "text-muted" : "text-foreground"
                      )}
                      title={s.name}
                    >
                      {s.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted w-11 text-right">
                      {(s.percent * 100).toFixed(1)}%
                    </span>
                    <span className="shrink-0 text-sm tabular-nums font-medium w-[4.5rem] sm:w-[5.5rem] text-right">
                      {fmt(s.value)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
