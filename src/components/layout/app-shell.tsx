"use client";

import type { SessionUser } from "@/lib/auth-types";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { SidebarProvider } from "@/components/layout/sidebar-context";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
