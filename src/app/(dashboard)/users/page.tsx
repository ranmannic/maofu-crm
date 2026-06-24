"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/auth-types";
import { formatDate } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";

interface UserRow {
  id: string;
  username: string;
  name: string;
  role: Role;
  createdAt: string;
  _count: {
    customers: number;
    salesOrders: number;
    handledOrders: number;
  };
}

const roleTabs: { label: string; role: Role | "ALL" }[] = [
  { label: "全部", role: "ALL" },
  { label: "销售账号", role: "SALES" },
  { label: "职能账号", role: "OPERATIONS" },
  { label: "管理员", role: "ADMIN" },
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tab, setTab] = useState<Role | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    role: "SALES" as Role,
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const params = tab !== "ALL" ? `?role=${tab}` : "";
    const res = await fetch(`/api/users${params}`);
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [tab]);

  async function handleCreate() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "创建失败");
      setSaving(false);
      return;
    }
    setCreateOpen(false);
    setForm({ username: "", password: "", name: "", role: "SALES" });
    await load();
    setSaving(false);
  }

  function openPasswordModal(user: UserRow) {
    setPasswordTarget(user);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setPasswordOpen(true);
  }

  async function handlePasswordUpdate() {
    if (!passwordTarget) return;
    if (newPassword.length < 6) {
      setError("密码至少6个字符");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/users/${passwordTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "修改失败");
      setSaving(false);
      return;
    }
    setPasswordOpen(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除此账号？")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "删除失败");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-serif font-bold">账号管理</h1>
          <p className="text-muted text-sm mt-1 font-serif">
            创建账号、修改密码与管理角色
          </p>
        </div>
        <div className="page-header-actions">
        <Button onClick={() => { setError(""); setCreateOpen(true); }} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" />
          新增账号
        </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {roleTabs.map((t) => (
          <button
            key={t.role}
            onClick={() => setTab(t.role)}
            className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-sm text-sm font-medium font-serif transition-colors ${
              tab === t.role
                ? "bg-wine text-paper"
                : "bg-card border border-border hover:bg-background"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : (
            <div className="table-scroll">
            <table className="w-full text-sm ink-table">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-3">用户名</th>
                  <th className="pb-3">姓名</th>
                  <th className="pb-3">角色</th>
                  <th className="pb-3">客户数</th>
                  <th className="pb-3">订单数</th>
                  <th className="pb-3">处理订单</th>
                  <th className="pb-3">创建时间</th>
                  <th className="pb-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/40">
                    <td className="py-3 font-mono">{u.username}</td>
                    <td className="py-3">{u.name}</td>
                    <td className="py-3">
                      <Badge variant="wine">{ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td className="py-3">{u._count.customers}</td>
                    <td className="py-3">{u._count.salesOrders}</td>
                    <td className="py-3">{u._count.handledOrders}</td>
                    <td className="py-3">{formatDate(u.createdAt)}</td>
                    <td className="py-3 space-x-3">
                      <button
                        onClick={() => openPasswordModal(u)}
                        className="text-wine hover:underline inline-flex items-center gap-1 text-xs"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        修改密码
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="text-red-700 hover:underline inline-flex items-center gap-1 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      暂无账号
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新增账号"
      >
        <div className="space-y-4">
          <div>
            <Label>用户名 *</Label>
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div>
            <Label>初始密码 *</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="至少6个字符"
            />
          </div>
          <div>
            <Label>姓名 *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>角色 *</Label>
            <Select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as Role })
              }
            >
              <option value="SALES">销售</option>
              <option value="OPERATIONS">职能</option>
              <option value="ADMIN">管理员</option>
            </Select>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "创建中..." : "创建"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title={`修改密码 - ${passwordTarget?.name || ""}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted font-serif">
            为用户「{passwordTarget?.username}」设置新密码
          </p>
          <div>
            <Label>新密码 *</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少6个字符"
            />
          </div>
          <div>
            <Label>确认密码 *</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setPasswordOpen(false)}>
            取消
          </Button>
          <Button onClick={handlePasswordUpdate} disabled={saving}>
            {saving ? "保存中..." : "确认修改"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
