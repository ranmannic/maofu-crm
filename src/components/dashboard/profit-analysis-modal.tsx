"use client";

import { useEffect, useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface FixedCostStats {
  monthlyFixedCost: number;
  proratedFixedCost: number;
  netProfitAfterFixedCost: number;
  coversFixedCost: boolean;
  periodLabel: string;
}

export function ProfitAnalysisModal({
  open,
  onClose,
  stats,
  grossProfit,
  grossProfitMargin,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  stats: FixedCostStats;
  grossProfit: number;
  grossProfitMargin: number | null;
  onUpdated: () => void;
}) {
  const [draft, setDraft] = useState(String(stats.monthlyFixedCost || ""));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(String(stats.monthlyFixedCost || ""));
      setEditing(false);
    }
  }, [open, stats.monthlyFixedCost]);

  async function handleSave() {
    const value = parseFloat(draft);
    if (Number.isNaN(value) || value < 0) {
      alert("请输入有效的月度固定成本");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/settings/fixed-cost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyFixedCost: value }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setEditing(false);
    setSaving(false);
    onUpdated();
  }

  return (
    <Modal open={open} onClose={onClose} title="盈利分析" className="sm:max-w-lg">
      <div className="space-y-4">
        <p className="text-xs text-muted">{stats.periodLabel}</p>

        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="订单毛利"
            value={formatCurrency(grossProfit)}
            valueClassName="text-[#4361ee]"
          />
          <Metric
            label="毛利率"
            value={
              grossProfitMargin != null ? `${grossProfitMargin.toFixed(1)}%` : "—"
            }
          />
          <Metric
            label="本期分摊固定成本"
            value={formatCurrency(stats.proratedFixedCost)}
          />
          <Metric
            label="扣后净利"
            value={formatCurrency(stats.netProfitAfterFixedCost)}
            valueClassName={
              stats.coversFixedCost ? "text-emerald-600" : "text-red-600"
            }
          />
        </div>

        <div
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm font-medium",
            stats.coversFixedCost
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          {stats.coversFixedCost ? "毛利已覆盖固定成本" : "毛利未覆盖固定成本"}
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs text-muted">月度固定成本（元）</Label>
              {editing ? (
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="mt-1"
                />
              ) : (
                <p className="text-lg font-semibold mt-1">
                  {formatCurrency(stats.monthlyFixedCost)}
                  <span className="text-xs text-muted font-normal ml-1">/ 月</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setDraft(String(stats.monthlyFixedCost || ""));
                    }}
                  >
                    取消
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "保存中..." : "保存"}
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDraft(String(stats.monthlyFixedCost || ""));
                    setEditing(true);
                  }}
                >
                  设置月度成本
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted">
            按月度成本配置，系统会根据所选时间范围（今日 / 本月 / 本年 / 自定义）自动按天分摊计算。
          </p>
        </div>
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-paper/40 px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("text-base font-semibold mt-1", valueClassName)}>{value}</div>
    </div>
  );
}
