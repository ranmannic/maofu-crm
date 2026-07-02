"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Boxes,
  ListOrdered,
  History,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, QtyInput, Textarea, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useEdition } from "@/components/edition/edition-provider";
import { SellableSpecsList } from "@/components/inventory/sellable-specs-list";

type Tab = "sellable" | "wine" | "materials" | "movements";

interface WineItem {
  id: string;
  productId: string;
  productName: string;
  skuType: "BOTTLE" | "LITER";
  skuLabel: string;
  stockQty: number;
  lowStockThreshold: number;
  notes: string | null;
  isLowStock: boolean;
}

interface MaterialItem {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  lowStockThreshold: number;
  isLowStock: boolean;
}

interface SellableItem {
  id: string;
  productName: string;
  specName: string;
  unitLabel: string;
  stockConfigured: boolean;
  maxSellable: number | null;
}

interface ProductOption {
  id: string;
  name: string;
}

type ActionTarget =
  | { kind: "wine"; item: WineItem }
  | { kind: "material"; item: MaterialItem };

type ActionType =
  | "PURCHASE_IN"
  | "MANUAL_WRITE_OFF"
  | "MANUAL_ADJUST"
  | "THRESHOLD"
  | "CREATE_MATERIAL"
  | "CREATE_WINE"
  | "EDIT_WINE";

