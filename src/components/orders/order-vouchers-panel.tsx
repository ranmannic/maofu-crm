"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileImage, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { VOUCHER_CATEGORY_LABELS, VOUCHER_CATEGORY_OPTIONS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export interface OrderVoucher {
  id: string;
  orderId: string;
  category: keyof typeof VOUCHER_CATEGORY_LABELS;
  fileName: string;
  mimeType: string;
  uploadedByName: string;
  createdAt: string;
}

interface OrderVouchersPanelProps {
  orderId: string | null;
  canEdit: boolean;
  compact?: boolean;
}

export function OrderVouchersPanel({
  orderId,
  canEdit,
  compact = false,
}: OrderVouchersPanelProps) {
  const [vouchers, setVouchers] = useState<OrderVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] =
    useState<keyof typeof VOUCHER_CATEGORY_LABELS>("PAYMENT");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}/vouchers`);
    if (res.ok) {
      setVouchers(await res.json());
    } else {
      const data = await res.json();
      setError(data.error || "加载凭证失败");
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    if (orderId) load();
    else setVouchers([]);
  }, [orderId, load]);

  async function handleUpload(file: File) {
    if (!orderId) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    const res = await fetch(`/api/orders/${orderId}/vouchers`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "上传失败");
      setUploading(false);
      return;
    }
    await load();
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(voucherId: string) {
    if (!orderId || !confirm("确定删除该凭证？")) return;
    const res = await fetch(`/api/orders/${orderId}/vouchers/${voucherId}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
    else {
      const data = await res.json();
      setError(data.error || "删除失败");
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-center justify-between gap-2">
        <Label className="mb-0">订单凭证</Label>
        {!canEdit && (
          <span className="text-xs text-muted">仅查看</span>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[120px]">
            <Label className="text-xs">凭证类型</Label>
            <Select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as keyof typeof VOUCHER_CATEGORY_LABELS)
              }
            >
              {VOUCHER_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={uploading || !orderId}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? "上传中..." : "上传凭证"}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">加载中...</p>
      ) : vouchers.length === 0 ? (
        <p className="text-sm text-muted border border-dashed border-border rounded-sm p-3 text-center">
          暂无凭证
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {vouchers.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 text-sm border border-border rounded-sm p-2"
            >
              <FileImage className="h-4 w-4 text-wine shrink-0" />
              <div className="flex-1 min-w-0">
                <a
                  href={`/api/orders/${orderId}/vouchers/${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-wine hover:underline truncate block"
                >
                  {VOUCHER_CATEGORY_LABELS[v.category]} · {v.fileName}
                </a>
                <div className="text-xs text-muted">
                  {v.uploadedByName} · {formatDate(v.createdAt)}
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(v.id)}
                  className="text-red-700 hover:underline shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
