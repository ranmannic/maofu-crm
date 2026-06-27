"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { SessionUser } from "@/lib/auth-types";

function nowDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  sales: { name: string };
}

export function FollowUpWritePage({
  customerId,
  returnTo,
}: {
  user: SessionUser;
  customerId: string;
  returnTo: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [form, setForm] = useState({
    followedAt: nowDatetimeLocal(),
    content: "",
    nextPlan: "",
    nextFollowUpAt: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/follow-up/${customerId}`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "加载失败");
        router.push(returnTo);
        return;
      }
      setProfile(data);
      setLoading(false);
    }
    load();
  }, [customerId, returnTo, router]);

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/follow-up/${customerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    router.push(returnTo);
  }

  if (loading || !profile) {
    return <div className="text-center py-20 text-muted">加载中...</div>;
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(returnTo)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-serif font-bold">
            写跟进 · {profile.name}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {profile.phone || "—"} · 负责销售 {profile.sales.name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">跟进记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>跟进时间 *</Label>
            <Input
              type="datetime-local"
              value={form.followedAt}
              onChange={(e) =>
                setForm({ ...form, followedAt: e.target.value })
              }
            />
          </div>
          <div>
            <Label>跟进内容 *</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              placeholder="记录本次沟通情况..."
            />
          </div>
          <div>
            <Label>下一次跟进计划</Label>
            <Textarea
              value={form.nextPlan}
              onChange={(e) => setForm({ ...form, nextPlan: e.target.value })}
              rows={2}
              placeholder="下次沟通目标或要点..."
            />
          </div>
          <div>
            <Label>下一次跟进时间</Label>
            <Input
              type="datetime-local"
              value={form.nextFollowUpAt}
              onChange={(e) =>
                setForm({ ...form, nextFollowUpAt: e.target.value })
              }
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => router.push(returnTo)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存跟进"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
