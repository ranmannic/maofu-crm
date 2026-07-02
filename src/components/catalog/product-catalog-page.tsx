"use client";

import { useEffect, useState, useRef } from "react";
import { Share2, Wine } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import {
  useListPageSnapshot,
  useRestoreListPageScroll,
} from "@/hooks/use-saved-list-page-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { SPEC_UNIT_LABELS } from "@/lib/constants";
import { useShareLink } from "@/hooks/use-share-link";
import type { SpecUnit } from "@/generated/prisma/client";

interface CatalogSpec {
  id: string;
  name: string;
  unitType: SpecUnit;
  bottlesPerUnit: number;
  price: number;
  retailGuidePrice: number | null;
  retailFloorPrice: number | null;
  groupGuidePrice: number | null;
  groupFloorPrice: number | null;
  wholesaleGuidePrice: number | null;
  wholesaleFloorPrice: number | null;
}

interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  shareToken?: string;
  specs: CatalogSpec[];
  images: { id: string; url: string }[];
}

function PriceRow({ label, guide, floor }: { label: string; guide: number | null; floor: number | null }) {
  if (guide == null && floor == null) return null;
  return (
    <div className="flex justify-between text-xs py-0.5 border-b border-border/30 last:border-0">
      <span className="text-muted">{label}</span>
      <span>
        {guide != null ? formatCurrency(guide) : "—"}
        {floor != null && (
          <span className="text-muted ml-1">(红线 {formatCurrency(floor)})</span>
        )}
      </span>
    </div>
  );
}

const CATALOG_ROUTE_KEY = "/catalog";

interface CatalogPageState {
  products?: CatalogProduct[];
  scrollY?: number;
}

export function ProductCatalogPage() {
  const { shareProduct, shareModal, sharing } = useShareLink();
  const snapshot = useListPageSnapshot<CatalogPageState>(CATALOG_ROUTE_KEY);
  const saved = snapshot?.data;
  const restoreOnMount = useRef(saved?.products !== undefined);

  const [products, setProducts] = useState<CatalogProduct[]>(
    () => saved?.products ?? []
  );
  const [loading, setLoading] = useState(() => saved?.products === undefined);

  useRestoreListPageScroll(
    CATALOG_ROUTE_KEY,
    snapshot?.scrollY,
    !loading
  );

  useEffect(() => {
    const silent = restoreOnMount.current;
    if (restoreOnMount.current) restoreOnMount.current = false;
    if (!silent) setLoading(true);

    fetch("/api/products/catalog")
      .then((r) => r.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-serif font-bold">产品展示</h1>
        <p className="text-muted text-sm mt-1 font-serif">
          查看产品信息与零售价格体系，可生成客户分享链接（不含成本与内部销售价）
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted">加载中...</div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted">暂无产品</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="aspect-[4/3] bg-paper relative">
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbnailUrl}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">
                    <Wine className="h-12 w-12 opacity-30" />
                  </div>
                )}
              </div>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <h3 className="font-serif font-bold text-lg">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-muted mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>
                {p.specs.map((s) => (
                  <div key={s.id} className="rounded-sm border border-border/60 p-2 bg-paper/40">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{s.name}</span>
                      <Badge variant="wine">{SPEC_UNIT_LABELS[s.unitType]}</Badge>
                    </div>
                    <PriceRow label="零售指导价" guide={s.retailGuidePrice} floor={s.retailFloorPrice} />
                    <PriceRow label="团购指导价" guide={s.groupGuidePrice} floor={s.groupFloorPrice} />
                    <PriceRow label="批发指导价" guide={s.wholesaleGuidePrice} floor={s.wholesaleFloorPrice} />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <AppNavLink
                    href={`/catalog/${p.id}`}
                    className="flex-1"
                    pageStateKey={CATALOG_ROUTE_KEY}
                    pageState={{ products }}
                  >
                    <Button variant="secondary" size="sm" className="w-full">
                      查看详情
                    </Button>
                  </AppNavLink>
                  <Button
                    size="sm"
                    onClick={() => shareProduct(p.id, p.name)}
                    disabled={sharing}
                  >
                    <Share2 className="h-3.5 w-3.5 mr-1" />
                    分享
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {shareModal}
    </div>
  );
}
