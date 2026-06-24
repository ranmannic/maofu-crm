"use client";

import { ChannelPieChart } from "@/components/dashboard/channel-pie-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface CategoryPerformance {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  orderCount: number;
  channels: { channel: string; orderCount: number; amount: number }[];
}

export function CategoryPerformanceSection({
  data,
  hidden,
}: {
  data: CategoryPerformance[];
  hidden?: boolean;
}) {
  const active = data.filter((d) => d.totalAmount > 0 || d.orderCount > 0);

  if (active.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">一级渠道业绩统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted text-sm font-serif">
            暂无数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-serif font-bold">一级渠道业绩统计</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {active.map((category) => (
          <div key={category.categoryId} className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h3 className="font-serif font-medium">{category.categoryName}</h3>
                <p className="text-sm text-muted">
                  {hidden ? "****" : formatCurrency(category.totalAmount)} ·{" "}
                  {hidden ? "**" : `${category.orderCount} 单`}
                </p>
              </div>
            </div>
            <div className={hidden ? "blur-md pointer-events-none select-none" : ""}>
              <ChannelPieChart
                title={`${category.categoryName} · 二级渠道占比`}
                data={category.channels.map((c) => ({
                  name: c.channel,
                  value: c.amount,
                }))}
                formatValue={(v) => formatCurrency(v)}
              />
            </div>
            <Card>
              <CardContent className="table-scroll">
                <table className="w-full text-sm ink-table">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-2">二级渠道</th>
                      <th className="pb-2">订单数</th>
                      <th className="pb-2">业绩金额</th>
                      <th className="pb-2">占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.channels.map((row) => (
                      <tr key={row.channel} className="border-b border-border/40">
                        <td className="py-2">{row.channel}</td>
                        <td className="py-2">{hidden ? "**" : row.orderCount}</td>
                        <td className="py-2">
                          {hidden ? "****" : formatCurrency(row.amount)}
                        </td>
                        <td className="py-2">
                          {hidden
                            ? "**"
                            : category.totalAmount > 0
                              ? `${((row.amount / category.totalAmount) * 100).toFixed(1)}%`
                              : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
