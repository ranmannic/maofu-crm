"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { YoYCurveChart } from "@/components/dashboard/yoy-chart";
import { ChannelPieChart } from "@/components/dashboard/channel-pie-chart";
import { formatCurrency } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth-types";

interface StatsData {
  orderStats: {
    total: number;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    shippedCount: number;
    unshippedCount: number;
    totalProfit?: number;
  };
  customerStats: {
    total: number;
    byChannel: { channel: string; count: number }[];
  };
  channelStats: {
    channel: string;
    orderCount: number;
    amount: number;
    customerCount: number;
  }[];
  salesStats?: {
    salesId: string;
    salesName: string;
    orderCount: number;
    totalAmount: number;
    paidAmount: number;
    profit: number;
  }[];
  monthlyCurves: {
    performance: { month: string; currentYear: number; lastYear: number }[];
    newCustomers: { month: string; currentYear: number; lastYear: number }[];
    churnCustomers: { month: string; currentYear: number; lastYear: number }[];
  };
  salesUsers?: { id: string; name: string }[];
}

export function DashboardPage({ user }: { user: SessionUser }) {
  const isAdmin = user.role === "ADMIN";
  const [period, setPeriod] = useState(isAdmin ? "day" : "month");
  const [salesId, setSalesId] = useState("");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ period });
      if (salesId) params.set("salesId", salesId);
      const res = await fetch(`/api/stats?${params}`);
      if (res.ok) setStats(await res.json());
      setLoading(false);
    }
    load();
  }, [period, salesId]);

  const customerPieData =
    stats?.customerStats.byChannel.map((c) => ({
      name: c.channel,
      value: c.count,
    })) ?? [];

  const performancePieData =
    stats?.channelStats.map((c) => ({
      name: c.channel,
      value: c.amount,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-wide">
            数据概览
          </h1>
          <p className="text-muted text-sm mt-1 font-serif">
            {isAdmin ? "全站经营数据与同比分析" : "我的客户与业绩分析"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && stats?.salesUsers && (
            <Select
              value={salesId}
              onChange={(e) => setSalesId(e.target.value)}
              className="w-36"
            >
              <option value="">全部销售</option>
              {stats.salesUsers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-28"
          >
            {isAdmin && <option value="day">今日</option>}
            <option value="month">本月</option>
            {isAdmin && <option value="year">本年</option>}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted font-serif">加载中...</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="订单数" value={String(stats.orderStats.total)} />
            <StatCard
              title="订单总额"
              value={formatCurrency(stats.orderStats.totalAmount)}
            />
            <StatCard
              title="已收款"
              value={formatCurrency(stats.orderStats.paidAmount)}
            />
            {isAdmin && stats.orderStats.totalProfit !== undefined && (
              <StatCard
                title="订单毛利"
                value={formatCurrency(stats.orderStats.totalProfit)}
                highlight
              />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChannelPieChart
              title="客户渠道分布"
              data={customerPieData}
            />
            <ChannelPieChart
              title="业绩渠道分布"
              data={performancePieData}
              formatValue={(v) => formatCurrency(v)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <YoYCurveChart
              title="业绩曲线"
              data={stats.monthlyCurves.performance}
              valueLabel="订单金额"
              formatValue={(v) => formatCurrency(v)}
            />
            <YoYCurveChart
              title="新增客户曲线"
              data={stats.monthlyCurves.newCustomers}
              valueLabel="新增客户数"
            />
            <YoYCurveChart
              title="流失客户曲线"
              data={stats.monthlyCurves.churnCustomers}
              valueLabel="流失客户数"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif">渠道数据统计</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm ink-table">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-3">渠道</th>
                    <th className="pb-3">客户数</th>
                    <th className="pb-3">订单数</th>
                    <th className="pb-3">订单金额</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.channelStats.map((row) => (
                    <tr key={row.channel} className="border-b border-border/40">
                      <td className="py-3 font-medium">{row.channel}</td>
                      <td className="py-3">{row.customerCount}</td>
                      <td className="py-3">{row.orderCount}</td>
                      <td className="py-3">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  {stats.channelStats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted">
                        暂无数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {isAdmin && stats.salesStats && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">销售业绩</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm ink-table">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-3">销售</th>
                      <th className="pb-3">订单数</th>
                      <th className="pb-3">订单金额</th>
                      <th className="pb-3">已收款</th>
                      <th className="pb-3">毛利</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.salesStats.map((row) => (
                      <tr key={row.salesId} className="border-b border-border/40">
                        <td className="py-3">{row.salesName}</td>
                        <td className="py-3">{row.orderCount}</td>
                        <td className="py-3">{formatCurrency(row.totalAmount)}</td>
                        <td className="py-3">{formatCurrency(row.paidAmount)}</td>
                        <td className="py-3 text-wine font-medium">
                          {formatCurrency(row.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  title,
  value,
  highlight,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted font-serif">{title}</p>
        <p
          className={`text-2xl font-serif font-bold mt-1 ${highlight ? "text-wine" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
