"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEdition } from "@/components/edition/edition-provider";

const STANDARD_COLORS = [
  "#8b2e2e",
  "#6e655c",
  "#a67c3d",
  "#4a5d4a",
  "#5c4a6e",
  "#8b6914",
  "#3d5a6c",
];

const PREMIUM_COLORS = [
  "#4361ee",
  "#5b7cfa",
  "#22b8cf",
  "#e0a83e",
  "#845ef7",
  "#2dd4a7",
  "#7c9cff",
];

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
  const chartData = data.filter((d) => d.value > 0);

  const colors = isPremiumActive ? PREMIUM_COLORS : STANDARD_COLORS;
  const labelLineStroke = isPremiumActive ? "#c3cbe0" : "#6e655c";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-16 text-muted text-sm font-serif">
            暂无数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={isPremiumActive ? 52 : 0}
                paddingAngle={isPremiumActive ? 2 : 0}
                stroke={isPremiumActive ? "#ffffff" : undefined}
                strokeWidth={isPremiumActive ? 2 : 1}
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: labelLineStroke }}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => fmt(Number(value))}
                contentStyle={
                  isPremiumActive
                    ? {
                        borderRadius: 12,
                        border: "1px solid #edf0f5",
                        boxShadow: "0 8px 24px rgba(31, 36, 51, 0.08)",
                        fontSize: 12,
                      }
                    : undefined
                }
              />
              <Legend
                iconType={isPremiumActive ? "circle" : undefined}
                wrapperStyle={
                  isPremiumActive
                    ? { fontSize: 12, color: "#8a90a2" }
                    : undefined
                }
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
