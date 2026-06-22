"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CurvePoint {
  month: string;
  currentYear: number;
  lastYear: number;
}

export function YoYCurveChart({
  title,
  data,
  valueLabel,
  formatValue,
}: {
  title: string;
  data: CurvePoint[];
  valueLabel: string;
  formatValue?: (v: number) => string;
}) {
  const fmt = formatValue || ((v: number) => String(v));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d9cfc0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value, name) => [
                fmt(Number(value)),
                name === "currentYear" ? "今年" : "去年同期",
              ]}
            />
            <Legend
              formatter={(value) =>
                value === "currentYear" ? "今年" : "去年同期"
              }
            />
            <Line
              type="monotone"
              dataKey="currentYear"
              name="currentYear"
              stroke="#8b2e2e"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="lastYear"
              name="lastYear"
              stroke="#6e655c"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted mt-2 text-center font-serif">
          {valueLabel} · 按月对比
        </p>
      </CardContent>
    </Card>
  );
}
