"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Truck, Wallet, ClipboardList, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { getOpsTaskLabel, type OpsTask, type OpsTaskType } from "@/lib/ops-workbench-types";
import { formatDate, cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type TileFilter = OpsTaskType | "ALL";

const ICONS: Record<OpsTaskType, typeof Truck> = {
  UNSHIPPED: Truck,
  UNPAID: Wallet,
  RECONCILE_REVIEW: ClipboardCheck,
  CREDIT_RECONCILE: ClipboardList,
};

const BADGE_VARIANT: Record<
  OpsTaskType,
  "default" | "warning" | "wine" | "success"
> = {
  UNSHIPPED: "warning",
  UNPAID: "wine",
  RECONCILE_REVIEW: "warning",
  CREDIT_RECONCILE: "wine",
};

const TILES: { label: string; statKey: keyof typeof defaultStats; filter: TileFilter }[] = [
  { label: "待发货", statKey: "unshipped", filter: "UNSHIPPED" },
  { label: "待收款", statKey: "unpaid", filter: "UNPAID" },
  { label: "核销待审核", statKey: "reconcileReview", filter: "RECONCILE_REVIEW" },
  { label: "待核销", statKey: "creditReconcile", filter: "CREDIT_RECONCILE" },
  { label: "待办合计", statKey: "total", filter: "ALL" },
];

const defaultStats = {
  unshipped: 0,
  unpaid: 0,
  reconcileReview: 0,
  creditReconcile: 0,
  total: 0,
};

export function OpsWorkbenchPage() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TileFilter>("ALL");
  const [stats, setStats] = useState(defaultStats);
  const [tasks, setTasks] = useState<OpsTask[]>([]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    fetch(`/api/workbench/ops?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setStats(data.stats);
        if (data.tasks) setTasks(data.tasks);
        if (data.totalPages) setTotalPages(data.totalPages);
        if (typeof data.total === "number") setTotal(data.total);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, typeFilter]);

  function selectFilter(filter: TileFilter) {
    setTypeFilter(filter);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-serif font-bold">职能工作台</h1>
        <p className="text-muted text-sm mt-1 font-serif">
          待发货、待收款、核销待审核、账期核销等待办事项一览
        </p>
      </div>

      <div className="stat-tile-grid cols-5 gap-3">
        {TILES.map((tile) => {
          const active = typeFilter === tile.filter;
          return (
            <button
              key={tile.label}
              type="button"
              onClick={() => selectFilter(tile.filter)}
              className="text-left"
            >
              <Card
                className={cn(
                  "transition-all cursor-pointer hover:border-wine/40",
                  active && "border-wine ring-2 ring-wine/30 bg-wine/5"
                )}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted font-serif">{tile.label}</div>
                  <div className="text-2xl font-bold font-serif mt-1">
                    {stats[tile.statKey]}
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base flex flex-wrap items-center gap-2">
            待办列表
            {typeFilter !== "ALL" && (
              <Badge variant="wine">{getOpsTaskLabel(typeFilter)}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-muted font-serif">
              {typeFilter === "ALL"
                ? "暂无待办，全部处理完毕"
                : `暂无「${getOpsTaskLabel(typeFilter)}」类待办`}
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
                        <div
                          className={cn(
                            "shrink-0 mt-0.5 text-wine",
                            t.type === "RECONCILE_REVIEW" && "animate-pulse"
                          )}
                        >
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
                total={total}
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
