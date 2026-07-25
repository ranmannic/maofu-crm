"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ClipboardList, ListTodo } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterField } from "@/components/ui/filter-field";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type ActivityRecord = {
  id: string;
  customerId: string;
  customerName: string;
  salesName: string;
  userName: string;
  followedAtLabel: string;
  content: string;
  nextPlan: string | null;
  nextFollowUpAt: string | null;
};

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function FollowUpActivityPanel() {
  const [draftStart, setDraftStart] = useState(todayISO);
  const [draftEnd, setDraftEnd] = useState(todayISO);
  const [start, setStart] = useState(todayISO);
  const [end, setEnd] = useState(todayISO);
  const [tab, setTab] = useState<"records" | "plans">("records");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ActivityRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [plansTotal, setPlansTotal] = useState(0);

  const load = useCallback(
    async (s: string, e: string, type: "records" | "plans", p: number) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          start: s,
          end: e,
          type,
          page: String(p),
        });
        const res = await fetch(`/api/follow-up/activity?${params}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "加载失败");
          return;
        }
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setPage(data.page ?? p);
        setRecordsTotal(data.recordsTotal ?? 0);
        setPlansTotal(data.plansTotal ?? 0);
        setStart(data.start ?? s);
        setEnd(data.end ?? e);
      } catch {
        setError("网络错误");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(todayISO(), todayISO(), "records", 1);
  }, [load]);

  function applyRange() {
    if (!draftStart || !draftEnd) return;
    if (draftStart > draftEnd) {
      setError("开始日期不能晚于结束日期");
      return;
    }
    setPage(1);
    load(draftStart, draftEnd, tab, 1);
  }

  function setToday() {
    const t = todayISO();
    setDraftStart(t);
    setDraftEnd(t);
    setPage(1);
    load(t, t, tab, 1);
  }

  function switchTab(next: "records" | "plans") {
    if (next === tab) return;
    setTab(next);
    setPage(1);
    load(start, end, next, 1);
  }

  function handlePageChange(p: number) {
    setPage(p);
    load(start, end, tab, p);
  }

  const rangeLabel = start === end ? start : `${start} ~ ${end}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-wine" />
            跟进日程
            <span className="text-xs font-normal text-muted">（{rangeLabel}）</span>
          </CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <FilterField label="开始" className="filter-field-date !mb-0">
              <Input
                type="date"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
              />
            </FilterField>
            <FilterField label="结束" className="filter-field-date !mb-0">
              <Input
                type="date"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
              />
            </FilterField>
            <Button size="sm" onClick={applyRange}>
              查询
            </Button>
            <Button size="sm" variant="secondary" onClick={setToday}>
              本日
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => switchTab("records")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-serif transition-colors",
              tab === "records" ? "bg-wine text-paper" : "bg-gray-100 text-muted hover:bg-gray-200"
            )}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            跟进记录
            <span className="opacity-80">({recordsTotal})</span>
          </button>
          <button
            type="button"
            onClick={() => switchTab("plans")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-serif transition-colors",
              tab === "plans" ? "bg-wine text-paper" : "bg-gray-100 text-muted hover:bg-gray-200"
            )}
          >
            <ListTodo className="h-3.5 w-3.5" />
            跟进计划
            <span className="opacity-80">({plansTotal})</span>
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {loading ? (
          <div className="text-center py-8 text-muted text-sm">加载中...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            {tab === "records" ? "该时间范围内暂无跟进记录" : "该时间范围内暂无跟进计划"}
          </div>
        ) : (
          <>
            <ul className="md:hidden divide-y divide-border/50">
              {items.map((item) => (
                <li key={`${tab}-${item.id}`} className="py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <AppNavLink
                      href={`/customers/${item.customerId}`}
                      className="font-medium text-wine hover:underline"
                    >
                      {item.customerName}
                    </AppNavLink>
                    <span className="text-xs text-muted shrink-0">
                      {tab === "records" ? item.followedAtLabel : item.nextFollowUpAt}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    销售 {item.salesName}
                    {tab === "records" ? ` · 记录人 ${item.userName}` : ""}
                  </div>
                  {tab === "records" ? (
                    <p className="text-sm whitespace-pre-wrap line-clamp-3">{item.content}</p>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {item.nextPlan || "（未填写计划内容）"}
                    </p>
                  )}
                  {tab === "records" && item.nextPlan && (
                    <p className="text-xs text-muted">下次计划：{item.nextPlan}</p>
                  )}
                  {tab === "plans" && (
                    <p className="text-xs text-muted line-clamp-2">
                      关联跟进：{item.content}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden md:block table-scroll">
              <table className="w-full text-sm ink-table">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-2 pr-2">客户</th>
                    <th className="pb-2 pr-2">销售</th>
                    <th className="pb-2 pr-2">
                      {tab === "records" ? "跟进时间" : "计划时间"}
                    </th>
                    <th className="pb-2">
                      {tab === "records" ? "跟进内容" : "计划内容"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${tab}-${item.id}`} className="border-b border-border/40 align-top">
                      <td className="py-2.5 pr-2 whitespace-nowrap">
                        <AppNavLink
                          href={`/customers/${item.customerId}`}
                          className="font-medium text-wine hover:underline"
                        >
                          {item.customerName}
                        </AppNavLink>
                      </td>
                      <td className="py-2.5 pr-2 text-muted whitespace-nowrap">
                        {item.salesName}
                      </td>
                      <td className="py-2.5 pr-2 whitespace-nowrap text-muted">
                        {tab === "records" ? item.followedAtLabel : item.nextFollowUpAt}
                      </td>
                      <td className="py-2.5">
                        {tab === "records" ? (
                          <div>
                            <p className="whitespace-pre-wrap">{item.content}</p>
                            {item.nextPlan && (
                              <p className="text-xs text-muted mt-1">下次计划：{item.nextPlan}</p>
                            )}
                            <p className="text-xs text-muted mt-0.5">记录人：{item.userName}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="whitespace-pre-wrap">
                              {item.nextPlan || "（未填写计划内容）"}
                            </p>
                            <p className="text-xs text-muted mt-1 line-clamp-2">
                              关联跟进：{item.content}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
