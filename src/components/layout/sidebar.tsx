"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Wine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type SessionUser } from "@/lib/auth-types";
import { navItems } from "@/components/layout/nav-items";
import { useSidebar } from "@/components/layout/sidebar-context";

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { open, close, setOpen } = useSidebar();
  const items = navItems.filter((item) => item.roles.includes(user.role));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="关闭菜单"
          onClick={close}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-64 shrink-0 flex-col overflow-hidden transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
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

        <div className="relative flex items-center gap-3 border-b border-white/10 px-4 py-5 sm:px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-gold/40 bg-black/20">
            <Wine className="h-6 w-6 text-gold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-base font-bold tracking-wide text-paper">
              毛府酒庄
            </div>
            <div className="mt-0.5 text-xs text-white/50">订单与CRM管理</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-sm p-2 text-white/60 hover:bg-white/10 hover:text-paper lg:hidden"
            aria-label="关闭菜单"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-3 py-5">
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
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-3 py-3 text-sm transition-all font-serif",
                  active
                    ? "border-l-2 border-gold bg-white/10 pl-[10px] text-paper"
                    : "border-l-2 border-transparent text-white/65 hover:bg-white/5 hover:text-paper"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative border-t border-white/10 px-4 py-4 safe-bottom">
          <div className="mb-3 px-2">
            <div className="text-sm font-medium text-paper">{user.name}</div>
            <div className="mt-0.5 text-xs text-white/45">
              {ROLE_LABELS[user.role]} · {user.username}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-paper"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>
    </>
  );
}
