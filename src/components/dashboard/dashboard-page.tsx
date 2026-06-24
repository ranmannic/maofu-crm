"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { YoYCurveChart } from "@/components/dashboard/yoy-chart";
import { ChannelPieChart } from "@/components/dashboard/channel-pie-chart";
import { CategoryPerformanceSection } from "@/components/dashboard/category-performance-section";
import { ADMIN_DASHBOARD_DATA_VISIBLE_KEY } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth-types";

interface RefundOrderRow {
  id: string;
  orderNo: string;
  customerName: string;
  refundAmount: number;
  refundPerformanceAmount: number;
  refundedAt: string | null;
  refundStatus: string;
  salesName: string;
}

interface PerformanceOrderRow {
  id: string;
  orderNo: string;
  customerName: string;
  salesName: string;
  totalPerformance: number;
  paidPerformance: number;
  unpaidPerformance: number;
  eventCount: number;
  lastEventAt: string | null;
}

interface PerformanceEventRow {
  id: string;
  orderId: string;
  orderNo: string;
  customerName: string;
  salesName: string;
  amount: number;
  eventAt: string;
}

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
  refundStats: {
    totalAmount: number;
    orders: RefundOrderRow[];
  };
  performanceDetails: {
    orders: PerformanceOrderRow[];
    paidOrders: PerformanceOrderRow[];
    unpaidOrders: PerformanceOrderRow[];
    events: PerformanceEventRow[];
    showSales: boolean;
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
  categoryPerformanceStats?: {
    categoryId: string;
    categoryName: string;
    totalAmount: number;
    orderCount: number;
    channels: { channel: string; orderCount: number; amount: number }[];
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
  const [period, setPeriod] = useState("month");
  const [salesId, setSalesId] = useState("");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [detailModal, setDetailModal] = useState<
    null | "orders" | "performance-total" | "performance-paid" | "performance-unpaid" | "refund"
  >(null);
  const [dataVisible, setDataVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    if (!isAdmin) return true;
    const stored = sessionStorage.getItem(ADMIN_DASHBOARD_DATA_VISIBLE_KEY);
    return stored === null ? true : stored === "true";
  });

  function toggleDataVisible() {
    setDataVisible((prev) => {
      const next = !prev;
      sessionStorage.setItem(ADMIN_DASHBOARD_DATA_VISIBLE_KEY, String(next));
      return next;
    });
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError("");
      const params = new URLSearchParams({ period });
      if (salesId) params.set("salesId", salesId);
      try {
        const res = await fetch(`/api/stats?${params}`);
        if (res.ok) {
          setStats(await res.json());
        } else {
          const data = await res.json().catch(() => ({}));
          setStats(null);
          setLoadError(data.error || "数据加载失败，请刷新重试");
        }
      } catch {
        setStats(null);
        setLoadError("网络异常，无法加载统计数据");
      }
      setLoading(false);
    }
    load();
  }, [period, salesId]);

  const hidden = isAdmin && !dataVisible;

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

  const performanceOrders = stats?.performanceDetails?.orders ?? [];
  const paidPerformanceOrders = stats?.performanceDetails?.paidOrders ?? [];
  const unpaidPerformanceOrders = stats?.performanceDetails?.unpaidOrders ?? [];
  const performanceEvents = stats?.performanceDetails?.events ?? [];
  const showSalesInDetail = stats?.performanceDetails?.showSales ?? isAdmin;

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
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleDataVisible}
              title={dataVisible ? "隐藏数据" : "显示数据"}
            >
              {dataVisible ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" />
                  隐藏数据
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  显示数据
                </>
              )}
            </Button>
          )}
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
      ) : loadError ? (
        <div className="text-center py-20 text-red-700 font-serif">{loadError}</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              title="订单数"
              value={hidden ? "****" : String(stats.orderStats.total)}
              subtitle="点击查看明细"
              onClick={hidden ? undefined : () => setDetailModal("orders")}
              clickable={!hidden}
            />
            <StatCard
              title="业绩总额"
              value={
                hidden ? "****" : formatCurrency(stats.orderStats.totalAmount)
              }
              subtitle="点击查看明细"
              onClick={hidden ? undefined : () => setDetailModal("performance-total")}
              clickable={!hidden}
            />
            <StatCard
              title="未收款业绩"
              value={
                hidden ? "****" : formatCurrency(stats.orderStats.unpaidAmount)
              }
              subtitle="点击查看明细"
              onClick={hidden ? undefined : () => setDetailModal("performance-unpaid")}
              clickable={!hidden}
            />
            <StatCard
              title="退款业绩"
              value={
                hidden
                  ? "****"
                  : formatCurrency(stats.refundStats?.totalAmount ?? 0)
              }
              subtitle="点击查看明细"
              onClick={hidden ? undefined : () => setDetailModal("refund")}
              clickable={!hidden}
            />
            <StatCard
              title="已收款业绩"
              value={
                hidden ? "****" : formatCurrency(stats.orderStats.paidAmount)
              }
              subtitle="点击查看明细"
              onClick={hidden ? undefined : () => setDetailModal("performance-paid")}
              clickable={!hidden}
            />
            {isAdmin && stats.orderStats.totalProfit !== undefined && (
              <StatCard
                title="订单毛利"
                value={
                  hidden
                    ? "****"
                    : formatCurrency(stats.orderStats.totalProfit)
                }
                highlight
              />
            )}
          </div>

          <div
            className={
              hidden ? "blur-md pointer-events-none select-none" : undefined
            }
          >
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
          </div>

          {isAdmin && stats.categoryPerformanceStats && (
            <CategoryPerformanceSection
              data={stats.categoryPerformanceStats}
              hidden={hidden}
            />
          )}

          <div
            className={
              hidden ? "blur-md pointer-events-none select-none" : undefined
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <YoYCurveChart
                title="业绩曲线"
                data={stats.monthlyCurves.performance}
                valueLabel="业绩金额"
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
                    <th className="pb-3">业绩金额</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.channelStats.map((row) => (
                    <tr key={row.channel} className="border-b border-border/40">
                      <td className="py-3 font-medium">
                        {hidden ? "****" : row.channel}
                      </td>
                      <td className="py-3">{hidden ? "**" : row.customerCount}</td>
                      <td className="py-3">{hidden ? "**" : row.orderCount}</td>
                      <td className="py-3">
                        {hidden ? "****" : formatCurrency(row.amount)}
                      </td>
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
                      <th className="pb-3">业绩金额</th>
                      <th className="pb-3">已收款</th>
                      <th className="pb-3">毛利</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.salesStats.map((row) => (
                      <tr key={row.salesId} className="border-b border-border/40">
                        <td className="py-3">{hidden ? "****" : row.salesName}</td>
                        <td className="py-3">{hidden ? "**" : row.orderCount}</td>
                        <td className="py-3">
                          {hidden ? "****" : formatCurrency(row.totalAmount)}
                        </td>
                        <td className="py-3">
                          {hidden ? "****" : formatCurrency(row.paidAmount)}
                        </td>
                        <td className="py-3 text-wine font-medium">
                          {hidden ? "****" : formatCurrency(row.profit)}
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

      <Modal
        open={detailModal === "orders"}
        onClose={() => setDetailModal(null)}
        title="订单明细"
        className="max-w-3xl"
      >
        <PerformanceOrderTable
          orders={performanceOrders}
          showSales={showSalesInDetail}
        />
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDetailModal(null)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={detailModal === "performance-total"}
        onClose={() => setDetailModal(null)}
        title="业绩总额明细"
        className="max-w-3xl"
      >
        <PerformanceOrderTable
          orders={performanceOrders}
          showSales={showSalesInDetail}
        />
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDetailModal(null)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={detailModal === "performance-paid"}
        onClose={() => setDetailModal(null)}
        title="已收款业绩明细"
        className="max-w-3xl"
      >
        <PerformanceEventTable
          events={performanceEvents}
          showSales={showSalesInDetail}
        />
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDetailModal(null)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={detailModal === "performance-unpaid"}
        onClose={() => setDetailModal(null)}
        title="未收款业绩明细"
        className="max-w-3xl"
      >
        <PerformanceOrderTable
          orders={unpaidPerformanceOrders}
          showSales={showSalesInDetail}
          mode="unpaid"
        />
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDetailModal(null)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={detailModal === "refund"}
        onClose={() => setDetailModal(null)}
        title="退款业绩明细"
        className="max-w-3xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm ink-table">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2">订单号</th>
                <th className="pb-2">客户</th>
                {isAdmin && <th className="pb-2">销售</th>}
                <th className="pb-2">退款金额</th>
                <th className="pb-2">扣减业绩</th>
                <th className="pb-2">退款时间</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.refundStats?.orders ?? []).map((o) => (
                <tr key={o.id} className="border-b border-border/40">
                  <td className="py-2">{o.orderNo}</td>
                  <td className="py-2">{o.customerName}</td>
                  {isAdmin && <td className="py-2">{o.salesName}</td>}
                  <td className="py-2">{formatCurrency(o.refundAmount)}</td>
                  <td className="py-2 text-wine">
                    {formatCurrency(o.refundPerformanceAmount)}
                  </td>
                  <td className="py-2">
                    {o.refundedAt ? formatDate(o.refundedAt) : "-"}
                  </td>
                </tr>
              ))}
              {(stats?.refundStats?.orders.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-muted">
                    统计周期内暂无退款
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDetailModal(null)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function PerformanceOrderTable({
  orders,
  showSales,
  mode = "total",
}: {
  orders: PerformanceOrderRow[];
  showSales: boolean;
  mode?: "total" | "unpaid";
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm ink-table">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="pb-2">订单号</th>
            <th className="pb-2">客户</th>
            {showSales && <th className="pb-2">销售</th>}
            <th className="pb-2">业绩总额</th>
            <th className="pb-2">已收款业绩</th>
            <th className="pb-2">未收款业绩</th>
            <th className="pb-2">计入次数</th>
            <th className="pb-2">最近计入时间</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border/40">
              <td className="py-2">{o.orderNo}</td>
              <td className="py-2">{o.customerName}</td>
              {showSales && <td className="py-2">{o.salesName}</td>}
              <td className="py-2 text-wine">{formatCurrency(o.totalPerformance)}</td>
              <td className="py-2">{formatCurrency(o.paidPerformance)}</td>
              <td className="py-2">{formatCurrency(o.unpaidPerformance)}</td>
              <td className="py-2">{o.eventCount}</td>
              <td className="py-2">{o.lastEventAt ? formatDate(o.lastEventAt) : "-"}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={showSales ? 8 : 7} className="py-8 text-center text-muted">
                {mode === "unpaid" ? "统计周期内暂无未收款业绩" : "统计周期内暂无订单"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PerformanceEventTable({
  events,
  showSales,
}: {
  events: PerformanceEventRow[];
  showSales: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm ink-table">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="pb-2">订单号</th>
            <th className="pb-2">客户</th>
            {showSales && <th className="pb-2">销售</th>}
            <th className="pb-2">业绩金额</th>
            <th className="pb-2">计入时间</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-border/40">
              <td className="py-2">{e.orderNo}</td>
              <td className="py-2">{e.customerName}</td>
              {showSales && <td className="py-2">{e.salesName}</td>}
              <td className="py-2 text-wine">{formatCurrency(e.amount)}</td>
              <td className="py-2">{formatDate(e.eventAt)}</td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={showSales ? 5 : 4} className="py-8 text-center text-muted">
                统计周期内暂无业绩
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({
  title,
  value,
  highlight,
  subtitle,
  onClick,
  clickable,
}: {
  title: string;
  value: string;
  highlight?: boolean;
  subtitle?: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <div
      className={clickable ? "cursor-pointer" : undefined}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable && onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <Card className={clickable ? "hover:border-wine/40 transition-colors h-full" : undefined}>
        <CardContent className="pt-5">
          <p className="text-sm text-muted font-serif">{title}</p>
          <p
            className={`text-2xl font-serif font-bold mt-1 ${highlight ? "text-wine" : ""}`}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted mt-1">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
