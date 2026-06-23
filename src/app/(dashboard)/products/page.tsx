"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input, Label, Textarea, Select, QtyInput } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { SPEC_UNIT_LABELS, SPEC_UNIT_OPTIONS } from "@/lib/constants";
import type { SpecUnit } from "@/generated/prisma/client";

interface ProductSpec {
  id: string;
  name: string;
  unitType: SpecUnit;
  bottlesPerUnit: number;
  price: number;
  cost: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  specs: ProductSpec[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productModal, setProductModal] = useState(false);
  const [specModal, setSpecModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [editingSpec, setEditingSpec] = useState<ProductSpec | null>(null);

  const [productForm, setProductForm] = useState({ name: "", description: "" });
  const [specForm, setSpecForm] = useState({
    name: "",
    unitType: "BOTTLE" as SpecUnit,
    bottlesPerUnit: 1,
    price: 0,
    cost: 0,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/products");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openProductCreate() {
    setEditingProduct(null);
    setProductForm({ name: "", description: "" });
    setError("");
    setProductModal(true);
  }

  function openProductEdit(p: Product) {
    setEditingProduct(p);
    setProductForm({ name: p.name, description: p.description || "" });
    setError("");
    setProductModal(true);
  }

  function openSpecCreate(productId: string) {
    setSelectedProductId(productId);
    setEditingSpec(null);
    setSpecForm({ name: "", unitType: "BOTTLE", bottlesPerUnit: 1, price: 0, cost: 0 });
    setError("");
    setSpecModal(true);
  }

  function openSpecEdit(productId: string, spec: ProductSpec) {
    setSelectedProductId(productId);
    setEditingSpec(spec);
    setSpecForm({
      name: spec.name,
      unitType: spec.unitType,
      bottlesPerUnit: spec.bottlesPerUnit ?? 1,
      price: spec.price,
      cost: spec.cost,
    });
    setError("");
    setSpecModal(true);
  }

  async function saveProduct() {
    setSaving(true);
    setError("");
    const url = editingProduct
      ? `/api/products/${editingProduct.id}`
      : "/api/products";
    const method = editingProduct ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setProductModal(false);
    await load();
    setSaving(false);
  }

  async function saveSpec() {
    setSaving(true);
    setError("");
    const url = editingSpec
      ? `/api/products/specs/${editingSpec.id}`
      : `/api/products/${selectedProductId}/specs`;
    const method = editingSpec ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(specForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setSpecModal(false);
    await load();
    setSaving(false);
  }

  async function deleteProduct(id: string) {
    if (!confirm("确定删除此产品？")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    await load();
  }

  async function deleteSpec(id: string) {
    if (!confirm("确定删除此规格？")) return;
    await fetch(`/api/products/specs/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold">产品管理</h1>
          <p className="text-muted text-sm mt-1">
            管理产品、规格与销售价/成本价
          </p>
        </div>
        <Button onClick={openProductCreate}>
          <Plus className="h-4 w-4 mr-1" />
          新增产品
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted">加载中...</div>
      ) : (
        <div className="space-y-4">
          {products.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{p.name}</h3>
                    {p.description && (
                      <p className="text-sm text-muted mt-1">{p.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openProductEdit(p)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteProduct(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-2 font-medium">规格</th>
                      <th className="pb-2 font-medium">单位</th>
                      <th className="pb-2 font-medium">折合瓶数</th>
                      <th className="pb-2 font-medium">销售价</th>
                      <th className="pb-2 font-medium">成本价</th>
                      <th className="pb-2 font-medium">毛利</th>
                      <th className="pb-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.specs.map((s) => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="py-2">{s.name}</td>
                        <td className="py-2">{SPEC_UNIT_LABELS[s.unitType]}</td>
                        <td className="py-2">{s.bottlesPerUnit ?? 1}瓶</td>
                        <td className="py-2">{formatCurrency(s.price)}</td>
                        <td className="py-2">{formatCurrency(s.cost)}</td>
                        <td className="py-2 text-wine">
                          {formatCurrency(s.price - s.cost)}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => openSpecEdit(p.id, s)}
                            className="text-wine hover:underline mr-3"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => deleteSpec(s.id)}
                            className="text-red-600 hover:underline"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => openSpecCreate(p.id)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加规格
                </Button>
              </CardContent>
            </Card>
          ))}
          {products.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted">
                暂无产品
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={productModal}
        onClose={() => setProductModal(false)}
        title={editingProduct ? "编辑产品" : "新增产品"}
      >
        <div className="space-y-4">
          <div>
            <Label>产品名称 *</Label>
            <Input
              value={productForm.name}
              onChange={(e) =>
                setProductForm({ ...productForm, name: e.target.value })
              }
            />
          </div>
          <div>
            <Label>产品描述</Label>
            <Textarea
              value={productForm.description}
              onChange={(e) =>
                setProductForm({ ...productForm, description: e.target.value })
              }
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setProductModal(false)}>
            取消
          </Button>
          <Button onClick={saveProduct} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={specModal}
        onClose={() => setSpecModal(false)}
        title={editingSpec ? "编辑规格" : "添加规格"}
      >
        <div className="space-y-4">
          <div>
            <Label>规格名称 *</Label>
            <Input
              value={specForm.name}
              onChange={(e) =>
                setSpecForm({ ...specForm, name: e.target.value })
              }
              placeholder="如：750ml 单瓶"
            />
          </div>
          <div>
            <Label>规格单位 *</Label>
            <Select
              value={specForm.unitType}
              onChange={(e) =>
                setSpecForm({
                  ...specForm,
                  unitType: e.target.value as SpecUnit,
                })
              }
            >
              {SPEC_UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>折合瓶数 *</Label>
            <QtyInput
              min={1}
              value={specForm.bottlesPerUnit}
              onChange={(n) =>
                setSpecForm({
                  ...specForm,
                  bottlesPerUnit: n || 1,
                })
              }
              placeholder="该规格对应瓶数，如整箱6瓶填6"
            />
          </div>
          <div>
            <Label>销售价 *</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={specForm.price}
              onChange={(e) =>
                setSpecForm({
                  ...specForm,
                  price: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
          <div>
            <Label>成本价</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={specForm.cost}
              onChange={(e) =>
                setSpecForm({
                  ...specForm,
                  cost: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setSpecModal(false)}>
            取消
          </Button>
          <Button onClick={saveSpec} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
