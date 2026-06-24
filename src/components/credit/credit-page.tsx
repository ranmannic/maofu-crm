"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, AlertTriangle, Wallet, CheckCircle2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input, Label, Select, Textarea, QtyInput } from "@/components/ui/input";
import { FilterField } from "@/components/ui/filter-field";
import { formatCurrency, formatDate } from "@/lib/utils";
import { calcReconcilePaidAmount } from "@/lib/reconcile-ui";
import { OrderVouchersPanel } from "@/components/orders/order-vouchers-panel";
import type { SessionUser } from "@/lib/auth-types";

interface CreditItem {
  id: string;
  productName: string;
  specName: string;
  unitLabel: string;
  unitPrice: number;
  quantity: number;
  quantityBottles: number;
  unreconciledQty: number;
  unreconciledBottles: number;
  reconciledQty: number;
  reconciledBottles: number;
  isGift: boolean;
  badDebtRecoveredQty: number;
}

interface ReconciliationRecord {
  id: string;
  action: string;
  paidAmount: number;
  paymentStatus: string;
  performanceAmount: number;
  paidAt: string | null;
  userName: string;
  createdAt: string;
  items: { productName: string; specName: string; quantity: number; isGift?: boolean }[];
}

interface CreditOrder {
  id: string;
  orderNo: string;
  totalAmount: number;
  paidAmount: number;
  unreconciledAmount: number;
  paymentStatus: string;
  creditStatus: string | null;
  badDebtAmount: number | null;
  badDebtGoodsRecovered: boolean | null;
  badDebtNotes: string | null;
  orderedAt: string;
  paidAt: string | null;
  items: CreditItem[];
  reconciliationRecords?: ReconciliationRecord[];
}

interface CreditCustomer {
  id: string;
  name: string;
  sales: { id: string; name: string };
  unreconciledAmount: number;
  inventory: {
    id: string;
    productName: string;
    specName: string;
    unitLabel: string;
    unreconciledQty: number;
    unreconciledBottles: number;
  }[];
  orders: CreditOrder[];
}

interface CreditStats {
  totalUnreconciled: number;
  totalUnreconciledAmount: number;
  creditCustomerCount: number;
  badDebtOrderCount: number;
  badDebtAmount: number;
  badDebtRecoveredQty: number;
  badDebtUnrecoveredQty: number;
}

