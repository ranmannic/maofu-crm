"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Upload, Share2, Star, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input, Label, Textarea, Select, QtyInput } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { SPEC_UNIT_LABELS, SPEC_UNIT_OPTIONS } from "@/lib/constants";
import { useShareLink } from "@/hooks/use-share-link";
import { useEdition } from "@/components/edition/edition-provider";
import { ProductStockConfigModal } from "@/components/products/product-stock-config-modal";
import type { SpecUnit } from "@/generated/prisma/client";

interface ProductImage {
  id: string;
  url: string;
  storageKey?: string;
  sortOrder: number;
}

interface ProductSpec {
  id: string;
  name: string;
  unitType: SpecUnit;
  bottlesPerUnit: number;
  price: number;
  cost: number;
  description: string | null;
  thumbnailUrl: string | null;
  thumbnailKey?: string | null;
  retailGuidePrice: number | null;
  retailFloorPrice: number | null;
  groupGuidePrice: number | null;
  groupFloorPrice: number | null;
  wholesaleGuidePrice: number | null;
  wholesaleFloorPrice: number | null;
  stockConfigured?: boolean;
  maxSellable?: number | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  alcoholContent: string | null;
  aromaType: string | null;
  origin: string | null;
  thumbnailUrl: string | null;
  thumbnailKey?: string | null;
  shareToken?: string | null;
  specs: ProductSpec[];
  images: ProductImage[];
}

const emptyRetail = {
  retailGuidePrice: null as number | null,
  retailFloorPrice: null as number | null,
  groupGuidePrice: null as number | null,
  groupFloorPrice: null as number | null,
  wholesaleGuidePrice: null as number | null,
  wholesaleFloorPrice: null as number | null,
};

