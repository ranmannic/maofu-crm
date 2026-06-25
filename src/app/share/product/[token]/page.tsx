"use client";

import { useEffect, useState } from "react";
import { Wine } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { SPEC_UNIT_LABELS } from "@/lib/constants";
import type { SpecUnit } from "@/generated/prisma/client";

interface ShareProduct {
  name: string;
  description: string | null;
  alcoholContent: string | null;
  aromaType: string | null;
  origin: string | null;
  thumbnailUrl: string | null;
  images: { id: string; url: string }[];
  specs: {
    id: string;
    name: string;
    unitType: SpecUnit;
    bottlesPerUnit: number;
    description: string | null;
    thumbnailUrl: string | null;
    retailGuidePrice: number | null;
    retailFloorPrice: number | null;
  }[];
}

function PriceBlock({
  guide,
  floor,
}: {
  guide: number | null;
  floor: number | null;
}) {
  if (guide == null && floor == null) return null;
  return (
    <div className="rounded-xl p-4 bg-[#8b2e2e]/10 border border-[#8b2e2e]/20">
      <div className="text-xs tracking-widest text-[#8b7355] mb-1">零售指导价</div>
      <div className="text-xl font-bold text-[#8b2e2e]">
        {guide != null ? formatCurrency(guide) : "询价"}
      </div>
      {floor != null && (
        <div className="text-xs text-[#8b7355] mt-1">零售红线价 {formatCurrency(floor)}</div>
      )}
    </div>
  );
}

function ProductParams({
  alcoholContent,
  aromaType,
  origin,
}: {
  alcoholContent: string | null;
  aromaType: string | null;
  origin: string | null;
}) {
  const items = [
    alcoholContent ? { label: "酒精度", value: alcoholContent } : null,
    aromaType ? { label: "香型", value: aromaType } : null,
    origin ? { label: "产地", value: origin } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="text-xs text-[#5c5348] bg-[#e8dfd0]/60 px-2.5 py-1 rounded-full"
        >
          {item.label}：{item.value}
        </span>
      ))}
    </div>
  );
}

export default function ShareProductPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [product, setProduct] = useState<ShareProduct | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/product/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setProduct(data);
      })
      .catch(() => setError("加载失败"));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-[#8b2e2e]">{error}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#8b7355]">
        加载中…
      </div>
    );
  }

  const gallery = product.images.length
    ? product.images
    : product.thumbnailUrl
      ? [{ id: "thumb", url: product.thumbnailUrl }]
      : [];

  return (
    <div className="max-w-lg mx-auto pb-12">
      <header className="text-center pt-8 pb-4 px-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#c9a962]/50 bg-[#2b2620]/5 mb-3">
          <Wine className="h-6 w-6 text-[#8b2e2e]" />
        </div>
        <h1 className="text-sm tracking-[0.3em] text-[#8b7355]">毛府酒庄</h1>
      </header>

      {gallery.length > 0 && (
        <div className="px-4">
          <div className="aspect-square rounded-2xl overflow-hidden shadow-lg border border-[#e8dfd0] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gallery[activeImage]?.url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {gallery.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${i === activeImage ? "border-[#8b2e2e]" : "border-transparent opacity-70"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-4 mt-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-wide">{product.name}</h2>
          <div className="mt-3">
            <ProductParams
              alcoholContent={product.alcoholContent}
              aromaType={product.aromaType}
              origin={product.origin}
            />
          </div>
          {product.description && (
            <p className="text-[#5c5348] mt-3 leading-relaxed text-sm whitespace-pre-wrap">
              {product.description}
            </p>
          )}
        </div>

        {product.specs.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-[#e8dfd0] bg-white/80 p-4 space-y-3"
          >
            <div className="flex gap-3">
              {s.thumbnailUrl && (
                <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-[#e8dfd0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.thumbnailUrl} alt={s.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-lg">{s.name}</h3>
                  <span className="text-xs text-[#8b7355] bg-[#e8dfd0]/60 px-2 py-0.5 rounded-full shrink-0">
                    {SPEC_UNIT_LABELS[s.unitType]}
                    {s.bottlesPerUnit > 1 ? ` · ${s.bottlesPerUnit}瓶/单位` : ""}
                  </span>
                </div>
                {s.description && (
                  <p className="text-sm text-[#5c5348] mt-2 leading-relaxed whitespace-pre-wrap">
                    {s.description}
                  </p>
                )}
              </div>
            </div>
            <PriceBlock guide={s.retailGuidePrice} floor={s.retailFloorPrice} />
          </div>
        ))}
      </div>

      <footer className="text-center text-xs text-[#8b7355] mt-10 px-4">
        毛府酒庄 · 品质传承
      </footer>
    </div>
  );
}
