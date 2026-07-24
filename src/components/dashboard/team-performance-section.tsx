"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export type TeamPerformanceRow = {
  managerId: string | null;
  teamName: string;
  managerName: string | null;
  memberCount: number;
  orderCount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
};

export function TeamPerformanceSection({
  teams,
  hidden,
  highlightManagerId,
}: {
  teams: TeamPerformanceRow[];
  hidden?: boolean;
  highlightManagerId?: string | null;
}) {
  if (hidden) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-serif">各小队业绩</CardTitle>
      </CardHeader>
      <CardContent>
        {teams.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center font-serif">
            暂无小队数据
          </p>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm ink-table">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 pr-2">小队</th>
                  <th className="pb-2 pr-2">负责人</th>
                  <th className="pb-2 pr-2 text-right">人数</th>
                  <th className="pb-2 pr-2 text-right">订单</th>
                  <th className="pb-2 pr-2 text-right">业绩总额</th>
                  <th className="pb-2 pr-2 text-right">已收</th>
                  <th className="pb-2 text-right">未收</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const key = t.managerId ?? "unassigned";
                  const highlight =
                    highlightManagerId && t.managerId === highlightManagerId;
                  return (
                    <tr
                      key={key}
                      className={`border-b border-border/40 ${highlight ? "bg-wine/5" : ""}`}
                    >
                      <td className="py-2 pr-2 font-medium">{t.teamName}</td>
                      <td className="py-2 pr-2 text-muted">
                        {t.managerName ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-right">{t.memberCount}</td>
                      <td className="py-2 pr-2 text-right">{t.orderCount}</td>
                      <td className="py-2 pr-2 text-right">
                        {formatCurrency(t.totalAmount)}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {formatCurrency(t.paidAmount)}
                      </td>
                      <td className="py-2 text-right">
                        {formatCurrency(t.unpaidAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
