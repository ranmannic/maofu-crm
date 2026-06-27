"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { getNavTitle } from "@/components/layout/nav-items";
import { useSidebar } from "@/components/layout/sidebar-context";
import { EditionBadge, EditionSwitcher } from "@/components/edition/edition-switcher";
import type { SessionUser } from "@/lib/auth-types";

export function MobileHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const { setOpen } = useSidebar();
  const title = getNavTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-border bg-paper/95 px-4 py-3 backdrop-blur-sm safe-top lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-white text-foreground hover:bg-paper"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="font-serif text-base font-semibold truncate flex-1">{title}</h1>
      <div className="flex items-center gap-2 shrink-0">
        <EditionBadge />
        {user.role === "ADMIN" && <EditionSwitcher user={user} />}
      </div>
    </header>
  );
}
