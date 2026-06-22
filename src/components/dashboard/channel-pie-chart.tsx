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

const COLORS = [
  "#8b2e2e",
  "#6e655c",
  "#a67c3d",
  "#4a5d4a",
  "#5c4a6e",
  "#8b6914",
  "#3d5a6c",
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
  const fmt = formatValue || ((v: number) => String(v));
  const chartData = data.filter((d) => d.value > 0);

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
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: "#6e655c" }}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => fmt(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
