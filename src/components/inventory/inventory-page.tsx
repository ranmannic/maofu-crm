"use client";

import { useEffect, useState } from "react";
import { Search, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, QtyInput } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useEdition } from "@/components/edition/edition-provider";

interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  specName: string;
  unitLabel: string;
  bottlesPerUnit: number;
  stockQty: number;
}

const PAGE_SIZE = 20;

export function InventoryPage() {
  const { isPremiumActive, loading: editionLoading } = useEdition();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [stockQty, setStockQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load(p = page, keyword = search) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (keyword) params.set("q", keyword);
    const res = await fetch(`/api/inventory?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
      setPage(data.page ?? 1);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!editionLoading && isPremiumActive) load();
  }, [page, search, editionLoading, isPremiumActive]);

  async function saveStock() {
    if (!editing) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/inventory/specs/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockQty }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setEditing(null);
    await load();
    setSaving(false);
  }

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

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-serif font-bold">库存管理</h1>
          <p className="text-muted text-sm mt-1">按产品规格管理库存数量</p>
        </div>
        <div className="page-header-actions">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(q.trim());
            }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索产品或规格"
              className="w-48"
            />
            <Button type="submit" variant="secondary" size="sm">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            规格库存列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted">暂无规格数据</div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-2 font-medium">产品</th>
                      <th className="pb-2 font-medium">规格</th>
                      <th className="pb-2 font-medium">单位</th>
                      <th className="pb-2 font-medium">库存</th>
                      <th className="pb-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border/50">
                        <td className="py-2.5">{item.productName}</td>
                        <td className="py-2.5">{item.specName}</td>
                        <td className="py-2.5 text-muted">
                          {item.unitLabel}
                          {item.bottlesPerUnit > 1 ? ` · ${item.bottlesPerUnit}瓶` : ""}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={
                              item.stockQty <= 0
                                ? "text-red-600 font-medium"
                                : "font-medium"
                            }
                          >
                            {item.stockQty}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            className="text-wine hover:underline"
                            onClick={() => {
                              setEditing(item);
                              setStockQty(item.stockQty);
                              setError("");
                            }}
                          >
                            调整
                          </button>
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
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="调整库存"
      >
        {editing && (
          <div className="space-y-4">
            <div className="text-sm text-muted">
              {editing.productName} · {editing.specName}
            </div>
            <div>
              <Label>库存数量</Label>
              <QtyInput min={0} value={stockQty} onChange={(n) => setStockQty(n ?? 0)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setEditing(null)}>取消</Button>
          <Button onClick={saveStock} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
