"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChannelsSection } from "@/components/channels/channels-section";
import { UsersSection } from "@/components/users/users-section";

const tabs = [
  { id: "channels" as const, label: "渠道管理" },
  { id: "users" as const, label: "账号管理" },
];

export function SystemPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("channels");

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-serif font-bold">系统管理</h1>
          <p className="text-muted text-sm mt-1 font-serif">
            渠道分类与系统账号配置
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 whitespace-nowrap px-4 py-2 rounded-sm text-sm font-medium font-serif transition-colors",
              tab === t.id
                ? "bg-wine text-paper"
                : "bg-card border border-border hover:bg-background"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "channels" ? (
        <ChannelsSection embedded />
      ) : (
        <UsersSection embedded />
      )}
    </div>
  );
}
