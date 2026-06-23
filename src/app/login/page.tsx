"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ADMIN_DASHBOARD_DATA_VISIBLE_KEY } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }
      sessionStorage.removeItem(ADMIN_DASHBOARD_DATA_VISIBLE_KEY);
      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-[#2b2620] via-[#3d2b1f] to-[#1f1a16]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 20% 50%, rgba(139,46,46,0.3), transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.08), transparent 40%)",
        }}
      />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-sm border border-gold/50 bg-black/30 mb-4">
            <Wine className="h-9 w-9 text-gold" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-paper tracking-widest">毛府酒庄</h1>
          <p className="text-white/60 mt-2 font-serif">订单与CRM管理后台</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-sm border border-border bg-card/95 backdrop-blur p-8 shadow-2xl space-y-5 ink-card"
        >
          <div>
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>
          <div>
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </Button>

          <div className="text-xs text-muted text-center pt-2 border-t border-border">
            <p>演示账号（密码均为 123456）</p>
            <p className="mt-1">管理员 admin · 销售 sales01 · 职能 ops01</p>
          </div>
        </form>
      </div>
    </div>
  );
}
