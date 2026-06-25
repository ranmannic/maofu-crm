"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, RotateCcw, ArrowRightLeft, Search, MapPin, Upload, Share2 } from "lucide-react";
import { FilterField } from "@/components/ui/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth-types";
import { CustomerShippingAddressModal } from "@/components/customers/customer-shipping-address-modal";

interface Channel {
  id: string;
  name: string;
  parent?: { id: string; name: string } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  channelName: string | null;
  channel?: { id: string; name: string } | null;
  address: string | null;
  customerStatus: "LEAD" | "CLOSED";
  sales: { id: string; name: string };
  _count: { orders: number };
  createdAt: string;
  isDeleted?: boolean;
}

interface SalesUser {
  id: string;
  name: string;
}

export function CustomersPage({ user }: { user: SessionUser }) {
  const isAdmin = user.role === "ADMIN";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [appliedQ, setAppliedQ] = useState("");
  const [appliedSalesFilter, setAppliedSalesFilter] = useState("");
  const [appliedShowDeleted, setAppliedShowDeleted] = useState(false);

  const [draftQ, setDraftQ] = useState("");
  const [draftSalesFilter, setDraftSalesFilter] = useState("");
  const [draftShowDeleted, setDraftShowDeleted] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [transferTarget, setTransferTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    channelId: "",
    address: "",
    customerStatus: "LEAD" as "LEAD" | "CLOSED",
  });
  const [transferSalesId, setTransferSalesId] = useState("");
  const [shippingCustomer, setShippingCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    if (appliedQ) params.set("q", appliedQ);
    if (appliedSalesFilter) params.set("salesId", appliedSalesFilter);
    if (appliedShowDeleted) params.set("showDeleted", "true");

    const res = await fetch(`/api/customers?${params}`);
    if (res.ok) {
      const json = await res.json();
      setCustomers(json.data);
      setTotal(json.pagination.total);
      setTotalPages(json.pagination.totalPages);
    }
    setLoading(false);
  }, [page, appliedQ, appliedSalesFilter, appliedShowDeleted]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearch() {
    setAppliedQ(draftQ);
    setAppliedSalesFilter(draftSalesFilter);
    setAppliedShowDeleted(draftShowDeleted);
    setPage(1);
  }

  function handleResetFilters() {
    setDraftQ("");
    setDraftSalesFilter("");
    setDraftShowDeleted(false);
    setAppliedQ("");
    setAppliedSalesFilter("");
    setAppliedShowDeleted(false);
    setPage(1);
  }

  useEffect(() => {
    fetch("/api/channels?leafOnly=true").then(async (r) => {
      if (r.ok) setChannels(await r.json());
    });
    if (isAdmin) {
      fetch("/api/users?role=SALES").then(async (r) => {
        if (r.ok) setSalesUsers(await r.json());
      });
    }
  }, [isAdmin]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", phone: "", channelId: "", address: "", customerStatus: "LEAD" });
    setError("");
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: "",
      channelId: c.channel?.id || "",
      address: c.address || "",
      customerStatus: c.customerStatus,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const url = editing ? `/api/customers/${editing.id}` : "/api/customers";
    const method = editing ? "PATCH" : "POST";
    const body = editing
      ? {
          name: form.name,
          channelId: form.channelId || null,
          address: form.address,
          ...(isAdmin ? { customerStatus: form.customerStatus } : {}),
        }
      : form;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setModalOpen(false);
    await load();
    setSaving(false);
  }

  async function handleDelete(c: Customer) {
    if (!confirm(`确定删除客户「${c.name}」？删除后其历史订单数据将保留。`)) return;
    const res = await fetch(`/api/customers/${c.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "删除失败");
      return;
    }
    await load();
  }

  async function handleRestore(c: Customer) {
    const res = await fetch(`/api/customers/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    if (res.ok) await load();
  }

  async function handleTransfer() {
    if (!transferTarget || !transferSalesId) return;
    setSaving(true);
    const res = await fetch(`/api/customers/${transferTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salesId: transferSalesId }),
    });
    if (res.ok) {
      setTransferOpen(false);
      await load();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-serif font-bold">客户管理</h1>
          <p className="text-muted text-sm mt-1 font-serif">
            维护客户档案与渠道归属
          </p>
        </div>
        <div className="page-header-actions">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          新增客户
        </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="filter-grid">
            <FilterField label="客户ID / 客户名 / 销售" className="filter-field-wide">
              <Input
                placeholder="输入关键词"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
              />
            </FilterField>
            {isAdmin && (
              <>
                <FilterField label="负责销售" className="filter-field">
                  <Select
                    value={draftSalesFilter}
                    onChange={(e) => setDraftSalesFilter(e.target.value)}
                  >
                    <option value="">全部销售</option>
                    {salesUsers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </FilterField>
                <FilterField label="筛选">
                  <label className="flex items-center gap-2 h-[38px] text-sm text-muted font-serif">
                    <input
                      type="checkbox"
                      checked={draftShowDeleted}
                      onChange={(e) => setDraftShowDeleted(e.target.checked)}
                    />
                    仅显示已删除
                  </label>
                </FilterField>
              </>
            )}
            <div className="filter-actions">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              查询
            </Button>
            <Button variant="secondary" onClick={handleResetFilters}>
              重置
            </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="w-full text-sm ink-table">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-3">客户ID</th>
                      <th className="pb-3">客户名称</th>
                      <th className="pb-3">电话</th>
                      <th className="pb-3">渠道</th>
                      <th className="pb-3">客户状态</th>
                      <th className="pb-3">负责销售</th>
                      <th className="pb-3">订单数</th>
                      <th className="pb-3">创建时间</th>
                      <th className="pb-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr
                        key={c.id}
                        className={`border-b border-border/40 ${c.isDeleted ? "opacity-60" : ""}`}
                      >
                        <td className="py-3 font-mono text-xs">{c.id.slice(0, 8)}…</td>
                        <td className="py-3 font-medium">
                          <Link
                            href={`/customers/${c.id}`}
                            className="text-wine hover:underline"
                          >
                            {c.name}
                          </Link>
                          {c.isDeleted && (
                            <Badge variant="warning" className="ml-2">已删除</Badge>
                          )}
                        </td>
                        <td className="py-3">{c.phone}</td>
                        <td className="py-3">
                          {c.channelName ? (
                            <Badge variant="wine">{c.channelName}</Badge>
                          ) : "-"}
                        </td>
                        <td className="py-3">
                          <Badge variant={c.customerStatus === "CLOSED" ? "success" : "wine"}>
                            {c.customerStatus === "CLOSED" ? "成交客户" : "线索客户"}
                          </Badge>
                        </td>
                        <td className="py-3">{c.sales.name}</td>
                        <td className="py-3">{c._count.orders}</td>
                        <td className="py-3">{formatDate(c.createdAt)}</td>
                        <td className="py-3 space-x-2">
                          {!c.isDeleted && (
                            <>
                              <button onClick={() => openEdit(c)} className="text-wine hover:underline text-xs inline-flex items-center gap-0.5">
                                <Pencil className="h-3 w-3" />编辑
                              </button>
                              <button
                                onClick={() => setShippingCustomer(c)}
                                className="text-wine hover:underline text-xs inline-flex items-center gap-0.5"
                              >
                                <MapPin className="h-3 w-3" />收货信息
                              </button>
                              <button onClick={() => handleDelete(c)} className="text-red-700 hover:underline text-xs inline-flex items-center gap-0.5">
                                <Trash2 className="h-3 w-3" />删除
                              </button>
                            </>
                          )}
                          {isAdmin && c.isDeleted && (
                            <button onClick={() => handleRestore(c)} className="text-wine hover:underline text-xs inline-flex items-center gap-0.5">
                              <RotateCcw className="h-3 w-3" />恢复
                            </button>
                          )}
                          {isAdmin && !c.isDeleted && (
                            <button
                              onClick={() => { setTransferTarget(c); setTransferSalesId(""); setTransferOpen(true); }}
                              className="text-muted hover:text-wine text-xs inline-flex items-center gap-0.5"
                            >
                              <ArrowRightLeft className="h-3 w-3" />转移
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={DEFAULT_PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "编辑客户" : "新增客户"}>
        <div className="space-y-4">
          <div>
            <Label>客户名称 *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          {!editing && (
            <div>
              <Label>联系电话（创建后不可修改）</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          )}
          {editing && (
            <p className="text-xs text-muted font-serif">手机号创建后不可修改</p>
          )}
          <div>
            <Label>渠道</Label>
            <Select value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })}>
              <option value="">请选择</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.parent ? `${ch.parent.name} / ${ch.name}` : ch.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>地址</Label>
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          {isAdmin && editing && (
            <div>
              <Label>客户状态</Label>
              <Select
                value={form.customerStatus}
                onChange={(e) =>
                  setForm({
                    ...form,
                    customerStatus: e.target.value as "LEAD" | "CLOSED",
                  })
                }
              >
                <option value="LEAD">线索客户</option>
                <option value="CLOSED">成交客户</option>
              </Select>
              <p className="text-xs text-muted mt-1 font-serif">
                订单确认收款后会自动设为成交；也可在此手动调整
              </p>
            </div>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </ModalFooter>
      </Modal>

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="转移客户">
        <p className="text-sm mb-3 font-serif">
          将「{transferTarget?.name}」转给指定销售
        </p>
        <Select value={transferSalesId} onChange={(e) => setTransferSalesId(e.target.value)}>
          <option value="">选择销售</option>
          {salesUsers.filter((s) => s.id !== transferTarget?.sales.id).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setTransferOpen(false)}>取消</Button>
          <Button onClick={handleTransfer} disabled={saving || !transferSalesId}>确认转移</Button>
        </ModalFooter>
      </Modal>

      <CustomerShippingAddressModal
        open={!!shippingCustomer}
        customer={shippingCustomer}
        onClose={() => setShippingCustomer(null)}
      />
    </div>
  );
}
