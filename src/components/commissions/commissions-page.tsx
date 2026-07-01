"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Percent, Coins, X, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { useEdition } from "@/components/edition/edition-provider";
import { formatCommissionValue, currentMonthKey } from "@/lib/sales-commission";

interface ProductOption {
  id: string;
  name: string;
  specs: { id: string; name: string }[];
}

interface SalesOption {
  id: string;
  name: string;
}

interface CommissionRule {
  id: string;
  productId: string;
  productName: string;
  productSpecId: string | null;
  specName: string | null;
  appliesToAllSales: boolean;
  salesIds: string[];
  salesNames: string[];
  kind: "PERCENT" | "FIXED";
  value: number;
  scopeLabel: string;
}

interface CommissionStatRow {
  salesId: string;
  salesName: string;
  paidPerformance: number;
  commission: number;
  reversalCommission: number;
  netCommission: number;
  rank: number;
}

interface StatsResponse {
  month: string;
  data: CommissionStatRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const STATS_PAGE_SIZE = 20;

const emptyForm = {
  productId: "",
  productSpecId: "",
  appliesToAllSales: true,
  salesIds: [] as string[],
  kind: "PERCENT" as "PERCENT" | "FIXED",
  value: "",
};

function medalForRank(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function formatMoney(value: number) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CommissionsPage() {
  const { isPremiumActive, loading: editionLoading } = useEdition();
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesOption[]>([]);
  const [filterProductId, setFilterProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [statsMonth, setStatsMonth] = useState(currentMonthKey());
  const [statsPage, setStatsPage] = useState(1);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === form.productId),
    [products, form.productId]
  );

  const availableSales = useMemo(
    () => salesUsers.filter((s) => !form.salesIds.includes(s.id)),
    [salesUsers, form.salesIds]
  );

  const loadRules = useCallback(async () => {
    const params = filterProductId ? `?productId=${filterProductId}` : "";
    const res = await fetch(`/api/commissions${params}`);
    if (res.ok) setRules(await res.json());
  }, [filterProductId]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const res = await fetch(
      `/api/commissions/stats?month=${statsMonth}&page=${statsPage}`
    );
    if (res.ok) {
      setStats(await res.json());
    }
    setStatsLoading(false);
  }, [statsMonth, statsPage]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filterProductId ? `?productId=${filterProductId}` : "";
    const [rulesRes, productsRes, usersRes] = await Promise.all([
      fetch(`/api/commissions${params}`),
      fetch("/api/products"),
      fetch("/api/users?role=SALES"),
    ]);

    if (rulesRes.ok) setRules(await rulesRes.json());
    if (productsRes.ok) {
      const data = await productsRes.json();
      setProducts(
        (Array.isArray(data) ? data : []).map((p: ProductOption) => ({
          id: p.id,
          name: p.name,
          specs: p.specs ?? [],
        }))
      );
    }
    if (usersRes.ok) {
      const data = await usersRes.json();
      setSalesUsers(Array.isArray(data) ? data : data.data ?? []);
    }
    setLoading(false);
  }, [filterProductId]);

  useEffect(() => {
    if (!editionLoading && isPremiumActive) load();
  }, [editionLoading, isPremiumActive, load]);

  useEffect(() => {
    if (!editionLoading && isPremiumActive) loadStats();
  }, [editionLoading, isPremiumActive, loadStats]);

  useEffect(() => {
    setStatsPage(1);
  }, [statsMonth]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      productId: filterProductId || "",
    });
    setError("");
    setModalOpen(true);
  }

  function openEdit(rule: CommissionRule) {
    setEditing(rule);
    setForm({
      productId: rule.productId,
      productSpecId: rule.productSpecId ?? "",
      appliesToAllSales: rule.appliesToAllSales,
      salesIds: rule.salesIds,
      kind: rule.kind,
      value: String(rule.value),
    });
    setError("");
    setModalOpen(true);
  }

  function addSales(salesId: string) {
    if (!salesId || form.salesIds.includes(salesId)) return;
    setForm((f) => ({
      ...f,
      salesIds: [...f.salesIds, salesId],
    }));
  }

  function removeSales(salesId: string) {
    setForm((f) => ({
      ...f,
      salesIds: f.salesIds.filter((id) => id !== salesId),
    }));
  }

  async function handleSave() {
    if (!form.productId) {
      setError("请选择产品");
      return;
    }
    if (!form.appliesToAllSales && form.salesIds.length === 0) {
      setError("请至少指定一名销售");
      return;
    }
    const value = parseFloat(form.value);
    if (Number.isNaN(value) || value < 0) {
      setError("请输入有效的提成值");
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      productId: form.productId,
      productSpecId: form.productSpecId || null,
      appliesToAllSales: form.appliesToAllSales,
      salesIds: form.appliesToAllSales ? [] : form.salesIds,
      kind: form.kind,
      value,
    };

    const res = await fetch(
      editing ? `/api/commissions/${editing.id}` : "/api/commissions",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }

    setModalOpen(false);
    setSaving(false);
    await Promise.all([loadRules(), loadStats()]);
  }

  async function handleDelete(rule: CommissionRule) {
    if (!confirm(`确定删除「${rule.productName}」的提成规则？`)) return;
    const res = await fetch(`/api/commissions/${rule.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "删除失败");
      return;
    }
    await Promise.all([loadRules(), loadStats()]);
  }

  if (editionLoading) {
    return <div className="text-center py-12 text-muted">加载中...</div>;
  }

  if (!isPremiumActive) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted">
          销售提成配置为高级版功能，请切换至高级版后使用。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-serif font-bold">销售提成</h1>
          <p className="text-muted text-sm mt-1 font-serif">
            按产品、规格与销售范围配置提成规则；未收款业绩不计提成，跨月退款需红冲
          </p>
        </div>
        <div className="page-header-actions">
          <Select
            value={filterProductId}
            onChange={(e) => setFilterProductId(e.target.value)}
            className="w-44"
          >
            <option value="">全部产品</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            新增规则
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">提成规则</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-muted text-sm">
              暂无提成规则。可配置最简单规则：仅选产品 + 全部销售统一提成。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm ink-table">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-2 pr-3">产品</th>
                    <th className="pb-2 pr-3">适用范围</th>
                    <th className="pb-2 pr-3">提成</th>
                    <th className="pb-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-border/40">
                      <td className="py-3 pr-3 font-medium">
                        {rule.productName}
                      </td>
                      <td className="py-3 pr-3 text-muted">
                        {rule.scopeLabel}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge
                          variant={rule.kind === "PERCENT" ? "wine" : "default"}
                        >
                          {rule.kind === "PERCENT" ? (
                            <Percent className="h-3 w-3 mr-1 inline" />
                          ) : (
                            <Coins className="h-3 w-3 mr-1 inline" />
                          )}
                          {formatCommissionValue(rule.kind, rule.value)}
                        </Badge>
                      </td>
                      <td className="py-3 whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => openEdit(rule)}
                          className="text-wine hover:underline text-xs inline-flex items-center gap-0.5"
                        >
                          <Pencil className="h-3 w-3" />
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rule)}
                          className="text-muted hover:text-red-700 text-xs inline-flex items-center gap-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Medal className="h-4 w-4" />
            销售提成统计
          </CardTitle>
          <Input
            type="month"
            value={statsMonth}
            onChange={(e) => setStatsMonth(e.target.value)}
            className="w-40"
          />
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted mb-4">
            按已收款未退款业绩排序。未收款业绩不计提成；当月退款不计提成，跨月退款计入需红冲提成。
          </p>
          {statsLoading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : !stats || stats.data.length === 0 ? (
            <div className="text-center py-12 text-muted text-sm">
              该月份暂无提成数据
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm ink-table">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-2 pr-3">排名</th>
                      <th className="pb-2 pr-3">销售</th>
                      <th className="pb-2 pr-3 text-right">已收款业绩</th>
                      <th className="pb-2 pr-3 text-right">提成</th>
                      <th className="pb-2 pr-3 text-right">需红冲提成</th>
                      <th className="pb-2 text-right">净提成</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.data.map((row) => {
                      const medal = medalForRank(row.rank);
                      return (
                        <tr
                          key={row.salesId}
                          className="border-b border-border/40"
                        >
                          <td className="py-3 pr-3 text-muted">
                            {row.rank}
                          </td>
                          <td className="py-3 pr-3 font-medium">
                            {medal && (
                              <span className="mr-1.5">{medal}</span>
                            )}
                            {row.salesName}
                          </td>
                          <td className="py-3 pr-3 text-right">
                            ¥{formatMoney(row.paidPerformance)}
                          </td>
                          <td className="py-3 pr-3 text-right">
                            ¥{formatMoney(row.commission)}
                          </td>
                          <td className="py-3 pr-3 text-right text-red-700">
                            {row.reversalCommission > 0
                              ? `¥${formatMoney(row.reversalCommission)}`
                              : "—"}
                          </td>
                          <td className="py-3 text-right font-medium">
                            ¥{formatMoney(row.netCommission)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {stats.pagination.totalPages > 1 && (
                <Pagination
                  page={stats.pagination.page}
                  totalPages={stats.pagination.totalPages}
                  total={stats.pagination.total}
                  pageSize={STATS_PAGE_SIZE}
                  onPageChange={setStatsPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "编辑提成规则" : "新增提成规则"}
        className="sm:max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <Label>产品 *</Label>
            <Select
              value={form.productId}
              onChange={(e) =>
                setForm({
                  ...form,
                  productId: e.target.value,
                  productSpecId: "",
                })
              }
            >
              <option value="">请选择产品</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>规格</Label>
            <Select
              value={form.productSpecId}
              onChange={(e) =>
                setForm({ ...form, productSpecId: e.target.value })
              }
              disabled={!form.productId}
            >
              <option value="">全部规格</option>
              {selectedProduct?.specs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>销售范围</Label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={form.appliesToAllSales}
                  onChange={() =>
                    setForm({
                      ...form,
                      appliesToAllSales: true,
                      salesIds: [],
                    })
                  }
                />
                全部销售
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={!form.appliesToAllSales}
                  onChange={() =>
                    setForm({ ...form, appliesToAllSales: false })
                  }
                />
                指定销售
              </label>
            </div>
          </div>

          {!form.appliesToAllSales && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Select
                  defaultValue=""
                  onChange={(e) => {
                    addSales(e.target.value);
                    e.target.value = "";
                  }}
                  className="flex-1"
                >
                  <option value="">添加销售...</option>
                  {availableSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              {form.salesIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.salesIds.map((id) => {
                    const sales = salesUsers.find((s) => s.id === id);
                    return (
                      <Badge key={id} variant="default" className="gap-1 pr-1">
                        {sales?.name ?? id}
                        <button
                          type="button"
                          onClick={() => removeSales(id)}
                          className="ml-1 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>提成方式 *</Label>
              <Select
                value={form.kind}
                onChange={(e) =>
                  setForm({
                    ...form,
                    kind: e.target.value as "PERCENT" | "FIXED",
                  })
                }
              >
                <option value="PERCENT">按销售额百分比</option>
                <option value="FIXED">按单位固定金额</option>
              </Select>
            </div>
            <div>
              <Label>
                {form.kind === "PERCENT"
                  ? "提成比例 (%) *"
                  : "每单位提成 (元) *"}
              </Label>
              <Input
                type="number"
                min={0}
                step={form.kind === "PERCENT" ? 0.1 : 0.01}
                max={form.kind === "PERCENT" ? 100 : undefined}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.kind === "PERCENT" ? "如 5" : "如 10"}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