export default function ProductsPage() {
  const { shareProduct, shareModal } = useShareLink();
  const { isPremiumActive } = useEdition();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productModal, setProductModal] = useState(false);
  const [specModal, setSpecModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [editingSpec, setEditingSpec] = useState<ProductSpec | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specThumbInputRef = useRef<HTMLInputElement>(null);

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    alcoholContent: "",
    aromaType: "",
    origin: "",
  });
  const [specForm, setSpecForm] = useState({
    name: "",
    unitType: "BOTTLE" as SpecUnit,
    bottlesPerUnit: 1,
    price: 0,
    cost: 0,
    description: "",
    ...emptyRetail,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stockConfigTarget, setStockConfigTarget] = useState<{
    productId: string;
    productName: string;
    spec: ProductSpec;
  } | null>(null);

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
    setProductForm({
      name: "",
      description: "",
      alcoholContent: "",
      aromaType: "",
      origin: "",
    });
    setError("");
    setProductModal(true);
  }

  function openProductEdit(p: Product) {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      description: p.description || "",
      alcoholContent: p.alcoholContent || "",
      aromaType: p.aromaType || "",
      origin: p.origin || "",
    });
    setError("");
    setProductModal(true);
  }

  function openSpecCreate(productId: string) {
    setSelectedProductId(productId);
    setEditingSpec(null);
    setSpecForm({
      name: "",
      unitType: "BOTTLE",
      bottlesPerUnit: 1,
      price: 0,
      cost: 0,
      description: "",
      ...emptyRetail,
    });
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
      description: spec.description || "",
      retailGuidePrice: spec.retailGuidePrice,
      retailFloorPrice: spec.retailFloorPrice,
      groupGuidePrice: spec.groupGuidePrice,
      groupFloorPrice: spec.groupFloorPrice,
      wholesaleGuidePrice: spec.wholesaleGuidePrice,
      wholesaleFloorPrice: spec.wholesaleFloorPrice,
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

  async function uploadSpecThumbnail(specId: string, file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/products/specs/${specId}/thumbnail`, {
      method: "POST",
      body: fd,
    });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "上传失败");
      return;
    }
    const updated = await res.json();
    await load();
    if (editingSpec?.id === specId) {
      setEditingSpec((prev) => (prev ? { ...prev, ...updated } : prev));
    }
  }

  async function deleteSpecThumbnail(specId: string) {
    if (!confirm("删除规格缩略图？")) return;
    await fetch(`/api/products/specs/${specId}/thumbnail`, { method: "DELETE" });
    await load();
    if (editingSpec?.id === specId) {
      setEditingSpec((prev) =>
        prev ? { ...prev, thumbnailUrl: null, thumbnailKey: null } : prev
      );
    }
  }

  async function uploadImage(productId: string, file: File, asThumbnail: boolean) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("asThumbnail", String(asThumbnail));
    const res = await fetch(`/api/products/${productId}/images`, {
      method: "POST",
      body: fd,
    });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "上传失败");
      return;
    }
    await load();
    const updated = await fetch(`/api/products/${productId}`).then((r) => r.json());
    if (editingProduct?.id === productId) setEditingProduct(updated);
  }

  async function deleteImage(productId: string, imageId: string) {
    if (!confirm("删除此图片？")) return;
    await fetch(`/api/products/${productId}/images?imageId=${imageId}`, {
      method: "DELETE",
    });
    await load();
    const updated = await fetch(`/api/products/${productId}`).then((r) => r.json());
    if (editingProduct?.id === productId) setEditingProduct(updated);
  }

  async function setThumbnail(productId: string, storageKey: string) {
    await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnailKey: storageKey }),
    });
    await load();
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

  const editingImages = editingProduct?.images ?? [];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-serif font-bold">产品管理</h1>
          <p className="text-muted text-sm mt-1">
            管理产品、相册、零售价格体系与销售/成本价
          </p>
        </div>
        <div className="page-header-actions">
          {isPremiumActive && (
            <Link
              href="/catalog"
              className="inline-flex items-center justify-center rounded-lg font-medium transition-colors bg-paper border border-border text-foreground hover:bg-background font-serif px-4 py-2 text-sm w-full sm:w-auto"
            >
              <Wine className="h-4 w-4 mr-1" />
              产品展示
            </Link>
          )}
          <Button onClick={openProductCreate}>
            <Plus className="h-4 w-4 mr-1" />
            新增产品
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted">加载中...</div>
      ) : (
        <div className="space-y-4">
          {products.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-6">
                <div className="flex gap-4 mb-4">
                  <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-paper border border-border">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted">无图</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-lg">{p.name}</h3>
                        {p.description && (
                          <p className="text-sm text-muted mt-1 line-clamp-2">{p.description}</p>
                        )}
                        {(p.alcoholContent || p.aromaType || p.origin) && (
                          <p className="text-xs text-muted mt-1">
                            {[
                              p.alcoholContent && `酒精度 ${p.alcoholContent}`,
                              p.aromaType && `香型 ${p.aromaType}`,
                              p.origin && `产地 ${p.origin}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        <p className="text-xs text-muted mt-1">{p.images?.length ?? 0} 张相册图</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="secondary" size="sm" onClick={() => openProductEdit(p)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => shareProduct(p.id, p.name)}>
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteProduct(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-scroll">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted">
                        <th className="pb-2 font-medium">规格</th>
                        <th className="pb-2 font-medium">缩略图</th>
                        <th className="pb-2 font-medium">销售价</th>
                        <th className="pb-2 font-medium">成本</th>
                        <th className="pb-2 font-medium hidden lg:table-cell">零售指导价</th>
                        <th className="pb-2 font-medium hidden lg:table-cell">团购指导价</th>
                        <th className="pb-2 font-medium hidden lg:table-cell">批发指导价</th>
                        {isPremiumActive && (
                          <th className="pb-2 font-medium">最大可售数</th>
                        )}
                        <th className="pb-2 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.specs.map((s) => (
                        <tr key={s.id} className="border-b border-border/50">
                          <td className="py-2">
                            <div>{s.name}</div>
                            {s.description && (
                              <div className="text-xs text-muted line-clamp-1 mt-0.5">{s.description}</div>
                            )}
                          </td>
                          <td className="py-2">
                            {s.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                          <td className="py-2">{formatCurrency(s.price)}</td>
                          <td className="py-2">{formatCurrency(s.cost)}</td>
                          <td className="py-2 text-xs hidden lg:table-cell">
                            {s.retailGuidePrice != null ? formatCurrency(s.retailGuidePrice) : "—"}
                          </td>
                          <td className="py-2 text-xs hidden lg:table-cell">
                            {s.groupGuidePrice != null ? formatCurrency(s.groupGuidePrice) : "—"}
                          </td>
                          <td className="py-2 text-xs hidden lg:table-cell">
                            {s.wholesaleGuidePrice != null ? formatCurrency(s.wholesaleGuidePrice) : "—"}
                          </td>
                          {isPremiumActive && (
                            <td className="py-2 text-sm">
                              {s.stockConfigured ? (
                                <span className="font-medium text-wine">
                                  {s.maxSellable ?? 0} {SPEC_UNIT_LABELS[s.unitType]}
                                </span>
                              ) : (
                                <span className="text-muted">尚未配置</span>
                              )}
                            </td>
                          )}
                          <td className="py-2">
                            {isPremiumActive && (
                              <button
                                type="button"
                                onClick={() =>
                                  setStockConfigTarget({
                                    productId: p.id,
                                    productName: p.name,
                                    spec: s,
                                  })
                                }
                                className="text-wine hover:underline mr-3"
                              >
                                配置库存
                              </button>
                            )}
                            <button onClick={() => openSpecEdit(p.id, s)} className="text-wine hover:underline mr-3">
                              编辑
                            </button>
                            <button onClick={() => deleteSpec(s.id)} className="text-red-600 hover:underline">
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => openSpecCreate(p.id)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加规格
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={productModal}
        onClose={() => setProductModal(false)}
        title={editingProduct ? "编辑产品" : "新增产品"}
        className="sm:max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <Label>产品名称 *</Label>
            <Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
          </div>
          <div>
            <Label>产品描述</Label>
            <Textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>酒精度</Label>
              <Input
                placeholder="如 52%vol"
                value={productForm.alcoholContent}
                onChange={(e) => setProductForm({ ...productForm, alcoholContent: e.target.value })}
              />
            </div>
            <div>
              <Label>香型</Label>
              <Input
                placeholder="如 酱香型"
                value={productForm.aromaType}
                onChange={(e) => setProductForm({ ...productForm, aromaType: e.target.value })}
              />
            </div>
            <div>
              <Label>产地</Label>
              <Input
                placeholder="如 贵州茅台镇"
                value={productForm.origin}
                onChange={(e) => setProductForm({ ...productForm, origin: e.target.value })}
              />
            </div>
          </div>
          {editingProduct && (
            <div>
              <Label>产品相册</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {editingImages.map((img) => (
                  <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                      {img.storageKey && (
                        <button
                          type="button"
                          className="p-1 bg-white rounded text-wine"
                          title="设为主图"
                          onClick={() => setThumbnail(editingProduct.id, img.storageKey!)}
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="p-1 bg-white rounded text-red-600"
                        onClick={() => deleteImage(editingProduct.id, img.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted hover:border-wine text-xs"
                >
                  <Upload className="h-5 w-5 mb-1" />
                  上传
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && editingProduct) uploadImage(editingProduct.id, f, editingImages.length === 0);
                  e.target.value = "";
                }}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setProductModal(false)}>取消</Button>
          <Button onClick={saveProduct} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </ModalFooter>
      </Modal>

      <Modal open={specModal} onClose={() => setSpecModal(false)} title={editingSpec ? "编辑规格" : "添加规格"} className="sm:max-w-2xl">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <Label>规格名称 *</Label>
            <Input value={specForm.name} onChange={(e) => setSpecForm({ ...specForm, name: e.target.value })} />
          </div>
          <div>
            <Label>规格描述</Label>
            <Textarea
              value={specForm.description}
              onChange={(e) => setSpecForm({ ...specForm, description: e.target.value })}
              placeholder="该规格的说明文字，分享页可见"
            />
          </div>
          {editingSpec && (
            <div>
              <Label>规格缩略图</Label>
              <div className="flex items-center gap-3 mt-2">
                {editingSpec.thumbnailUrl ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editingSpec.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs"
                      onClick={() => deleteSpecThumbnail(editingSpec.id)}
                    >
                      删除
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => specThumbInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted hover:border-wine text-xs"
                  >
                    <Upload className="h-4 w-4 mb-1" />
                    上传
                  </button>
                )}
                {editingSpec.thumbnailUrl && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={uploading}
                    onClick={() => specThumbInputRef.current?.click()}
                  >
                    更换
                  </Button>
                )}
              </div>
              <input
                ref={specThumbInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && editingSpec) uploadSpecThumbnail(editingSpec.id, f);
                  e.target.value = "";
                }}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>单位</Label>
              <Select value={specForm.unitType} onChange={(e) => setSpecForm({ ...specForm, unitType: e.target.value as SpecUnit })}>
                {SPEC_UNIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>折合瓶数</Label>
              <QtyInput
                min={1}
                value={specForm.bottlesPerUnit}
                onChange={(n) =>
                  setSpecForm({ ...specForm, bottlesPerUnit: n || 1 })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>内部销售价 *</Label>
              <Input type="number" min={0} step={0.01} value={specForm.price} onChange={(e) => setSpecForm({ ...specForm, price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>成本价</Label>
              <Input type="number" min={0} step={0.01} value={specForm.cost} onChange={(e) => setSpecForm({ ...specForm, cost: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <h4 className="font-serif font-medium text-sm pt-2 border-t">零售价格体系（分享页仅显示零售价）</h4>
          {[
            { g: "retailGuidePrice", f: "retailFloorPrice", title: "零售" },
            { g: "groupGuidePrice", f: "groupFloorPrice", title: "团购" },
            { g: "wholesaleGuidePrice", f: "wholesaleFloorPrice", title: "批发" },
          ].map(({ g, f, title }) => (
            <div key={g} className="grid grid-cols-2 gap-3">
              <div>
                <Label>{title}指导价</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={specForm[g as keyof typeof specForm] ?? ""}
                  onChange={(e) =>
                    setSpecForm({
                      ...specForm,
                      [g]: e.target.value === "" ? null : parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>{title}红线价</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={specForm[f as keyof typeof specForm] ?? ""}
                  onChange={(e) =>
                    setSpecForm({
                      ...specForm,
                      [f]: e.target.value === "" ? null : parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setSpecModal(false)}>取消</Button>
          <Button onClick={saveSpec} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </ModalFooter>
      </Modal>

      {stockConfigTarget && (
        <ProductStockConfigModal
          open={!!stockConfigTarget}
          onClose={() => setStockConfigTarget(null)}
          onSaved={() => {
            void load();
          }}
          productId={stockConfigTarget.productId}
          productName={stockConfigTarget.productName}
          spec={stockConfigTarget.spec}
        />
      )}

      {shareModal}
    </div>
  );
}
