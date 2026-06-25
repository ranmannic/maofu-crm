"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Truck, Wallet, ClipboardList, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { getOpsTaskLabel, type OpsTask, type OpsTaskType } from "@/lib/ops-workbench-types";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;

const ICONS: Record<OpsTaskType, typeof Truck> = {
  UNSHIPPED: Truck,
  UNPAID: Wallet,
  PARTIAL_PAYMENT: AlertCircle,
  CREDIT_RECONCILE: ClipboardList,
};

const BADGE_VARIANT: Record<
  OpsTaskType,
  "default" | "warning" | "wine" | "success"
> = {
  UNSHIPPED: "warning",
  UNPAID: "wine",
  PARTIAL_PAYMENT: "default",
  CREDIT_RECONCILE: "wine",
};

export function OpsWorkbenchPage() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    unshipped: 0,
    unpaid: 0,
    partialPayment: 0,
    creditReconcile: 0,
    total: 0,
  });
  const [tasks, setTasks] = useState<OpsTask[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/workbench/ops?page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setStats(data.stats);
        if (data.tasks) setTasks(data.tasks);
        if (data.totalPages) setTotalPages(data.totalPages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-serif font-bold">职能工作台</h1>
        <p className="text-muted text-sm mt-1 font-serif">
          待发货、待收款、账期核销等待办事项一览
        </p>
      </div>

      <div className="stat-tile-grid cols-5 gap-3">
        {[
          { label: "待发货", value: stats.unshipped },
          { label: "待收款", value: stats.unpaid },
          { label: "部分收款", value: stats.partialPayment },
          { label: "待核销", value: stats.creditReconcile },
          { label: "待办合计", value: stats.total },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted font-serif">{s.label}</div>
              <div className="text-2xl font-bold font-serif mt-1">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">待办列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-muted font-serif">
              暂无待办，全部处理完毕
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {tasks.map((t) => {
                  const Icon = ICONS[t.type];
                  return (
                    <li key={`${t.type}-${t.orderId}`}>
                      <Link
                        href={t.href}
                        className="flex items-start gap-3 rounded-lg border border-border p-3 hover:border-wine/40 hover:bg-wine/5 transition-colors"
                      >
                        <div className="shrink-0 mt-0.5 text-wine">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm">{t.orderNo}</span>
                            <Badge variant={BADGE_VARIANT[t.type]}>
                              {getOpsTaskLabel(t.type)}
                            </Badge>
                          </div>
                          <div className="text-sm mt-0.5">{t.customerName}</div>
                          <div className="text-xs text-muted mt-1">
                            {t.summary} · {formatDate(t.orderedAt)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={stats.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
