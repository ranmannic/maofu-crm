"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PolicyRow {
  productSpecId: string;
  productName: string;
  specName: string;
  standardPrice: number;
  lastPrice: number;
  differsFromStandard: boolean;
  note: string;
}

export function CustomerPolicySection({
  customerId,
  canEdit,
}: {
  customerId: string;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/customers/${customerId}/price-policy`);
    if (res.ok) {
      setRows(await res.json());
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNote(productSpecId: string, note: string) {
    setSavingId(productSpecId);
    const res = await fetch(`/api/customers/${customerId}/price-policy`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSpecId, note: note || null }),
    });
    if (res.ok) {
      const data = await res.json();
      setRows((prev) =>
        prev.map((r) =>
          r.productSpecId === productSpecId ? { ...r, note: data.note } : r
        )
      );
    }
    setSavingId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-base">客户政策</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted py-6">加载中...</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted py-6">暂无拿货记录</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.productSpecId}
                className="rounded-lg border border-border p-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{row.productName}</div>
                    <div className="text-xs text-muted mt-0.5">{row.specName}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted">拿货价</div>
                    <div
                      className={cn(
                        "font-semibold text-sm",
                        row.differsFromStandard && "text-red-600"
                      )}
                    >
                      {formatCurrency(row.lastPrice)}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      标准 {formatCurrency(row.standardPrice)}
                    </div>
                  </div>
                </div>
                {canEdit ? (
                  <Input
                    value={row.note}
                    placeholder="备注"
                    className="text-sm"
                    disabled={savingId === row.productSpecId}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.productSpecId === row.productSpecId
                            ? { ...r, note: e.target.value }
                            : r
                        )
                      )
                    }
                    onBlur={(e) => saveNote(row.productSpecId, e.target.value)}
                  />
                ) : (
                  row.note && (
                    <p className="text-sm text-muted">{row.note}</p>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
