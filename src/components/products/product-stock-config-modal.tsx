"use client";

import { useEffect, useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  StockBasisEditor,
  emptyWineLine,
  type BasisLineForm,
} from "@/components/products/stock-basis-editor";
import { SPEC_UNIT_LABELS } from "@/lib/constants";
import type { SpecUnit } from "@/generated/prisma/client";

interface ProductSpec {
  id: string;
  name: string;
  unitType: SpecUnit;
}

interface ProductStockConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  productId: string;
  productName: string;
  spec: ProductSpec;
}

export function ProductStockConfigModal({
  open,
  onClose,
  onSaved,
  productId,
  productName,
  spec,
}: ProductStockConfigModalProps) {
  const [lines, setLines] = useState<BasisLineForm[]>([]);
  const [maxSellable, setMaxSellable] = useState<number | null>(null);
  const [materials, setMaterials] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [wineStocks, setWineStocks] = useState<
    { productId: string; productName: string; skuType: "BOTTLE" | "LITER"; skuLabel: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      fetch("/api/inventory/materials").then((r) => r.json()),
      fetch("/api/inventory/wine").then((r) => r.json()),
    ]).then(([matData, wineData]) => {
      setMaterials(matData.items ?? []);
      setWineStocks(
        (wineData.items ?? []).map(
          (w: {
            productId: string;
            productName: string;
            skuType: "BOTTLE" | "LITER";
            skuLabel: string;
          }) => ({
            productId: w.productId,
            productName: w.productName,
            skuType: w.skuType,
            skuLabel: w.skuLabel,
          })
        )
      );
    });
  }, [open]);

  useEffect(() => {
    if (!open || !spec.id) return;
    setLoading(true);
    setError("");
    fetch(`/api/products/specs/${spec.id}/stock-basis`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLines([emptyWineLine(productId)]);
          setMaxSellable(null);
        } else {
          setMaxSellable(data.maxSellable ?? null);
          const loaded = (data.lines ?? []) as {
            lineType: "WINE" | "MATERIAL";
            materialId: string | null;
            wineProductId: string | null;
            wineSkuType: "BOTTLE" | "LITER" | null;
            quantity: number;
          }[];
          setLines(
            loaded.length > 0
              ? loaded.map((l) => ({
                  lineType: l.lineType,
                  wineProductId: l.wineProductId ?? productId,
                  wineSkuType: l.wineSkuType ?? "BOTTLE",
                  materialId: l.materialId ?? "",
                  quantity: l.quantity,
                }))
              : [emptyWineLine(productId)]
          );
        }
        setLoading(false);
      })
      .catch(() => {
        setLines([emptyWineLine(productId)]);
        setLoading(false);
      });
  }, [open, spec.id, productId]);

  async function save() {
    for (const l of lines) {
      if (l.lineType === "WINE" && !l.wineProductId) {
        setError("请选择酒体 SKU");
        return;
      }
      if (l.lineType === "MATERIAL" && !l.materialId) {
        setError("请选择物料");
        return;
      }
      if (l.quantity < 1) {
        setError("构成数量须至少为 1");
        return;
      }
    }

    setSaving(true);
    setError("");

    const res = await fetch(`/api/products/specs/${spec.id}/stock-basis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: lines.map((l) => ({
          lineType: l.lineType,
          materialId:
            l.lineType === "MATERIAL" ? l.materialId.trim() || null : null,
          wineProductId:
            l.lineType === "WINE" ? l.wineProductId.trim() || null : null,
          wineSkuType: l.lineType === "WINE" ? l.wineSkuType : null,
          quantity: Math.max(1, l.quantity),
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setMaxSellable(data.maxSellable ?? 0);
    setSaving(false);
    onSaved?.();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`配置库存 — ${productName} · ${spec.name}`}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-muted">
          配置每售出 1 单位该规格所消耗的酒体 SKU 与物料，最大可售数自动计算。
        </p>

        <div className="text-sm text-muted">
          单位：{SPEC_UNIT_LABELS[spec.unitType]}
          {maxSellable != null && (
            <span className="text-wine font-medium ml-3">
              当前最大可售：{maxSellable}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center text-muted text-sm">加载中...</div>
        ) : wineStocks.length === 0 ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            请先在「库存管理 → 酒体库存」中创建酒体 SKU，再配置依据。
          </p>
        ) : (
          <StockBasisEditor
            lines={lines}
            onChange={setLines}
            wineStocks={wineStocks}
            materials={materials}
            defaultProductId={productId}
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
        <Button onClick={save} disabled={saving || loading || wineStocks.length === 0}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
