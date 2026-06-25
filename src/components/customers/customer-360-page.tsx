"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Phone,
  MapPin,
  Cake,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SEGMENT_LABELS,
  CHURN_LABELS,
  REMINDER_LABELS,
  BIRTHDAY_REMINDER_LABELS,
  type CustomerSegment,
  type ChurnLevel,
  type ReminderStatus,
  type BirthdayReminderStatus,
} from "@/lib/follow-up";
import type { SessionUser } from "@/lib/auth-types";

interface Profile {
  id: string;
  name: string;
  phone: string;
  channelName: string | null;
  channelParentName: string | null;
  address: string | null;
  followUpNotes: string | null;
  birthday: string | null;
  birthdayDisplay: string | null;
  birthdayReminderStatus: BirthdayReminderStatus;
  sales: { id: string; name: string };
  customerStatus: string;
  followUpStatus: string;
  paidOrderCount: number;
  followUpCount: number;
  sinceLastOrder: string;
  segment: CustomerSegment;
  churnLevel: ChurnLevel | null;
  reminderStatus: ReminderStatus;
  canAbandon: boolean;
  shippingAddressCount: number;
}

interface TimelineItem {
  id: string;
  type: "order" | "follow_up";
  at: string;
  title: string;
  summary: string;
  href?: string;
}

export function Customer360Page({
  customerId,
  user,
}: {
  customerId: string;
  user: SessionUser;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [birthdayDraft, setBirthdayDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const canEditFollowUp = ["ADMIN", "SALES"].includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/customers/${customerId}/360`);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "加载失败");
      router.push("/customers");
      return;
    }
    setProfile(data.profile);
    setTimeline(data.timeline ?? []);
    setNotesDraft(data.profile.followUpNotes ?? "");
    setBirthdayDraft(data.profile.birthday ?? "");
    setLoading(false);
  }, [customerId, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile() {
    if (!canEditFollowUp) return;
    setSaving(true);
    const res = await fetch(`/api/follow-up/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        followUpNotes: notesDraft || null,
        birthday: birthdayDraft || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setNotesOpen(false);
    await load();
    setSaving(false);
  }

  if (loading || !profile) {
    return <div className="text-center py-20 text-muted">加载中...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-serif font-bold truncate">
            {profile.name}
          </h1>
          <p className="text-sm text-muted font-serif">客户 360°</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="wine">{SEGMENT_LABELS[profile.segment]}</Badge>
        {profile.churnLevel && (
          <Badge variant={profile.churnLevel === "RED" ? "warning" : "default"}>
            {CHURN_LABELS[profile.churnLevel]}
          </Badge>
        )}
        {profile.reminderStatus !== "NONE" && (
          <Badge variant="warning">{REMINDER_LABELS[profile.reminderStatus]}</Badge>
        )}
        {profile.birthdayReminderStatus !== "NONE" && (
          <Badge variant="wine">
            {BIRTHDAY_REMINDER_LABELS[profile.birthdayReminderStatus]}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "成交订单", value: String(profile.paidOrderCount) },
          { label: "跟进次数", value: String(profile.followUpCount) },
          { label: "距上次下单", value: profile.sinceLastOrder },
          { label: "收货地址", value: String(profile.shippingAddressCount) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-3 pb-3">
              <div className="text-xs text-muted">{s.label}</div>
              <div className="font-bold font-serif mt-0.5">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2">
            <Phone className="h-4 w-4 text-muted shrink-0 mt-0.5" />
            <span>{profile.phone || "—"}</span>
          </div>
          <div className="flex gap-2">
            <MapPin className="h-4 w-4 text-muted shrink-0 mt-0.5" />
            <span>
              {profile.channelParentName
                ? `${profile.channelParentName} / ${profile.channelName}`
                : profile.channelName || "—"}
            </span>
          </div>
          <div>负责销售：{profile.sales.name}</div>
          {profile.address && <div>地址：{profile.address}</div>}
          <div className="flex items-center gap-2">
            <Cake className="h-4 w-4 text-muted" />
            <span>{profile.birthdayDisplay || "未设置生日"}</span>
          </div>
          {profile.followUpNotes && (
            <div className="flex gap-2 pt-1">
              <StickyNote className="h-4 w-4 text-muted shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{profile.followUpNotes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {canEditFollowUp && (
          <>
            <Link href="/orders">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                新建订单
              </Button>
            </Link>
            <Link href={`/follow-up?customer=${profile.id}`}>
              <Button variant="secondary" size="sm">
                写跟进
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={() => setNotesOpen(true)}>
              编辑备注/生日
            </Button>
          </>
        )}
        <Link href={`/customers`}>
          <Button variant="ghost" size="sm">
            客户列表
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">动态时间轴</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-center text-muted py-8">暂无动态</p>
          ) : (
            <ul className="space-y-0 border-l-2 border-border ml-2">
              {timeline.map((item) => (
                <li key={`${item.type}-${item.id}`} className="relative pl-6 pb-6 last:pb-0">
                  <span
                    className={cn(
                      "absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full",
                      item.type === "order" ? "bg-wine" : "bg-gold"
                    )}
                  />
                  <div className="text-xs text-muted">
                    {new Date(item.at).toLocaleString("zh-CN")}
                  </div>
                  <div className="font-medium text-sm mt-0.5">{item.title}</div>
                  <p className="text-sm text-muted mt-0.5">{item.summary}</p>
                  {item.href && (
                    <Link href={item.href} className="text-xs text-wine hover:underline mt-1 inline-block">
                      查看订单
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal open={notesOpen} onClose={() => setNotesOpen(false)} title="客户资料">
        <div className="space-y-4">
          <div>
            <Label>生日</Label>
            <Input
              type="date"
              value={birthdayDraft}
              onChange={(e) => setBirthdayDraft(e.target.value)}
            />
          </div>
          <div>
            <Label>跟进备注</Label>
            <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="客户偏好、重要提醒等"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setNotesOpen(false)}>
            取消
          </Button>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