function getCreditOrderOverdueLevel(order: CreditOrder): "none" | "month" | "quarter" {
  if (isCreditOrderFullySettled(order)) return "none";
  const diffDays =
    (Date.now() - new Date(order.orderedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 90) return "quarter";
  if (diffDays > 30) return "month";
  return "none";
}

function getCreditOrderDateClass(order: CreditOrder): string {
  const level = getCreditOrderOverdueLevel(order);
  if (level === "quarter") return "text-red-600 font-semibold";
  if (level === "month") return "text-yellow-600 font-semibold";
  return "text-muted";
}

function isCreditOrderFullySettled(order: CreditOrder) {
  return (
    order.creditStatus === "SETTLED" ||
    (order.paymentStatus === "PAID" &&
      order.items.every((i) => i.unreconciledQty === 0))
  );
}

export function CreditPage({ user }: { user: SessionUser }) {
  const canEdit = ["OPERATIONS", "ADMIN"].includes(user.role);
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"active" | "settled">("active");
  const [customerQ, setCustomerQ] = useState("");
  const [orderNoQ, setOrderNoQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [appliedOrderNo, setAppliedOrderNo] = useState("");
  const [appliedView, setAppliedView] = useState<"active" | "settled">("active");
  const [settledOrderCount, setSettledOrderCount] = useState(0);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [voucherOrder, setVoucherOrder] = useState<CreditOrder | null>(null);
  const [badDebtModalOpen, setBadDebtModalOpen] = useState(false);
  const [reconcileHistoryOpen, setReconcileHistoryOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CreditOrder | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentStatus: "PARTIAL" as "UNPAID" | "PARTIAL" | "PAID",
    paidAmount: 0,
    paidAt: "",
  });
  const [reconcileQty, setReconcileQty] = useState<Record<string, number>>({});
  const [badDebtForm, setBadDebtForm] = useState({
    badDebtAmount: 0,
    goodsRecovered: false,
    notes: "",
  });
  const [badDebtQty, setBadDebtQty] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ view: appliedView });
    if (appliedQ) params.set("customer", appliedQ);
    if (appliedOrderNo) params.set("orderNo", appliedOrderNo);
    const res = await fetch(`/api/credit?${params}`);
    if (res.ok) {
      const data = await res.json();
      setStats(data.stats ?? null);
      setCustomers(data.customers);
      setSettledOrderCount(data.settledOrderCount ?? 0);
    }
    setLoading(false);
  }, [appliedQ, appliedOrderNo, appliedView]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearch() {
    setAppliedQ(customerQ);
    setAppliedOrderNo(orderNoQ);
    setAppliedView(viewMode);
  }

  function switchView(mode: "active" | "settled") {
    setViewMode(mode);
    setAppliedView(mode);
    if (mode === "active") {
      setOrderNoQ("");
      setAppliedOrderNo("");
    }
  }

  const isSettledView = appliedView === "settled";

  function openReconcileHistory(order: CreditOrder) {
    setSelectedOrder(order);
    setReconcileHistoryOpen(true);
  }

  function updateReconcileQty(order: CreditOrder, itemId: string, quantity: number) {
    const nextQty = { ...reconcileQty, [itemId]: quantity };
    setReconcileQty(nextQty);
    if (paymentForm.paymentStatus === "PARTIAL") {
      setPaymentForm((prev) => ({
        ...prev,
        paidAmount: calcReconcilePaidAmount(
          order.items.map((i) => ({
            id: i.id,
            unitPrice: i.unitPrice,
            isGift: i.isGift,
          })),
          order.paidAmount,
          nextQty
        ),
      }));
    }
  }

  function openPayment(order: CreditOrder) {
    setSelectedOrder(order);
    setPaymentForm({
      paymentStatus:
        order.paymentStatus === "PAID"
          ? "PAID"
          : order.paymentStatus === "PARTIAL"
            ? "PARTIAL"
            : "PARTIAL",
      paidAmount: order.paidAmount,
      paidAt: "",
    });
    const qty: Record<string, number> = {};
    order.items.forEach((i) => {
      qty[i.id] = 0;
    });
    setReconcileQty(qty);
    setError("");
    setPayModalOpen(true);
  }

  function openBadDebt(order: CreditOrder) {
    setSelectedOrder(order);
    setBadDebtForm({
      badDebtAmount: order.totalAmount - order.paidAmount,
      goodsRecovered: false,
      notes: "",
    });
    const qty: Record<string, number> = {};
    order.items.forEach((i) => {
      qty[i.id] = 0;
    });
    setBadDebtQty(qty);
    setError("");
    setBadDebtModalOpen(true);
  }

  async function handlePaymentSave() {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    const reconcileItems = Object.entries(reconcileQty)
      .filter(([, q]) => q > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

    if (paymentForm.paidAmount <= 0 && reconcileItems.length > 0) {
      setError("未付款时不可核销产品数量");
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/credit/${selectedOrder.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment: {
          ...paymentForm,
          paidAt: paymentForm.paidAt || undefined,
        },
        reconcileItems,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setPayModalOpen(false);
    await load();
    setSaving(false);
  }

  async function handleBadDebtSave() {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    const items = Object.entries(badDebtQty)
      .filter(([, q]) => q > 0)
      .map(([orderItemId, recoveredQty]) => ({ orderItemId, recoveredQty }));

    const res = await fetch(`/api/credit/${selectedOrder.id}/bad-debt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...badDebtForm, items }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setBadDebtModalOpen(false);
    await load();
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-bold">账期核销管理</h1>
        <p className="text-muted text-sm mt-1 font-serif">
          部分收款客户的库存核销、付款跟进与坏账处理
          {!canEdit && "（只读）"}
        </p>
      </div>

      {stats && !isSettledView && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard title="未核销数量" value={`${stats.totalUnreconciled}瓶`} />
          <StatCard
            title="未核销金额"
            value={formatCurrency(stats.totalUnreconciledAmount)}
          />
          <StatCard title="账期客户" value={String(stats.creditCustomerCount)} />
          <StatCard
            title="坏账订单"
            value={String(stats.badDebtOrderCount)}
            sub={`金额 ${formatCurrency(stats.badDebtAmount)}`}
          />
          <StatCard
            title="坏账货物"
            value={`收回 ${stats.badDebtRecoveredQty}瓶 / 未收回 ${stats.badDebtUnrecoveredQty}瓶`}
          />
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={viewMode === "active" ? "primary" : "secondary"}
              size="sm"
              onClick={() => switchView("active")}
            >
              待核销
            </Button>
            <Button
              variant={viewMode === "settled" ? "primary" : "secondary"}
              size="sm"
              onClick={() => switchView("settled")}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              已结清
            </Button>
            {isSettledView && (
              <span className="text-sm text-muted self-center ml-2">
                共 {settledOrderCount} 笔已结清订单
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3 mb-4">
            <FilterField label="客户" className="min-w-[160px]">
              <Input
                placeholder="客户名称"
                value={customerQ}
                onChange={(e) => setCustomerQ(e.target.value)}
              />
            </FilterField>
            {viewMode === "settled" && (
              <FilterField label="订单号" className="min-w-[160px]">
                <Input
                  placeholder="订单号"
                  value={orderNoQ}
                  onChange={(e) => setOrderNoQ(e.target.value)}
                />
              </FilterField>
            )}
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              查询
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-muted">
              {isSettledView ? "暂无已结清账期订单" : "暂无账期客户"}
            </div>
          ) : (
            <div className="space-y-6">
              {customers.map((c) => (
                <div
                  key={c.id}
                  className="border border-border rounded-sm p-4 bg-paper/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-serif font-bold text-lg">{c.name}</h3>
                      <p className="text-sm text-muted">销售：{c.sales.name}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!isSettledView && c.unreconciledAmount > 0 && (
                        <span className="text-sm text-wine font-medium">
                          未核销金额 {formatCurrency(c.unreconciledAmount)}
                        </span>
                      )}
                      <Badge variant={isSettledView ? "success" : "wine"}>
                        {isSettledView ? "已结清客户" : "账期客户"}
                      </Badge>
                    </div>
                  </div>

                  {!isSettledView && c.inventory.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2 font-serif">
                        客户库存
                      </h4>
                      <table className="w-full text-sm ink-table">
                        <thead>
                          <tr className="border-b border-border text-left text-muted">
                            <th className="pb-2">产品</th>
                            <th className="pb-2">未核销（瓶）</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.inventory.map((inv) => (
                            <tr key={inv.id} className="border-b border-border/40">
                              <td className="py-2">
                                {inv.productName} · {inv.specName}
                              </td>
                              <td className="py-2 text-wine font-medium">
                                {inv.unreconciledBottles}瓶
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium font-serif">
                      {isSettledView ? "已结清订单" : "账期订单"}
                    </h4>
                    {c.orders.map((o) => (
                      <Card key={o.id}>
                        <CardHeader className="pb-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-xs shrink-0 ${
                                  isSettledView
                                    ? "text-muted"
                                    : getCreditOrderDateClass(o)
                                }`}
                              >
                                {formatDate(o.orderedAt)}
                              </span>
                              <CardTitle className="text-base font-mono">
                                {o.orderNo}
                                {isSettledView && (
                                  <Badge variant="success" className="ml-2">
                                    已结清
                                  </Badge>
                                )}
                                {!isSettledView && o.creditStatus === "BAD_DEBT" && (
                                  <Badge variant="danger" className="ml-2">
                                    坏账
                                  </Badge>
                                )}
                                {o.paymentStatus === "PARTIAL" &&
                                  !isSettledView &&
                                  o.creditStatus !== "BAD_DEBT" && (
                                    <Badge variant="wine" className="ml-2">
                                      部分收 {formatCurrency(o.paidAmount)}
                                    </Badge>
                                  )}
                                {o.paymentStatus === "UNPAID" &&
                                  !isSettledView &&
                                  o.creditStatus !== "BAD_DEBT" && (
                                    <Badge variant="warning" className="ml-2">
                                      未付款已发货
                                    </Badge>
                                  )}
                                {!isSettledView &&
                                  !isCreditOrderFullySettled(o) &&
                                  o.creditStatus !== "BAD_DEBT" &&
                                  getCreditOrderOverdueLevel(o) !== "none" && (
                                    <Badge variant="default" className="ml-2">
                                      {getCreditOrderOverdueLevel(o) === "quarter"
                                        ? "超3月未结清"
                                        : "超1月未结清"}
                                    </Badge>
                                  )}
                              </CardTitle>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-sm">
                            总额 {formatCurrency(o.totalAmount)} · 已收{" "}
                            {formatCurrency(o.paidAmount)}
                            {isSettledView && o.paidAt && (
                              <>
                                {" "}
                                · 结清时间{" "}
                                <span className="text-green-700 font-medium">
                                  {formatDate(o.paidAt)}
                                </span>
                              </>
                            )}
                            {!isSettledView && (
                              <>
                                {" "}
                                · 未核销金额{" "}
                                <span className="text-wine font-medium">
                                  {formatCurrency(o.unreconciledAmount)}
                                </span>
                              </>
                            )}
                          </div>
                          <table className="w-full text-xs ink-table">
                            <thead>
                              <tr className="border-b border-border text-muted">
                                <th className="pb-1">产品</th>
                                <th className="pb-1 text-center">订单量</th>
                                <th className="pb-1 text-center">已核销（瓶）</th>
                                <th className="pb-1 text-center">未核销（瓶）</th>
                              </tr>
                            </thead>
                            <tbody>
                              {o.items.map((item) => (
                                <tr key={item.id} className="border-b border-border/30">
                                  <td className="py-1">
                                    {item.productName} · {item.specName}
                                    {item.isGift && (
                                      <Badge variant="wine" className="ml-1 text-[10px] px-1 py-0">
                                        赠品
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="py-1 text-center">
                                    {item.quantityBottles}瓶
                                  </td>
                                  <td className="py-1 text-center text-green-700">
                                    {item.reconciledBottles}瓶
                                  </td>
                                  <td className="py-1 text-center text-wine">
                                    {item.unreconciledBottles}瓶
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {!isSettledView && o.creditStatus === "BAD_DEBT" && (
                            <div className="text-xs text-muted bg-red-50 p-2 rounded-sm">
                              坏账金额：{formatCurrency(o.badDebtAmount ?? 0)} ·
                              货物{o.badDebtGoodsRecovered ? "已" : "未"}收回
                              {o.badDebtNotes && ` · ${o.badDebtNotes}`}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {(o.reconciliationRecords?.length ?? 0) > 0 && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openReconcileHistory(o)}
                              >
                                查看核销记录
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setVoucherOrder(o);
                                setVoucherModalOpen(true);
                              }}
                            >
                              <Paperclip className="h-3 w-3 mr-1" />
                              凭证
                            </Button>
                            {canEdit && !isSettledView && o.creditStatus !== "BAD_DEBT" && (
                              <>
                                <Button size="sm" onClick={() => openPayment(o)}>
                                  <Wallet className="h-3 w-3 mr-1" />
                                  核销付款
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openBadDebt(o)}
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  标记坏账
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={`核销付款 · ${selectedOrder?.orderNo || ""}`}
        className="max-w-2xl"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>付款状态</Label>
                <Select
                  value={paymentForm.paymentStatus}
                  onChange={(e) => {
                    const status = e.target.value as "UNPAID" | "PARTIAL" | "PAID";
                    if (status === "PAID") {
                      setPaymentForm({
                        ...paymentForm,
                        paymentStatus: status,
                        paidAmount: selectedOrder.totalAmount,
                      });
                      return;
                    }
                    setPaymentForm({
                      ...paymentForm,
                      paymentStatus: status,
                      paidAmount:
                        status === "UNPAID"
                          ? 0
                          : calcReconcilePaidAmount(
                              selectedOrder.items.map((i) => ({
                                id: i.id,
                                unitPrice: i.unitPrice,
                                isGift: i.isGift,
                              })),
                              selectedOrder.paidAmount,
                              reconcileQty
                            ),
                    });
                  }}
                >
                  <option value="PARTIAL">部分付款</option>
                  <option value="PAID">已付款</option>
                </Select>
              </div>
              <div>
                <Label>已收金额</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={paymentForm.paidAmount}
                  disabled={paymentForm.paymentStatus === "PAID"}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paidAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                {paymentForm.paymentStatus === "PARTIAL" && (
                  <p className="text-xs text-muted mt-1">
                    根据本次核销数量自动累加（含历史已收{" "}
                    {formatCurrency(selectedOrder.paidAmount)}）
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label>本次核销产品数量 *</Label>
              <p className="text-xs text-muted mb-2">
                填写本次付款对应的核销数量（从未核销转为已核销）
              </p>
              <div className="space-y-2 border border-border rounded-sm p-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">
                      {item.productName} · {item.specName}
                      <span className="text-muted ml-1">
                        {item.isGift
                          ? "¥0"
                          : `${formatCurrency(item.unitPrice)}/${item.unitLabel}`}
                      </span>
                      {item.isGift && (
                        <Badge variant="wine" className="ml-1 text-[10px] px-1 py-0">
                          赠品
                        </Badge>
                      )}
                      （未核销 {item.unreconciledBottles}
                      瓶 / {item.unreconciledQty}{item.unitLabel}）
                    </span>
                    <QtyInput
                      min={0}
                      max={item.unreconciledQty}
                      className="w-24"
                      disabled={item.unreconciledQty <= 0}
                      value={reconcileQty[item.id] ?? 0}
                      onChange={(n) =>
                        selectedOrder &&
                        updateReconcileQty(selectedOrder, item.id, n)
                      }
                    />
                    <span className="text-xs text-muted w-8">{item.unitLabel}</span>
                  </div>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <OrderVouchersPanel
              orderId={selectedOrder.id}
              canEdit={canEdit}
              compact
            />
          </div>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setPayModalOpen(false)}>
            取消
          </Button>
          <Button onClick={handlePaymentSave} disabled={saving}>
            {saving ? "保存中..." : "确认核销"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        title={`订单凭证 · ${voucherOrder?.orderNo || ""}`}
        className="max-w-2xl"
      >
        <OrderVouchersPanel
          orderId={voucherOrder?.id ?? null}
          canEdit={canEdit}
        />
        <ModalFooter>
          <Button variant="secondary" onClick={() => setVoucherModalOpen(false)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={badDebtModalOpen}
        onClose={() => setBadDebtModalOpen(false)}
        title={`标记坏账 · ${selectedOrder?.orderNo || ""}`}
        className="max-w-2xl"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>坏账金额 *</Label>
                <Input
                  type="number"
                  min={0}
                  value={badDebtForm.badDebtAmount}
                  onChange={(e) =>
                    setBadDebtForm({
                      ...badDebtForm,
                      badDebtAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>货物是否收回</Label>
                <Select
                  value={badDebtForm.goodsRecovered ? "1" : "0"}
                  onChange={(e) =>
                    setBadDebtForm({
                      ...badDebtForm,
                      goodsRecovered: e.target.value === "1",
                    })
                  }
                >
                  <option value="0">未收回</option>
                  <option value="1">已收回</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>
                {badDebtForm.goodsRecovered ? "收回货物数量" : "未收回货物数量"}
              </Label>
              <div className="space-y-2 border border-border rounded-sm p-3 mt-1">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">
                      {item.productName} · 未核销 {item.unreconciledBottles}瓶
                    </span>
                    <QtyInput
                      min={0}
                      max={item.unreconciledQty}
                      className="w-24"
                      value={badDebtQty[item.id] ?? 0}
                      onChange={(n) =>
                        setBadDebtQty({
                          ...badDebtQty,
                          [item.id]: n,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>备注</Label>
              <Textarea
                value={badDebtForm.notes}
                onChange={(e) =>
                  setBadDebtForm({ ...badDebtForm, notes: e.target.value })
                }
                placeholder="倒闭、跑路等原因说明"
              />
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setBadDebtModalOpen(false)}>
            取消
          </Button>
          <Button onClick={handleBadDebtSave} disabled={saving}>
            {saving ? "保存中..." : "确认坏账"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={reconcileHistoryOpen}
        onClose={() => setReconcileHistoryOpen(false)}
        title={`核销记录 · ${selectedOrder?.orderNo || ""}`}
        className="max-w-2xl"
      >
        {selectedOrder && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {(selectedOrder.reconciliationRecords ?? []).length === 0 ? (
              <p className="text-muted text-sm text-center py-8">暂无核销记录</p>
            ) : (
              selectedOrder.reconciliationRecords!.map((rec) => (
                <div
                  key={rec.id}
                  className="border border-border rounded-sm p-3 space-y-2"
                >
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{rec.action}</span>
                    <span className="text-muted">{formatDate(rec.createdAt)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted">操作人：</span>
                      {rec.userName}
                    </div>
                    <div>
                      <span className="text-muted">收款状态：</span>
                      {rec.paymentStatus}
                    </div>
                    <div>
                      <span className="text-muted">累计已收：</span>
                      {formatCurrency(rec.paidAmount)}
                    </div>
                    <div>
                      <span className="text-muted">计入业绩：</span>
                      <span className="text-wine">
                        {formatCurrency(rec.performanceAmount)}
                      </span>
                    </div>
                    {rec.paidAt && (
                      <div className="col-span-2">
                        <span className="text-muted">收款时间：</span>
                        {formatDate(rec.paidAt)}
                      </div>
                    )}
                  </div>
                  {rec.items.length > 0 && (
                    <table className="w-full text-xs ink-table mt-2">
                      <thead>
                        <tr className="text-muted border-b border-border/40">
                          <th className="pb-1 text-left">产品</th>
                          <th className="pb-1 text-right">核销数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rec.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-border/20">
                            <td className="py-1">
                              {item.productName} · {item.specName}
                              {item.isGift && "（赠品）"}
                            </td>
                            <td className="py-1 text-right">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setReconcileHistoryOpen(false)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted font-serif">{title}</p>
        <p className="text-lg font-serif font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