export function InventoryPage() {
  const { isPremiumActive, loading: editionLoading } = useEdition();
  const [tab, setTab] = useState<Tab>("sellable");
  const [loading, setLoading] = useState(true);
  const [wines, setWines] = useState<WineItem[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [sellable, setSellable] = useState<SellableItem[]>([]);
  const [movements, setMovements] = useState<
    {
      id: string;
      poolType: string;
      targetName: string;
      unitLabel: string;
      delta: number;
      stockAfter: number;
      reasonLabel: string;
      notes: string | null;
      userName: string | null;
      createdAt: string;
    }[]
  >([]);
  const [movementPage, setMovementPage] = useState(1);
  const [movementTotalPages, setMovementTotalPages] = useState(1);
  const [movementTotal, setMovementTotal] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [actionType, setActionType] = useState<ActionType>("PURCHASE_IN");
  const [qty, setQty] = useState(1);
  const [targetQty, setTargetQty] = useState(0);
  const [threshold, setThreshold] = useState(10);
  const [notes, setNotes] = useState("");
  const [materialForm, setMaterialForm] = useState({ name: "", unit: "个" });
  const [wineForm, setWineForm] = useState({
    productId: "",
    skuType: "BOTTLE" as "BOTTLE" | "LITER",
    lowStockThreshold: 0,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadProducts() {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data.map((p: ProductOption) => ({ id: p.id, name: p.name })));
    }
  }

  async function loadWine() {
    const res = await fetch("/api/inventory/wine");
    if (res.ok) {
      const data = await res.json();
      setWines(data.items ?? []);
      setLowStockCount(data.lowStockCount ?? 0);
    }
  }

  async function loadMaterials() {
    const res = await fetch("/api/inventory/materials");
    if (res.ok) {
      const data = await res.json();
      setMaterials(data.items ?? []);
    }
  }

  async function loadSellable() {
    const res = await fetch("/api/inventory/sellable");
    if (res.ok) {
      const data = await res.json();
      setSellable(data.items ?? []);
    }
  }

  async function loadMovements(page = movementPage) {
    const res = await fetch(`/api/inventory/movements?page=${page}`);
    if (res.ok) {
      const data = await res.json();
      setMovements(data.items ?? []);
      setMovementPage(data.page ?? 1);
      setMovementTotalPages(data.totalPages ?? 1);
      setMovementTotal(data.total ?? 0);
    }
  }

  async function reload() {
    setLoading(true);
    if (tab === "wine") await loadWine();
    else if (tab === "materials") await loadMaterials();
    else if (tab === "sellable") await loadSellable();
    else await loadMovements();
    setLoading(false);
  }

  useEffect(() => {
    if (!editionLoading && isPremiumActive) {
      void loadProducts();
      reload();
    }
  }, [tab, editionLoading, isPremiumActive, movementPage]);

  function openWineAction(item: WineItem, type: ActionType) {
    setActionTarget({ kind: "wine", item });
    setActionType(type);
    setQty(1);
    setTargetQty(item.stockQty);
    setThreshold(item.lowStockThreshold);
    setNotes(item.notes ?? "");
    setError("");
  }

  function openMaterialAction(item: MaterialItem, type: ActionType) {
    setActionTarget({ kind: "material", item });
    setActionType(type);
    setQty(1);
    setTargetQty(item.stockQty);
    setThreshold(item.lowStockThreshold);
    setNotes("");
    setError("");
  }

  function openCreateWine() {
    setActionTarget(null);
    setActionType("CREATE_WINE");
    setWineForm({ productId: products[0]?.id ?? "", skuType: "BOTTLE", lowStockThreshold: 0, notes: "" });
    setError("");
  }

  function openCreateMaterial() {
    setActionTarget(null);
    setActionType("CREATE_MATERIAL");
    setMaterialForm({ name: "", unit: "个" });
    setError("");
  }

  async function saveAction() {
    setSaving(true);
    setError("");

    if (actionType === "CREATE_MATERIAL") {
      if (!materialForm.name.trim()) {
        setError("请填写物料名称");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/inventory/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: materialForm.name.trim(),
          unit: materialForm.unit.trim() || "个",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "创建失败");
        setSaving(false);
        return;
      }
      closeModal();
      await reload();
      setSaving(false);
      return;
    }

    if (actionType === "CREATE_WINE") {
      if (!wineForm.productId) {
        setError("请选择产品");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/inventory/wine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wineForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "创建失败");
        setSaving(false);
        return;
      }
      closeModal();
      await reload();
      setSaving(false);
      return;
    }

    if (!actionTarget) {
      setSaving(false);
      return;
    }

    if (actionType === "THRESHOLD" || actionType === "EDIT_WINE") {
      const url =
        actionTarget.kind === "wine"
          ? `/api/inventory/wine/${actionTarget.item.id}`
          : `/api/inventory/materials/${actionTarget.item.id}`;
      const body =
        actionTarget.kind === "wine" && actionType === "EDIT_WINE"
          ? { lowStockThreshold: threshold, notes: notes.trim() || null }
          : { lowStockThreshold: threshold };
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存失败");
        setSaving(false);
        return;
      }
    } else {
      const url =
        actionTarget.kind === "wine"
          ? `/api/inventory/wine/${actionTarget.item.id}/movements`
          : `/api/inventory/materials/${actionTarget.item.id}/movements`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: actionType,
          quantity: qty,
          targetQty: actionType === "MANUAL_ADJUST" ? targetQty : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "操作失败");
        setSaving(false);
        return;
      }
    }

    closeModal();
    await reload();
    setSaving(false);
  }

  function closeModal() {
    setActionTarget(null);
    setActionType("PURCHASE_IN");
  }

  async function deleteWine(id: string) {
    if (!confirm("确定删除该酒体库存记录？")) return;
    const res = await fetch(`/api/inventory/wine/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "删除失败");
      return;
    }
    await reload();
  }

  async function deleteMaterial(id: string) {
    if (!confirm("确定删除该物料？")) return;
    const res = await fetch(`/api/inventory/materials/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "删除失败");
      return;
    }
    await reload();
  }

  const modalOpen =
    actionType === "CREATE_MATERIAL" ||
    actionType === "CREATE_WINE" ||
    !!actionTarget;

  if (editionLoading) {
    return <div className="text-center py-12 text-muted">加载中...</div>;
  }

  if (!isPremiumActive) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted">
          库存管理为高级版功能，请在首页开启高级版体验。
        </CardContent>
      </Card>
    );
  }

  const actionTitle =
    actionType === "PURCHASE_IN"
      ? "入库"
      : actionType === "MANUAL_WRITE_OFF"
        ? "销库"
        : actionType === "MANUAL_ADJUST"
          ? "盘点调整"
          : actionType === "THRESHOLD"
            ? "预警阈值"
            : actionType === "EDIT_WINE"
              ? "编辑酒体库存"
              : actionType === "CREATE_WINE"
                ? "新增酒体库存"
                : "新增物料";

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-serif font-bold">库存管理</h1>
          <p className="text-muted text-sm mt-1">
            酒体（瓶/升）与物料独立管理；规格最大可售数由库存依据自动计算
          </p>
        </div>
      </div>

      {lowStockCount > 0 && tab === "wine" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          有 {lowStockCount} 条酒体库存低于预警线
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["sellable", "规格最大可售数", ListOrdered],
            ["wine", "酒体库存", Package],
            ["materials", "物料库存", Boxes],
            ["movements", "库存流水", History],
          ] as const
        ).map(([key, label, Icon]) => (
          <Button
            key={key}
            variant={tab === key ? "primary" : "secondary"}
            size="sm"
            onClick={() => setTab(key)}
          >
            <Icon className="h-4 w-4 mr-1" />
            {label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-base">
            {tab === "sellable" && "规格最大可售数"}
            {tab === "wine" && "酒体库存"}
            {tab === "materials" && "物料库存"}
            {tab === "movements" && "库存流水"}
          </CardTitle>
          {tab === "wine" && (
            <Button size="sm" onClick={openCreateWine}>
              <Plus className="h-4 w-4 mr-1" />
              新增酒体
            </Button>
          )}
          {tab === "materials" && (
            <Button size="sm" onClick={openCreateMaterial}>
              <Plus className="h-4 w-4 mr-1" />
              新增物料
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : tab === "sellable" ? (
            sellable.length === 0 ? (
              <div className="text-center py-12 text-muted">暂无数据</div>
            ) : (
              <SellableSpecsList items={sellable} />
            )
          ) : tab === "wine" ? (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted">
                    <th className="pb-2">产品</th>
                    <th className="pb-2">SKU</th>
                    <th className="pb-2">库存</th>
                    <th className="pb-2">预警线</th>
                    <th className="pb-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {wines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted">
                        暂无酒体库存，请点击「新增酒体」创建
                      </td>
                    </tr>
                  ) : (
                    wines.map((w) => (
                      <tr key={w.id} className="border-b border-border/50">
                        <td className="py-2.5">{w.productName}</td>
                        <td className="py-2.5">{w.skuLabel}</td>
                        <td className="py-2.5">
                          <span
                            className={
                              w.isLowStock ? "text-red-600 font-semibold" : "font-medium"
                            }
                          >
                            {w.stockQty} {w.skuLabel}
                          </span>
                          {w.isLowStock && (
                            <Badge variant="warning" className="ml-1">
                              低
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 text-muted">{w.lowStockThreshold}</td>
                        <td className="py-2.5 space-x-2 text-xs whitespace-nowrap">
                          <button
                            type="button"
                            className="text-wine hover:underline"
                            onClick={() => openWineAction(w, "PURCHASE_IN")}
                          >
                            入库
                          </button>
                          <button
                            type="button"
                            className="text-wine hover:underline"
                            onClick={() => openWineAction(w, "MANUAL_WRITE_OFF")}
                          >
                            销库
                          </button>
                          <button
                            type="button"
                            className="text-muted hover:underline"
                            onClick={() => openWineAction(w, "MANUAL_ADJUST")}
                          >
                            盘点
                          </button>
                          <button
                            type="button"
                            className="text-muted hover:underline"
                            onClick={() => openWineAction(w, "THRESHOLD")}
                          >
                            阈值
                          </button>
                          <button
                            type="button"
                            className="text-muted hover:underline"
                            onClick={() => openWineAction(w, "EDIT_WINE")}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="text-red-700 hover:underline"
                            onClick={() => deleteWine(w.id)}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : tab === "materials" ? (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted">
                    <th className="pb-2">物料</th>
                    <th className="pb-2">库存</th>
                    <th className="pb-2">预警线</th>
                    <th className="pb-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="py-2.5">{m.name}</td>
                      <td className="py-2.5">
                        <span
                          className={
                            m.isLowStock ? "text-red-600 font-semibold" : "font-medium"
                          }
                        >
                          {m.stockQty} {m.unit}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted">{m.lowStockThreshold}</td>
                      <td className="py-2.5 space-x-2 text-xs">
                        <button
                          type="button"
                          className="text-wine hover:underline"
                          onClick={() => openMaterialAction(m, "PURCHASE_IN")}
                        >
                          入库
                        </button>
                        <button
                          type="button"
                          className="text-wine hover:underline"
                          onClick={() => openMaterialAction(m, "MANUAL_WRITE_OFF")}
                        >
                          销库
                        </button>
                        <button
                          type="button"
                          className="text-muted hover:underline"
                          onClick={() => openMaterialAction(m, "MANUAL_ADJUST")}
                        >
                          盘点
                        </button>
                        <button
                          type="button"
                          className="text-muted hover:underline"
                          onClick={() => openMaterialAction(m, "THRESHOLD")}
                        >
                          阈值
                        </button>
                        <button
                          type="button"
                          className="text-red-700 hover:underline"
                          onClick={() => deleteMaterial(m.id)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted">
                      <th className="pb-2">时间</th>
                      <th className="pb-2">对象</th>
                      <th className="pb-2">类型</th>
                      <th className="pb-2">变动</th>
                      <th className="pb-2">结存</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-b border-border/50">
                        <td className="py-2 text-xs text-muted">
                          {new Date(m.createdAt).toLocaleString("zh-CN")}
                        </td>
                        <td className="py-2">{m.targetName}</td>
                        <td className="py-2">{m.reasonLabel}</td>
                        <td
                          className={`py-2 font-medium ${m.delta > 0 ? "text-green-700" : "text-red-700"}`}
                        >
                          {m.delta > 0 ? "+" : ""}
                          {m.delta} {m.unitLabel}
                        </td>
                        <td className="py-2">
                          {m.stockAfter} {m.unitLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={movementPage}
                totalPages={movementTotalPages}
                total={movementTotal}
                pageSize={30}
                onPageChange={setMovementPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={closeModal} title={actionTitle}>
        <div className="space-y-4">
          {actionType === "CREATE_MATERIAL" ? (
            <>
              <div>
                <Label>物料名称 *</Label>
                <Input
                  value={materialForm.name}
                  onChange={(e) =>
                    setMaterialForm({ ...materialForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>单位</Label>
                <Input
                  value={materialForm.unit}
                  onChange={(e) =>
                    setMaterialForm({ ...materialForm, unit: e.target.value })
                  }
                />
              </div>
            </>
          ) : actionType === "CREATE_WINE" ? (
            <>
              <div>
                <Label>产品 *</Label>
                <Select
                  value={wineForm.productId}
                  onChange={(e) =>
                    setWineForm({ ...wineForm, productId: e.target.value })
                  }
                >
                  <option value="">请选择</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>SKU 类型 *</Label>
                <Select
                  value={wineForm.skuType}
                  onChange={(e) =>
                    setWineForm({
                      ...wineForm,
                      skuType: e.target.value as "BOTTLE" | "LITER",
                    })
                  }
                >
                  <option value="BOTTLE">瓶（瓶装）</option>
                  <option value="LITER">升（散酒）</option>
                </Select>
              </div>
              <div>
                <Label>低库存预警线</Label>
                <QtyInput
                  min={0}
                  value={wineForm.lowStockThreshold}
                  onChange={(n) =>
                    setWineForm({ ...wineForm, lowStockThreshold: n ?? 0 })
                  }
                />
              </div>
              <div>
                <Label>备注</Label>
                <Textarea
                  value={wineForm.notes}
                  onChange={(e) => setWineForm({ ...wineForm, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </>
          ) : actionTarget ? (
            <>
              <div className="text-sm text-muted">
                {actionTarget.kind === "wine"
                  ? `${actionTarget.item.productName} · ${actionTarget.item.skuLabel}`
                  : actionTarget.item.name}
              </div>
              {actionType === "THRESHOLD" ? (
                <div>
                  <Label>低库存预警线</Label>
                  <QtyInput
                    min={0}
                    value={threshold}
                    onChange={(n) => setThreshold(n ?? 0)}
                  />
                </div>
              ) : actionType === "EDIT_WINE" ? (
                <>
                  <div>
                    <Label>低库存预警线</Label>
                    <QtyInput
                      min={0}
                      value={threshold}
                      onChange={(n) => setThreshold(n ?? 0)}
                    />
                  </div>
                  <div>
                    <Label>备注</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                  </div>
                </>
              ) : actionType === "MANUAL_ADJUST" ? (
                <div>
                  <Label>盘点后数量</Label>
                  <QtyInput min={0} value={targetQty} onChange={(n) => setTargetQty(n ?? 0)} />
                </div>
              ) : (
                <div>
                  <Label>{actionType === "PURCHASE_IN" ? "入库数量" : "销库数量"}</Label>
                  <QtyInput min={1} value={qty} onChange={(n) => setQty(n ?? 1)} />
                </div>
              )}
              {actionType !== "THRESHOLD" &&
                actionType !== "EDIT_WINE" && (
                  <div>
                    <Label>备注</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                  </div>
                )}
            </>
          ) : null}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={closeModal}>
            取消
          </Button>
          <Button onClick={saveAction} disabled={saving}>
            {saving ? "提交中..." : "确认"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
