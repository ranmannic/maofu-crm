"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { SPEC_UNIT_LABELS } from "@/lib/constants";
import type { SpecUnit } from "@/generated/prisma/client";

interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  specs: {
    id: string;
    name: string;
    unitType: SpecUnit;
    retailGuidePrice: number | null;
    retailFloorPrice: number | null;
    groupGuidePrice: number | null;
    groupFloorPrice: number | null;
    wholesaleGuidePrice: number | null;
    wholesaleFloorPrice: number | null;
  }[];
  images: { id: string; url: string }[];
}

export default function CatalogDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<CatalogProduct | null>(null);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then(setProduct);
  }, [id]);

  async function share() {
    const res = await fetch(`/api/products/${id}/share`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "失败");
    const url = data.shareUrl || `${window.location.origin}/share/product/${data.shareToken}`;
    await navigator.clipboard.writeText(url);
    alert("客户分享链接已复制");
  }

  if (!product) {
    return <div className="text-center py-16 text-muted">加载中...</div>;
  }

  const gallery = product.images.length
    ? product.images
    : product.thumbnailUrl
      ? [{ id: "thumb", url: product.thumbnailUrl }]
      : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/catalog">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
        </Link>
        <Button size="sm" onClick={share}>
          <Share2 className="h-3.5 w-3.5 mr-1" />
          分享给客户
        </Button>
      </div>
      <h1 className="text-2xl font-serif font-bold">{product.name}</h1>
      {product.description && (
        <p className="text-muted whitespace-pre-wrap">{product.description}</p>
      )}
      {gallery.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {gallery.map((img) => (
            <div key={img.id} className="aspect-square rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {product.specs.map((s) => (
          <div key={s.id} className="border border-border rounded-lg p-4 bg-paper/30">
            <div className="flex justify-between mb-2">
              <span className="font-medium">{s.name}</span>
              <Badge variant="wine">{SPEC_UNIT_LABELS[s.unitType]}</Badge>
            </div>
            {[
              ["零售", s.retailGuidePrice, s.retailFloorPrice],
              ["团购", s.groupGuidePrice, s.groupFloorPrice],
              ["批发", s.wholesaleGuidePrice, s.wholesaleFloorPrice],
            ].map(([label, guide, floor]) =>
              guide != null || floor != null ? (
                <div key={String(label)} className="flex justify-between text-sm py-0.5">
                  <span className="text-muted">{label}指导价</span>
                  <span>
                    {guide != null ? formatCurrency(guide as number) : "—"}
                    {floor != null && (
                      <span className="text-muted text-xs ml-1">
                        红线 {formatCurrency(floor as number)}
                      </span>
                    )}
                  </span>
                </div>
              ) : null
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
