"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  UserCog,
  LogOut,
  Wine,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type SessionUser } from "@/lib/auth-types";

const navItems = [
  { href: "/", label: "数据概览", icon: LayoutDashboard, roles: ["ADMIN", "SALES"] },
  { href: "/customers", label: "客户管理", icon: Users, roles: ["ADMIN", "SALES"] },
  { href: "/orders", label: "订单管理", icon: ShoppingCart, roles: ["ADMIN", "SALES", "OPERATIONS"] },
  { href: "/products", label: "产品管理", icon: Package, roles: ["ADMIN"] },
  { href: "/channels", label: "渠道管理", icon: GitBranch, roles: ["ADMIN"] },
  { href: "/users", label: "账号管理", icon: UserCog, roles: ["ADMIN"] },
];

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navItems.filter((item) => item.roles.includes(user.role));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 flex-col min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#3d2b1f] via-[#2b2620] to-[#1f1a16]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 40%)",
        }}
        aria-hidden
      />

      <div className="relative flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-gold/40 bg-black/20">
          <Wine className="h-6 w-6 text-gold" />
        </div>
        <div>
          <div className="font-serif font-bold text-base text-paper tracking-wide">
            毛府酒庄
          </div>
          <div className="text-xs text-white/50 mt-0.5">订单与CRM管理</div>
        </div>
      </div>

      <nav className="relative flex-1 px-3 py-5 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-all font-serif",
                active
                  ? "bg-white/10 text-paper border-l-2 border-gold pl-[10px]"
                  : "text-white/65 hover:bg-white/5 hover:text-paper border-l-2 border-transparent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-white/10 px-4 py-4">
        <div className="mb-3 px-2">
          <div className="text-sm font-medium text-paper">{user.name}</div>
          <div className="text-xs text-white/45 mt-0.5">
            {ROLE_LABELS[user.role]} · {user.username}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-white/55 hover:bg-white/5 hover:text-paper transition-colors"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
