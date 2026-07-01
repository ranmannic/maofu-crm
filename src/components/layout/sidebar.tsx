"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Wine, X, Crown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type SessionUser } from "@/lib/auth-types";
import { navItems } from "@/components/layout/nav-items";
import { useSidebar } from "@/components/layout/sidebar-context";
import { useEdition } from "@/components/edition/edition-provider";

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { open, close, setOpen } = useSidebar();
  const { isPremiumActive, premiumAccess, trialDaysLeft, resetExperience } =
    useEdition();
  const items = navItems.filter((item) => {
    if (!item.roles.includes(user.role)) return false;
    if (item.premiumOnly && !isPremiumActive) return false;
    if (item.hideInPremium && isPremiumActive) {
      // 高级版：销售仍保留独立「产品展示」入口
      if (item.href === "/catalog" && user.role === "SALES") return true;
      return false;
    }
    return true;
  });

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
          "fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-64 shrink-0 flex-col overflow-hidden transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 sidebar-shell",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="sidebar-bg absolute inset-0" aria-hidden />
        <div className="sidebar-shine absolute inset-0 opacity-20" aria-hidden />

        <div
          className={cn(
            "relative flex items-center gap-3 border-b px-4 py-5 sm:px-6",
            isPremiumActive ? "border-[#edf0f5]" : "border-white/10"
          )}
        >
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border",
              isPremiumActive
                ? "border-[#5b7cfa]/25 bg-[#5b7cfa]/10"
                : "border-gold/40 bg-black/20"
            )}
          >
            {isPremiumActive ? (
              <Crown className="h-6 w-6 text-[#5b7cfa]" />
            ) : (
              <Wine className="h-6 w-6 text-gold" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "text-base font-bold tracking-wide",
                isPremiumActive ? "text-[#1f2433]" : "font-serif text-paper"
              )}
            >
              毛府酒庄
            </div>
            <div
              className={cn(
                "mt-0.5 text-xs",
                isPremiumActive ? "text-[#9098a8]" : "text-white/50"
              )}
            >
              {isPremiumActive ? "Premium CRM" : "订单与CRM管理"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={cn(
              "rounded-lg p-2 lg:hidden",
              isPremiumActive
                ? "text-[#9098a8] hover:bg-[#5b7cfa]/10 hover:text-[#1f2433]"
                : "text-white/60 hover:bg-white/10 hover:text-paper"
            )}
            aria-label="关闭菜单"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 py-5">
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
                  "flex items-center gap-3 text-sm transition-all",
                  isPremiumActive
                    ? cn(
                        "rounded-xl px-3 py-2.5 font-medium",
                        active
                          ? "bg-[#5b7cfa] text-white shadow-[0_4px_12px_rgba(91,124,250,0.35)]"
                          : "text-[#5b6072] hover:bg-[#5b7cfa]/10 hover:text-[#5b7cfa]"
                      )
                    : cn(
                        "rounded-sm px-3 py-3 font-serif",
                        active
                          ? "border-l-2 border-gold bg-white/10 pl-[10px] text-paper"
                          : "border-l-2 border-transparent text-white/65 hover:bg-white/5 hover:text-paper"
                      )
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            "relative border-t px-4 py-4 safe-bottom",
            isPremiumActive ? "border-[#edf0f5]" : "border-white/10"
          )}
        >
          <div className="mb-3 px-2">
            <div
              className={cn(
                "text-sm font-medium",
                isPremiumActive ? "text-[#1f2433]" : "text-paper"
              )}
            >
              {user.name}
            </div>
            <div
              className={cn(
                "mt-0.5 text-xs",
                isPremiumActive ? "text-[#9098a8]" : "text-white/45"
              )}
            >
              {ROLE_LABELS[user.role]} · {user.username}
            </div>
          </div>
          {user.role === "ADMIN" && premiumAccess && (
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("确定重置高级版体验？将回到普通版并清除试用倒计时。")) return;
                  await resetExperience();
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  isPremiumActive
                    ? "text-[#8a90a2] hover:bg-red-50 hover:text-red-600"
                    : "text-white/55 hover:bg-white/5 hover:text-red-300"
                )}
              >
                <RotateCcw className="h-4 w-4" />
                重置体验
              </button>
              {trialDaysLeft != null && trialDaysLeft > 0 && (
                <span
                  className={cn(
                    "text-xs",
                    isPremiumActive ? "text-[#9098a8]" : "text-white/45"
                  )}
                >
                  剩余{trialDaysLeft}天
                </span>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
              isPremiumActive
                ? "text-[#8a90a2] hover:bg-[#5b7cfa]/10 hover:text-[#5b7cfa]"
                : "rounded-sm text-white/55 hover:bg-white/5 hover:text-paper"
            )}
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>
    </>
  );
}
