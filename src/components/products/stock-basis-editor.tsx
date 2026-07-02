"use client";

import { MinusCircle } from "lucide-react";
import { Label, Select, QtyInput } from "@/components/ui/input";
import { roundStockQty } from "@/lib/utils";

export type BasisLineForm = {
  lineType: "WINE" | "MATERIAL";
  wineProductId: string;
  wineSkuType: "BOTTLE" | "LITER";
  materialId: string;
  quantity: number;
};

interface WineStockOption {
  productId: string;
  productName: string;
  skuType: "BOTTLE" | "LITER";
  skuLabel: string;
}

interface MaterialOption {
  id: string;
  name: string;
  unit: string;
}

interface StockBasisEditorProps {
  lines: BasisLineForm[];
  onChange: (lines: BasisLineForm[]) => void;
  wineStocks: WineStockOption[];
  materials: MaterialOption[];
  defaultProductId?: string;
}

const emptyWineLine = (
  defaultProductId: string,
  qty = 1
): BasisLineForm => ({
  lineType: "WINE",
  wineProductId: defaultProductId,
  wineSkuType: "BOTTLE",
  materialId: "",
  quantity: qty,
});

export function StockBasisEditor({
  lines,
  onChange,
  wineStocks,
  materials,
  defaultProductId = "",
}: StockBasisEditorProps) {
  function updateLine(index: number, patch: Partial<BasisLineForm>) {
    const next = [...lines];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function wineValue(line: BasisLineForm) {
    if (!line.wineProductId) return "";
    return `${line.wineProductId}:${line.wineSkuType}`;
  }

  function parseWineValue(value: string): Pick<BasisLineForm, "wineProductId" | "wineSkuType"> {
    const [productId, skuType] = value.split(":");
    return {
      wineProductId: productId,
      wineSkuType: (skuType as "BOTTLE" | "LITER") || "BOTTLE",
    };
  }

  return (
    <div className="space-y-3">
      {lines.map((line, idx) => (
        <div
          key={idx}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-lg border border-border/60 p-3"
        >
          <div className="sm:col-span-2">
            <Label>类型</Label>
            <Select
              value={line.lineType}
              onChange={(e) => {
                const type = e.target.value as "WINE" | "MATERIAL";
                if (type === "WINE") {
                  updateLine(idx, {
                    lineType: "WINE",
                    materialId: "",
                    wineProductId: defaultProductId,
                    wineSkuType: "BOTTLE",
                  });
                } else {
                  updateLine(idx, {
                    lineType: "MATERIAL",
                    wineProductId: "",
                    wineSkuType: "BOTTLE",
                    materialId: "",
                  });
                }
              }}
            >
              <option value="WINE">酒体</option>
              <option value="MATERIAL">物料</option>
            </Select>
          </div>

          <div className="sm:col-span-6">
            <Label>{line.lineType === "WINE" ? "酒体 SKU" : "物料"}</Label>
            {line.lineType === "WINE" ? (
              <Select
                value={wineValue(line)}
                onChange={(e) => updateLine(idx, parseWineValue(e.target.value))}
              >
                <option value="">请选择</option>
                {wineStocks.map((w) => (
                  <option
                    key={`${w.productId}:${w.skuType}`}
                    value={`${w.productId}:${w.skuType}`}
                  >
                    {w.productName} · {w.skuLabel}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                value={line.materialId}
                onChange={(e) => updateLine(idx, { materialId: e.target.value })}
              >
                <option value="">请选择</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}（{m.unit}）
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="sm:col-span-3">
            <Label>
              构成数量
              {line.lineType === "WINE" && line.wineSkuType === "LITER"
                ? "（升）"
                : ""}
            </Label>
            <QtyInput
              min={line.lineType === "WINE" && line.wineSkuType === "LITER" ? 0.001 : 1}
              allowDecimal={
                line.lineType === "WINE" && line.wineSkuType === "LITER"
              }
              placeholder={
                line.lineType === "WINE" && line.wineSkuType === "LITER"
                  ? "如 0.75"
                  : undefined
              }
              value={line.quantity}
              onChange={(n) => {
                const isLiterWine =
                  line.lineType === "WINE" && line.wineSkuType === "LITER";
                if (isLiterWine) {
                  updateLine(idx, { quantity: n > 0 ? roundStockQty(n) : 0 });
                } else {
                  updateLine(idx, {
                    quantity: Math.max(1, Math.floor(n) || 1),
                  });
                }
              }}
            />
          </div>

          <div className="sm:col-span-1 flex justify-end pb-1">
            <button
              type="button"
              className="text-red-600 hover:text-red-700 disabled:opacity-30"
              disabled={lines.length <= 1}
              onClick={() => onChange(lines.filter((_, i) => i !== idx))}
              aria-label="删除依据行"
            >
              <MinusCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="text-sm text-wine hover:underline"
        onClick={() =>
          onChange([...lines, emptyWineLine(defaultProductId)])
        }
      >
        + 添加依据行
      </button>
    </div>
  );
}

export { emptyWineLine };
