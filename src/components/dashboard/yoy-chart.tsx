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
  Area,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEdition } from "@/components/edition/edition-provider";

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
  const { isPremiumActive } = useEdition();
  const fmt = formatValue || ((v: number) => String(v));

  const legendFormatter = (value: string) =>
    value === "currentYear" ? "今年" : "去年同期";

  if (isPremiumActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="yoyCurrentFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b7cfa" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#5b7cfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#edf0f5"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#8a90a2" }}
                axisLine={{ stroke: "#edf0f5" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#8a90a2" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => [
                  fmt(Number(value)),
                  name === "currentYear" ? "今年" : "去年同期",
                ]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #edf0f5",
                  boxShadow: "0 8px 24px rgba(31, 36, 51, 0.08)",
                  fontSize: 12,
                }}
              />
              <Legend formatter={legendFormatter} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="currentYear"
                name="currentYear"
                stroke="none"
                fill="url(#yoyCurrentFill)"
                legendType="none"
                tooltipType="none"
              />
              <Line
                type="monotone"
                dataKey="currentYear"
                name="currentYear"
                stroke="#4361ee"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#4361ee", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="lastYear"
                name="lastYear"
                stroke="#c3cbe0"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 2, fill: "#c3cbe0", strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted mt-2 text-center font-serif">
            {valueLabel} · 按月对比
          </p>
        </CardContent>
      </Card>
    );
  }

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
            <Legend formatter={legendFormatter} />
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
