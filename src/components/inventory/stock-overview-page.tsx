"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEdition } from "@/components/edition/edition-provider";
import { SellableSpecsList, type SellableItem } from "@/components/inventory/sellable-specs-list";

export function StockOverviewPage() {
  const { isPremiumActive, loading: editionLoading } = useEdition();
  const [items, setItems] = useState<SellableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (editionLoading || !isPremiumActive) return;
    setLoading(true);
    fetch("/api/inventory/sellable")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [editionLoading, isPremiumActive]);

  const filtered = items.filter(
    (i) =>
      !q.trim() ||
      i.productName.includes(q.trim()) ||
      i.specName.includes(q.trim())
  );

  if (editionLoading) {
    return <div className="text-center py-12 text-muted">加载中...</div>;
  }

  if (!isPremiumActive) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted">
          库存一览为高级版功能，请在首页开启高级版体验。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-serif font-bold">库存一览</h1>
        <p className="text-muted text-sm mt-1">
          各规格根据酒体与物料库存自动计算的最大可售数量（只读）
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">规格可售数量</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            className="mb-4 w-full max-w-xs border border-border rounded px-3 py-2 text-sm"
            placeholder="搜索产品或规格"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted">暂无数据</div>
          ) : (
            <SellableSpecsList items={filtered} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
