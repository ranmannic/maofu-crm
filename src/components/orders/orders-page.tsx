"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Eye, History, Search, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { FilterField } from "@/components/ui/filter-field";
import { DEFAULT_PAGE_SIZE, SPEC_UNIT_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth-types";
import type { SpecUnit } from "@/generated/prisma/client";

interface AuditLog {
  id: string;
  userName: string;
  action: string;
  changes: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  productAmount?: number;
  shippingFee?: number;
  otherFee?: number;
  calculatedAmount: number;
  totalAmount: number;
  amountAdjustReason: string | null;
  productCostTotal?: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  isPaid: boolean;
  paidAmount: number;
  isShipped: boolean;
  orderedAt: string;
  paidAt: string | null;
  notes: string | null;
  profit?: number;
  profitMargin?: number;
  performanceAmount?: number;
  itemsSummary?: string;
  sales: { id: string; name: string };
  handler: { id: string; name: string } | null;
  items: {
    id: string;
    productName: string;
    specName: string;
    unitType: SpecUnit;
    quantity: number;
    unitPrice: number;
  }[];
  shipping: {
    carrier: string | null;
    trackingNo: string | null;
    address: string | null;
    shippedAt: string | null;
    notes: string | null;
  } | null;
  auditLogs?: AuditLog[];
  isDeleted?: boolean;
  deletedAt?: string | null;
}

interface Customer { id: string; name: string }
interface Product {
  id: string;
  name: string;
  specs: { id: string; name: string; price: number; unitType: SpecUnit }[];
}
interface OpsUser { id: string; name: string }

function getPaymentBadge(order: Order) {
  if (order.paymentStatus === "PAID" || order.isPaid) {
    return { variant: "success" as const, label: "已收" };
  }
  if (order.paymentStatus === "PARTIAL" || order.paidAmount > 0) {
    return { variant: "wine" as const, label: "部分收" };
  }
  return { variant: "warning" as const, label: "未收" };
}

export function OrdersPage({ user }: { user: SessionUser }) {
  const canCreate = ["SALES", "ADMIN"].includes(user.role);
  const canDelete = ["SALES", "ADMIN"].includes(user.role);
  const canManageOps = ["OPERATIONS", "ADMIN"].includes(user.role);
  const isAdmin = user.role === "ADMIN";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const emptyOrderFilters = {
    customer: "",
    sales: "",
    orderNo: "",
    orderedStart: "",
    orderedEnd: "",
    paidStart: "",
    paidEnd: "",
    isPaid: "",
    paymentStatus: "",
    isShipped: "",
    showDeleted: "",
  };

  const [appliedFilters, setAppliedFilters] = useState(emptyOrderFilters);
  const [filterDraft, setFilterDraft] = useState({ ...emptyOrderFilters });
  const [draftShowDeleted, setDraftShowDeleted] = useState(false);
  const [appliedShowDeleted, setAppliedShowDeleted] = useState(false);

  const isSales = user.role === "SALES";

  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [opsUsers, setOpsUsers] = useState<OpsUser[]>([]);

  const [createForm, setCreateForm] = useState({
    customerId: "",
    handlerId: "",
    notes: "",
    shippingFee: 0,
    otherFee: 0,
    totalAmount: 0,
    amountAdjustReason: "",
    items: [{ productSpecId: "", quantity: 1 }],
  });
  const [productAmountPreview, setProductAmountPreview] = useState(0);
  const [calculatedPreview, setCalculatedPreview] = useState(0);

  const [paymentForm, setPaymentForm] = useState({
    paymentStatus: "UNPAID" as "UNPAID" | "PARTIAL" | "PAID",
    paidAmount: 0,
    paidAt: "",
  });
  const [shippingForm, setShippingForm] = useState({
    isShipped: false, carrier: "", trackingNo: "", address: "", shippedAt: "", notes: "",
  });
  const [editTotalAmount, setEditTotalAmount] = useState(0);
  const [editAmountReason, setEditAmountReason] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    Object.entries(appliedFilters).forEach(([k, v]) => { if (v) params.set(k, v); });
    if (appliedShowDeleted) params.set("showDeleted", "true");

    const res = await fetch(`/api/orders?${params}`);
    if (res.ok) {
      const json = await res.json();
      setOrders(json.data);
      setTotal(json.pagination.total);
      setTotalPages(json.pagination.totalPages);
    }
    setLoading(false);
  }, [page, appliedFilters, appliedShowDeleted]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  function handleSearch() {
    setAppliedFilters({ ...filterDraft });
    setAppliedShowDeleted(draftShowDeleted);
    setPage(1);
  }

  function handleResetFilters() {
    setFilterDraft({ ...emptyOrderFilters });
    setAppliedFilters({ ...emptyOrderFilters });
    setDraftShowDeleted(false);
    setAppliedShowDeleted(false);
    setPage(1);
  }

  function getAllSpecs() {
    return products.flatMap((p) =>
      p.specs.map((s) => ({
        id: s.id,
        label: `${p.name} - ${s.name} (${formatCurrency(s.price)}/${SPEC_UNIT_LABELS[s.unitType]})`,
        productId: p.id,
        price: s.price,
        unitType: s.unitType,
      }))
    );
  }

  function calcFromItems(items: typeof createForm.items) {
    const specs = getAllSpecs();
    return items.reduce((sum, item) => {
      const spec = specs.find((s) => s.id === item.productSpecId);
      return sum + (spec ? spec.price * item.quantity : 0);
    }, 0);
  }

  useEffect(() => {
    if (createOpen && products.length > 0) {
      const productAmount = calcFromItems(createForm.items);
      const calc = productAmount + (createForm.shippingFee || 0) + (createForm.otherFee || 0);
      setProductAmountPreview(productAmount);
      setCalculatedPreview(calc);
      if (!createForm.amountAdjustReason) {
        setCreateForm((f) => ({ ...f, totalAmount: calc }));
      }
    }
  }, [createForm.items, createForm.shippingFee, createForm.otherFee, products, createOpen]);

  async function loadCreateData() {
    const [cRes, pRes, uRes] = await Promise.all([
      fetch("/api/customers?pageSize=100"),
      fetch("/api/products"),
      canCreate ? fetch("/api/users?role=OPERATIONS") : Promise.resolve(null),
    ]);
    if (cRes.ok) {
      const j = await cRes.json();
      setCustomers(j.data || j);
    }
    if (pRes.ok) setProducts(await pRes.json());
    if (uRes?.ok) setOpsUsers(await uRes.json());
  }

  function openCreate() {
    setCreateForm({
      customerId: "", handlerId: "", notes: "",
      shippingFee: 0, otherFee: 0,
      totalAmount: 0, amountAdjustReason: "",
      items: [{ productSpecId: "", quantity: 1 }],
    });
    setError("");
    loadCreateData();
    setCreateOpen(true);
  }

  async function openDetail(order: Order) {
    const res = await fetch(`/api/orders/${order.id}`);
    if (res.ok) {
      const full = await res.json();
      setSelected(full);
      setPaymentForm({
        paymentStatus: full.paymentStatus || (full.isPaid ? "PAID" : full.paidAmount > 0 ? "PARTIAL" : "UNPAID"),
        paidAmount: full.paidAmount,
        paidAt: full.paidAt ? full.paidAt.slice(0, 16) : "",
      });
      setShippingForm({
        isShipped: full.isShipped,
        carrier: full.shipping?.carrier || "",
        trackingNo: full.shipping?.trackingNo || "",
        address: full.shipping?.address || "",
        shippedAt: full.shipping?.shippedAt ? full.shipping.shippedAt.slice(0, 16) : "",
        notes: full.shipping?.notes || "",
      });
      setEditTotalAmount(full.totalAmount);
      setEditAmountReason("");
      setError("");
      setDetailOpen(true);
    }
  }

  async function handleCreate() {
    setSaving(true);
    setError("");
    const specs = getAllSpecs();
    const items = createForm.items
      .filter((i) => i.productSpecId)
      .map((i) => ({
        productId: specs.find((s) => s.id === i.productSpecId)!.productId,
        productSpecId: i.productSpecId,
        quantity: i.quantity,
      }));

    const body: Record<string, unknown> = {
      customerId: createForm.customerId,
      handlerId: createForm.handlerId || undefined,
      notes: createForm.notes || undefined,
      shippingFee: createForm.shippingFee || 0,
      otherFee: createForm.otherFee || 0,
      items,
    };

    if (createForm.totalAmount !== calculatedPreview) {
      body.totalAmount = createForm.totalAmount;
      body.amountAdjustReason = createForm.amountAdjustReason;
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "创建失败");
      setSaving(false);
      return;
    }
    setCreateOpen(false);
    await loadOrders();
    setSaving(false);
  }

  async function handleUpdateOps() {
    if (!selected) return;
    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {};
    if (canManageOps) {
      body.payment = { ...paymentForm, paidAt: paymentForm.paidAt || undefined };
      body.shipping = { ...shippingForm, shippedAt: shippingForm.shippedAt || undefined };
    }
    if (editTotalAmount !== selected.totalAmount) {
      body.totalAmount = editTotalAmount;
      body.amountAdjustReason = editAmountReason;
    }

    const res = await fetch(`/api/orders/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "更新失败");
      setSaving(false);
      return;
    }
    setSelected(data);
    await loadOrders();
    setSaving(false);
  }

  async function handleDelete(order: Order) {
    if (!confirm(`确定删除订单「${order.orderNo}」？`)) return;
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "删除失败");
      return;
    }
    if (detailOpen && selected?.id === order.id) setDetailOpen(false);
    await loadOrders();
  }

  async function handleRestore(order: Order) {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "恢复失败");
      return;
    }
    await loadOrders();
  }

  const specs = getAllSpecs();

  function getUnitForItem(productSpecId: string) {
    const spec = specs.find((s) => s.id === productSpecId);
    return spec ? SPEC_UNIT_LABELS[spec.unitType] : "";
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold">订单管理</h1>
          <p className="text-muted text-sm mt-1 font-serif">订单全流程跟踪与处理</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            新建订单
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            {isSales ? (
              <>
                <FilterField label="订单号" className="min-w-[160px]">
                  <Input
                    placeholder="输入订单号"
                    value={filterDraft.orderNo}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderNo: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="创建开始日期">
                  <Input
                    type="date"
                    value={filterDraft.orderedStart}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderedStart: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="创建结束日期">
                  <Input
                    type="date"
                    value={filterDraft.orderedEnd}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderedEnd: e.target.value })
                    }
                  />
                </FilterField>
                <label className="flex items-center gap-2 text-sm text-muted pb-2">
                  <input
                    type="checkbox"
                    checked={draftShowDeleted}
                    onChange={(e) => setDraftShowDeleted(e.target.checked)}
                  />
                  仅显示已删除
                </label>
              </>
            ) : (
              <>
                <FilterField label="订单号" className="min-w-[140px]">
                  <Input
                    placeholder="订单号"
                    value={filterDraft.orderNo}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderNo: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="客户" className="min-w-[120px]">
                  <Input
                    placeholder="客户名/ID"
                    value={filterDraft.customer}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, customer: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="销售" className="min-w-[120px]">
                  <Input
                    placeholder="销售名"
                    value={filterDraft.sales}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, sales: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="创建开始日期">
                  <Input
                    type="date"
                    value={filterDraft.orderedStart}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderedStart: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="创建结束日期">
                  <Input
                    type="date"
                    value={filterDraft.orderedEnd}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderedEnd: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="付款开始日期">
                  <Input
                    type="date"
                    value={filterDraft.paidStart}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, paidStart: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="付款结束日期">
                  <Input
                    type="date"
                    value={filterDraft.paidEnd}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, paidEnd: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="付款状态">
                  <Select
                    value={filterDraft.paymentStatus || filterDraft.isPaid}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "true" || v === "false") {
                        setFilterDraft({ ...filterDraft, isPaid: v, paymentStatus: "" });
                      } else {
                        setFilterDraft({ ...filterDraft, paymentStatus: v, isPaid: "" });
                      }
                    }}
                  >
                    <option value="">全部</option>
                    <option value="false">未付款</option>
                    <option value="PARTIAL">部分付款</option>
                    <option value="true">已付款</option>
                  </Select>
                </FilterField>
                <FilterField label="发货状态">
                  <Select
                    value={filterDraft.isShipped}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, isShipped: e.target.value })
                    }
                  >
                    <option value="">全部</option>
                    <option value="true">已发货</option>
                    <option value="false">未发货</option>
                  </Select>
                </FilterField>
                <label className="flex items-center gap-2 text-sm text-muted pb-2">
                  <input
                    type="checkbox"
                    checked={draftShowDeleted}
                    onChange={(e) => setDraftShowDeleted(e.target.checked)}
                  />
                  仅显示已删除
                </label>
              </>
            )}
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              查询
            </Button>
            <Button variant="secondary" onClick={handleResetFilters}>
              重置
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm ink-table">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-3">订单号</th>
                      <th className="pb-3">客户</th>
                      <th className="pb-3">产品</th>
                      <th className="pb-3">销售</th>
                      <th className="pb-3">总金额</th>
                      {isAdmin && <th className="pb-3">毛利</th>}
                      {isAdmin && <th className="pb-3">毛利率</th>}
                      <th className="pb-3">收款</th>
                      <th className="pb-3">发货</th>
                      <th className="pb-3">下单时间</th>
                      <th className="pb-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className={`border-b border-border/40 ${o.isDeleted ? "opacity-60" : ""}`}>
                        <td className="py-3 font-mono text-xs">
                          {o.orderNo}
                          {o.isDeleted && (
                            <Badge variant="warning" className="ml-1">已删除</Badge>
                          )}
                        </td>
                        <td className="py-3">{o.customerName}</td>
                        <td className="py-3 text-xs max-w-[180px] truncate" title={o.itemsSummary}>{o.itemsSummary}</td>
                        <td className="py-3">{o.sales.name}</td>
                        <td className="py-3 font-medium">{formatCurrency(o.totalAmount)}</td>
                        {isAdmin && (
                          <td className="py-3 text-wine">{o.profit !== undefined ? formatCurrency(o.profit) : "-"}</td>
                        )}
                        {isAdmin && (
                          <td className="py-3 text-wine">{o.profitMargin !== undefined ? `${o.profitMargin.toFixed(1)}%` : "-"}</td>
                        )}
                        <td className="py-3">
                          {(() => {
                            const badge = getPaymentBadge(o);
                            return (
                              <Badge variant={badge.variant}>
                                {badge.label}
                                {o.paymentStatus === "PARTIAL" && o.paidAmount > 0
                                  ? ` ${formatCurrency(o.paidAmount)}`
                                  : ""}
                              </Badge>
                            );
                          })()}
                        </td>
                        <td className="py-3">
                          <Badge variant={o.isShipped ? "success" : "default"}>
                            {o.isShipped ? "已发" : "未发"}
                          </Badge>
                        </td>
                        <td className="py-3">{formatDate(o.orderedAt)}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => openDetail(o)} className="text-wine hover:underline text-xs inline-flex items-center gap-0.5">
                              <Eye className="h-3 w-3" />详情
                            </button>
                            {canDelete && !o.isDeleted && (
                              <button onClick={() => handleDelete(o)} className="text-red-700 hover:underline text-xs inline-flex items-center gap-0.5">
                                <Trash2 className="h-3 w-3" />删除
                              </button>
                            )}
                            {isAdmin && o.isDeleted && (
                              <button onClick={() => handleRestore(o)} className="text-wine hover:underline text-xs inline-flex items-center gap-0.5">
                                <RotateCcw className="h-3 w-3" />恢复
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建订单" className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <Label>客户 *</Label>
            <Select value={createForm.customerId} onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}>
              <option value="">请选择</option>
              {(Array.isArray(customers) ? customers : []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>订单处理人员</Label>
            <Select value={createForm.handlerId} onChange={(e) => setCreateForm({ ...createForm, handlerId: e.target.value })}>
              <option value="">可选</option>
              {opsUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>订单产品 *</Label>
            {createForm.items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mt-2 items-center">
                <Select
                  value={item.productSpecId}
                  onChange={(e) => {
                    const items = [...createForm.items];
                    items[idx].productSpecId = e.target.value;
                    setCreateForm({ ...createForm, items });
                  }}
                  className="flex-1"
                >
                  <option value="">选择规格</option>
                  {specs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
                <Input
                  type="number" min={1} value={item.quantity}
                  onChange={(e) => {
                    const items = [...createForm.items];
                    items[idx].quantity = parseInt(e.target.value) || 1;
                    setCreateForm({ ...createForm, items });
                  }}
                  className="w-20"
                />
                <span className="text-sm text-muted w-8">{getUnitForItem(item.productSpecId)}</span>
              </div>
            ))}
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setCreateForm({ ...createForm, items: [...createForm.items, { productSpecId: "", quantity: 1 }] })}>
              添加产品
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>产品金额</Label>
              <Input value={formatCurrency(productAmountPreview)} readOnly className="bg-paper" />
            </div>
            <div>
              <Label>运费</Label>
              <Input
                type="number" step={0.01} min={0}
                value={createForm.shippingFee}
                onChange={(e) => setCreateForm({ ...createForm, shippingFee: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>其它费用</Label>
              <Input
                type="number" step={0.01} min={0}
                value={createForm.otherFee}
                onChange={(e) => setCreateForm({ ...createForm, otherFee: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>系统计算总金额</Label>
              <Input value={formatCurrency(calculatedPreview)} readOnly className="bg-paper" />
            </div>
            <div className="col-span-2">
              <Label>订单总金额</Label>
              <Input
                type="number" step={0.01} min={0}
                value={createForm.totalAmount}
                onChange={(e) => setCreateForm({ ...createForm, totalAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          {createForm.totalAmount !== calculatedPreview && (
            <div>
              <Label>金额调整理由 *</Label>
              <Textarea
                value={createForm.amountAdjustReason}
                onChange={(e) => setCreateForm({ ...createForm, amountAdjustReason: e.target.value })}
                placeholder="请说明修改总金额的原因"
              />
            </div>
          )}
          <div>
            <Label>备注</Label>
            <Textarea value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>取消</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? "提交中..." : "创建"}</Button>
        </ModalFooter>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`订单 ${selected?.orderNo || ""}`} className="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted">客户：</span>{selected.customerName}</div>
              <div><span className="text-muted">销售：</span>{selected.sales.name}</div>
              <div><span className="text-muted">产品金额：</span>{formatCurrency(selected.productAmount ?? 0)}</div>
              <div><span className="text-muted">运费：</span>{formatCurrency(selected.shippingFee ?? 0)}</div>
              <div><span className="text-muted">其它费用：</span>{formatCurrency(selected.otherFee ?? 0)}</div>
              <div><span className="text-muted">系统总金额：</span>{formatCurrency(selected.calculatedAmount)}</div>
              <div><span className="text-muted">订单总金额：</span>{formatCurrency(selected.totalAmount)}</div>
              {selected.amountAdjustReason && (
                <div className="col-span-2"><span className="text-muted">调整理由：</span>{selected.amountAdjustReason}</div>
              )}
              {isAdmin && selected.productCostTotal !== undefined && (
                <div><span className="text-muted">产品成本：</span>{formatCurrency(selected.productCostTotal)}</div>
              )}
              {isAdmin && selected.profit !== undefined && (
                <>
                  <div><span className="text-muted">毛利：</span><span className="text-wine font-medium">{formatCurrency(selected.profit)}</span></div>
                  <div><span className="text-muted">毛利率：</span><span className="text-wine">{selected.profitMargin?.toFixed(1)}%</span></div>
                </>
              )}
            </div>

            {canManageOps && !selected.isDeleted && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>修改总金额</Label>
                  <Input type="number" value={editTotalAmount} onChange={(e) => setEditTotalAmount(parseFloat(e.target.value) || 0)} />
                </div>
                {editTotalAmount !== selected.totalAmount && (
                  <div className="col-span-2">
                    <Label>调整理由 *</Label>
                    <Input value={editAmountReason} onChange={(e) => setEditAmountReason(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {canManageOps && !selected.isDeleted && (
              <>
                <h4 className="font-serif font-medium">收款</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={paymentForm.paymentStatus}
                    onChange={(e) => {
                      const status = e.target.value as "UNPAID" | "PARTIAL" | "PAID";
                      setPaymentForm({
                        ...paymentForm,
                        paymentStatus: status,
                        paidAmount:
                          status === "PAID"
                            ? editTotalAmount
                            : status === "UNPAID"
                              ? 0
                              : paymentForm.paidAmount,
                      });
                    }}
                  >
                    <option value="UNPAID">未收款</option>
                    <option value="PARTIAL">部分付款</option>
                    <option value="PAID">已收款</option>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={paymentForm.paidAmount}
                    disabled={paymentForm.paymentStatus !== "PARTIAL"}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        paidAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="部分付款金额"
                  />
                  <Input type="datetime-local" className="col-span-2" value={paymentForm.paidAt} onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })} />
                </div>
                <h4 className="font-serif font-medium">发货</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={shippingForm.isShipped ? "1" : "0"} onChange={(e) => setShippingForm({ ...shippingForm, isShipped: e.target.value === "1" })}>
                    <option value="0">未发货</option>
                    <option value="1">已发货</option>
                  </Select>
                  <Input placeholder="快递公司" value={shippingForm.carrier} onChange={(e) => setShippingForm({ ...shippingForm, carrier: e.target.value })} />
                  <Input placeholder="运单号" value={shippingForm.trackingNo} onChange={(e) => setShippingForm({ ...shippingForm, trackingNo: e.target.value })} />
                  <Input type="datetime-local" value={shippingForm.shippedAt} onChange={(e) => setShippingForm({ ...shippingForm, shippedAt: e.target.value })} />
                </div>
              </>
            )}

            {selected.auditLogs && selected.auditLogs.length > 0 && (
              <div>
                <h4 className="font-serif font-medium flex items-center gap-1 mb-2">
                  <History className="h-4 w-4" />修改记录
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-2 text-xs border border-border rounded-sm p-3 bg-paper">
                  {selected.auditLogs.map((log) => (
                    <div key={log.id} className="border-b border-border/40 pb-2 last:border-0">
                      <div className="flex justify-between text-muted">
                        <span>{log.userName} · {log.action}</span>
                        <span>{formatDate(log.createdAt)}</span>
                      </div>
                      {log.changes && (
                        <pre className="mt-1 text-foreground/80 whitespace-pre-wrap">{log.changes}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDetailOpen(false)}>关闭</Button>
          {canManageOps && !selected?.isDeleted && (
            <Button onClick={handleUpdateOps} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}
