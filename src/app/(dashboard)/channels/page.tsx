"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/input";

interface Channel {
  id: string;
  name: string;
  sortOrder: number;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
  children?: { id: string; name: string; sortOrder: number }[];
  _count: { customers: number; children: number };
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const topLevel = channels.filter((c) => !c.parentId);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/channels");
    if (res.ok) setChannels(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate(parent?: string) {
    setEditing(null);
    setName("");
    setSortOrder(channels.length);
    setParentId(parent || "");
    setError("");
    setModalOpen(true);
  }

  function openEdit(ch: Channel) {
    setEditing(ch);
    setName(ch.name);
    setSortOrder(ch.sortOrder);
    setParentId(ch.parentId || "");
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const url = editing ? `/api/channels/${editing.id}` : "/api/channels";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        sortOrder,
        parentId: parentId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setModalOpen(false);
    await load();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除此渠道？")) return;
    const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) alert(data.error || "删除失败");
    else await load();
  }

  function renderRow(ch: Channel, level: number) {
    const isTop = level === 0;
    return (
      <tr key={ch.id} className="border-b border-border/40">
        <td className="py-3">{ch.sortOrder}</td>
        <td className="py-3 font-medium font-serif">
          <span style={{ paddingLeft: level * 20 }}>
            {isTop ? "【一级】" : "└ "}
            {ch.name}
          </span>
        </td>
        <td className="py-3">{isTop ? ch._count.children : ch._count.customers}</td>
        <td className="py-3 space-x-3">
          {isTop && (
            <button
              onClick={() => openCreate(ch.id)}
              className="text-muted hover:underline text-xs"
            >
              添加二级
            </button>
          )}
          <button onClick={() => openEdit(ch)} className="text-wine hover:underline text-xs inline-flex items-center gap-0.5">
            <Pencil className="h-3 w-3" />编辑
          </button>
          <button onClick={() => handleDelete(ch.id)} className="text-red-700 hover:underline text-xs inline-flex items-center gap-0.5">
            <Trash2 className="h-3 w-3" />删除
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-serif font-bold">渠道类型管理</h1>
          <p className="text-muted text-sm mt-1 font-serif">
            两级渠道分类：一级业务类型 + 二级销售渠道
          </p>
        </div>
        <div className="page-header-actions">
        <Button onClick={() => openCreate()} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" />
          新增一级分类
        </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : (
            <div className="table-scroll">
            <table className="w-full text-sm ink-table">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-3">排序</th>
                  <th className="pb-3">渠道名称</th>
                  <th className="pb-3">子渠道/客户数</th>
                  <th className="pb-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {topLevel.flatMap((parent) => {
                  const children = channels.filter((c) => c.parentId === parent.id);
                  return [renderRow(parent, 0), ...children.map((c) => renderRow(c, 1))];
                })}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "编辑渠道" : parentId ? "新增二级渠道" : "新增一级分类"}>
        <div className="space-y-4">
          {!editing && (
            <div>
              <Label>上级分类</Label>
              <Select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                disabled={!!editing}
              >
                <option value="">一级分类（无上级）</option>
                {topLevel.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          )}
          {editing && editing.parent && (
            <div>
              <Label>上级分类</Label>
              <Input value={editing.parent.name} readOnly className="bg-paper" />
            </div>
          )}
          <div>
            <Label>渠道名称 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>排序</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
