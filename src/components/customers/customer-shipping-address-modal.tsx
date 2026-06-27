"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2, Wand2 } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  formatShippingAddress,
  parseShippingAddressText,
  validateShippingForm,
} from "@/lib/address-parse";

export interface ShippingAddress {
  id: string;
  name: string;
  phone: string;
  province: string | null;
  city: string | null;
  county: string | null;
  address: string;
  isDefault: boolean;
}

interface CustomerShippingAddressModalProps {
  open: boolean;
  customer: { id: string; name: string } | null;
  onClose: () => void;
}

const emptyForm = {
  name: "",
  phone: "",
  province: "",
  city: "",
  county: "",
  address: "",
  isDefault: false,
};

export function CustomerShippingAddressModal({
  open,
  customer,
  onClose,
}: CustomerShippingAddressModalProps) {
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShippingAddress | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [parseText, setParseText] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!customer) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/customers/${customer.id}/shipping-addresses`);
    if (res.ok) {
      setAddresses(await res.json());
    } else {
      const data = await res.json();
      setError(data.error || "加载失败");
    }
    setLoading(false);
  }, [customer]);

  useEffect(() => {
    if (open && customer) {
      load();
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setParseText("");
      setParseErrors([]);
      setParseWarnings([]);
      setFieldErrors([]);
      setError("");
    }
  }, [open, customer, load]);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, isDefault: addresses.length === 0 });
    setParseText("");
    setParseErrors([]);
    setParseWarnings([]);
    setFieldErrors([]);
    setFormOpen(true);
  }

  function openEdit(addr: ShippingAddress) {
    setEditing(addr);
    setForm({
      name: addr.name,
      phone: addr.phone,
      province: addr.province || "",
      city: addr.city || "",
      county: addr.county || "",
      address: addr.address,
      isDefault: addr.isDefault,
    });
    setParseText("");
    setParseErrors([]);
    setParseWarnings([]);
    setFieldErrors([]);
    setFormOpen(true);
  }

  function handleParse() {
    setParseErrors([]);
    setParseWarnings([]);
    setFieldErrors([]);

    if (!parseText.trim()) {
      setParseErrors(["请先粘贴收货信息"]);
      return;
    }

    const result = parseShippingAddressText(parseText);
    setParseErrors(result.errors);
    setParseWarnings(result.warnings);

    if (result.errors.length > 0) return;

    setForm((f) => ({
      ...f,
      name: result.data.name || f.name,
      phone: result.data.phone || f.phone,
      province: result.data.province || f.province,
      city: result.data.city || f.city,
      county: result.data.county || f.county,
      address: result.data.address || f.address,
    }));
  }

  async function handleSave() {
    if (!customer) return;

    const validationErrors = validateShippingForm(form);
    setFieldErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setSaving(true);
    setError("");
    const url = editing
      ? `/api/customers/${customer.id}/shipping-addresses/${editing.id}`
      : `/api/customers/${customer.id}/shipping-addresses`;
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setFormOpen(false);
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function handleSetDefault(addr: ShippingAddress) {
    if (!customer || addr.isDefault) return;
    setSaving(true);
    const res = await fetch(
      `/api/customers/${customer.id}/shipping-addresses/${addr.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      }
    );
    if (res.ok) await load();
    else {
      const data = await res.json();
      setError(data.error || "设置失败");
    }
    setSaving(false);
  }

  async function handleDelete(addr: ShippingAddress) {
    if (!customer) return;
    if (!confirm(`确定删除收货地址「${addr.name}」？`)) return;
    setSaving(true);
    const res = await fetch(
      `/api/customers/${customer.id}/shipping-addresses/${addr.id}`,
      { method: "DELETE" }
    );
    if (res.ok) await load();
    else {
      const data = await res.json();
      setError(data.error || "删除失败");
    }
    setSaving(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? `${customer.name} — 收货信息` : "收货信息"}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-red-700">{error}</p>}

        {!formOpen ? (
          <>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted">管理客户的收货地址，下单时可快速选用</p>
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-1" />
                新增地址
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted">加载中...</div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-8 text-muted border border-dashed border-border rounded-sm">
                暂无收货地址，请点击「新增地址」添加
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="border border-border rounded-sm p-3 text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-wine shrink-0" />
                        <span className="font-medium">{addr.name}</span>
                        <span className="text-muted">{addr.phone}</span>
                        {addr.isDefault && (
                          <Badge variant="wine">默认</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!addr.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(addr)}
                            disabled={saving}
                            className="text-xs text-muted hover:text-wine inline-flex items-center gap-0.5"
                          >
                            <Star className="h-3 w-3" />
                            设为默认
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(addr)}
                          className="text-xs text-wine hover:underline inline-flex items-center gap-0.5"
                        >
                          <Pencil className="h-3 w-3" />
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(addr)}
                          disabled={saving}
                          className="text-xs text-red-700 hover:underline inline-flex items-center gap-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                          删除
                        </button>
                      </div>
                    </div>
                    <div className="text-muted pl-6">
                      {formatShippingAddress(addr)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4 border border-border rounded-sm p-4 bg-paper/50">
            <h4 className="font-serif font-medium">
              {editing ? "编辑收货地址" : "新增收货地址"}
            </h4>

            <div>
              <Label>快速解析</Label>
              <Textarea
                value={parseText}
                onChange={(e) => {
                  setParseText(e.target.value);
                  setParseErrors([]);
                  setParseWarnings([]);
                }}
                placeholder={`支持多种格式，例如：
张三 13812345678 贵州省贵阳市南明区花果园XX路XX号
或分行粘贴：姓名 / 手机号 / 地址
或带标签：收件人：张三  电话：13812345678  地址：贵州省贵阳市...`}
                rows={4}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={handleParse}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                解析并填入
              </Button>
              {parseErrors.length > 0 && (
                <ul className="mt-2 text-sm text-red-700 space-y-1 list-disc pl-4">
                  {parseErrors.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              )}
              {parseWarnings.length > 0 && (
                <ul className="mt-2 text-sm text-amber-800 space-y-1 list-disc pl-4">
                  {parseWarnings.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              )}
            </div>

            {fieldErrors.length > 0 && (
              <ul className="text-sm text-red-700 space-y-1 list-disc pl-4">
                {fieldErrors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-1">
                <Label>收货人姓名 *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-1">
                <Label>联系电话 *</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div>
                <Label>省</Label>
                <Input
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                />
              </div>
              <div>
                <Label>市</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <Label>县/区</Label>
                <Input
                  value={form.county}
                  onChange={(e) => setForm({ ...form, county: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>详细地址 *</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              设为默认地址
            </label>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFormOpen(false);
                  setEditing(null);
                }}
              >
                返回列表
              </Button>
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      </ModalFooter>
    </Modal>
  );
}
