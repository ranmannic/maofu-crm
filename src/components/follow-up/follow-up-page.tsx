"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Phone,
  AlertTriangle,
  Clock,
  UserX,
  RotateCcw,
  Bell,
} from "lucide-react";
import { FilterField } from "@/components/ui/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth-types";
import {
  SEGMENT_LABELS,
  CHURN_LABELS,
  REMINDER_LABELS,
  BIRTHDAY_REMINDER_LABELS,
  type ChurnLevel,
  type CustomerSegment,
  type ReminderStatus,
  type BirthdayReminderStatus,
} from "@/lib/follow-up";

const HISTORY_PAGE_SIZE = 10;

type SegmentFilter = CustomerSegment | "ABANDONED" | "REMINDER" | "";

interface FollowUpRow {
  id: string;
  name: string;
  phone: string;
  channelName: string | null;
  sales: { id: string; name: string };
  customerStatus: "LEAD" | "CLOSED";
  followUpStatus: "ACTIVE" | "ABANDONED";
  abandonedAt: string | null;
  abandonReason: string | null;
  paidOrderCount: number;
  lastOrderAt: string | null;
  sinceLastOrder: string;
  segment: CustomerSegment;
  churnLevel: ChurnLevel | null;
  reminderStatus: ReminderStatus;
  birthday: string | null;
  birthdayReminderStatus: BirthdayReminderStatus;
  latestFollowUp: {
    id: string;
    followedAt: string;
    content: string;
    nextPlan: string | null;
    nextFollowUpAt: string | null;
    userName: string;
  } | null;
  followUpCount: number;
  canAbandon: boolean;
}

interface FollowUpStats {
  total: number;
  lead: number;
  closed: number;
  churned: number;
  abandoned: number;
  dueSoon: number;
  overdue: number;
}

interface FollowUpRecord {
  id: string;
  followedAt: string;
  content: string;
  nextPlan: string | null;
  nextFollowUpAt: string | null;
  userName: string;
  createdAt: string;
}

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  channelName: string | null;
  address: string | null;
  followUpNotes: string | null;
  birthday: string | null;
  birthdayDisplay?: string;
  birthdayReminderStatus?: BirthdayReminderStatus;
  sales: { id: string; name: string };
  customerStatus: "LEAD" | "CLOSED";
  followUpStatus: "ACTIVE" | "ABANDONED";
  paidOrderCount: number;
  followUpCount: number;
  lastOrderAt: string | null;
  sinceLastOrder: string;
  segment: CustomerSegment;
  churnLevel: ChurnLevel | null;
  canAbandon: boolean;
}

interface SalesUser {
  id: string;
  name: string;
}

const SEGMENT_TABS: { key: SegmentFilter; label: string }[] = [
  { key: "", label: "全部" },
  { key: "CLOSED", label: "已成交" },
  { key: "LEAD", label: "线索" },
  { key: "CHURNED", label: "流失" },
  { key: "REMINDER", label: "待跟进" },
  { key: "ABANDONED", label: "已放弃" },
];

function toDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowDatetimeLocal(): string {
  return toDatetimeLocal(new Date());
}

function rowHighlight(
  reminder: ReminderStatus,
  abandoned: boolean,
  birthdayReminder: BirthdayReminderStatus = "NONE"
): string {
  if (abandoned) return "opacity-70";
  if (birthdayReminder !== "NONE") {
    return "bg-pink-50/90 ring-1 ring-inset ring-pink-300";
  }
  if (reminder === "OVERDUE") return "bg-red-50/80 ring-1 ring-inset ring-red-200";
  if (reminder === "DUE_SOON") return "bg-amber-50/80 ring-1 ring-inset ring-amber-200";
  return "";
}

export function FollowUpPage({ user }: { user: SessionUser }) {
  const isAdmin = user.role === "ADMIN";
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [stats, setStats] = useState<FollowUpStats | null>(null);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [segment, setSegment] = useState<SegmentFilter>("");
  const [draftQ, setDraftQ] = useState("");
  const [draftSalesFilter, setDraftSalesFilter] = useState("");
  const [draftClosedOnly, setDraftClosedOnly] = useState(isAdmin);
  const [appliedQ, setAppliedQ] = useState("");
  const [appliedSalesFilter, setAppliedSalesFilter] = useState("");
  const [appliedClosedOnly, setAppliedClosedOnly] = useState(isAdmin);

  const [followOpen, setFollowOpen] = useState(false);
  const [followTarget, setFollowTarget] = useState<FollowUpRow | null>(null);
  const [followForm, setFollowForm] = useState({
    followedAt: nowDatetimeLocal(),
    content: "",
    nextPlan: "",
    nextFollowUpAt: "",
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [notesForm, setNotesForm] = useState("");
  const [birthdayForm, setBirthdayForm] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [records, setRecords] = useState<FollowUpRecord[]>([]);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsTotalPages, setRecordsTotalPages] = useState(1);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [abandonOpen, setAbandonOpen] = useState(false);
  const [abandonTargetId, setAbandonTargetId] = useState<string | null>(null);
  const [abandonReason, setAbandonReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    if (appliedQ) params.set("q", appliedQ);
    if (appliedSalesFilter) params.set("salesId", appliedSalesFilter);
    if (segment) params.set("segment", segment);
    if (isAdmin && appliedClosedOnly) params.set("closedOnly", "true");

    try {
      const res = await fetch(`/api/follow-up?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data);
        setTotal(json.pagination.total);
        setTotalPages(json.pagination.totalPages);
        setStats(json.stats ?? null);
        if (json.salesUsers) setSalesUsers(json.salesUsers);
      } else {
        const data = await res.json().catch(() => ({}));
        setRows([]);
        setStats(null);
        setLoadError(
          data.error ||
            "客户跟进数据加载失败，请确认数据库已迁移并重启服务后重试"
        );
      }
    } catch {
      setRows([]);
      setStats(null);
      setLoadError("网络异常，无法加载客户跟进数据");
    }
    setLoading(false);
  }, [page, appliedQ, appliedSalesFilter, segment, appliedClosedOnly, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadProfile(customerId: string) {
    setProfileLoading(true);
    const res = await fetch(`/api/follow-up/${customerId}`);
    if (res.ok) {
      const data: CustomerProfile = await res.json();
      setProfile(data);
      setNotesForm(data.followUpNotes ?? "");
      setBirthdayForm(data.birthday ?? "");
    }
    setProfileLoading(false);
  }

  async function loadRecords(customerId: string, pageNum: number) {
    setRecordsLoading(true);
    const params = new URLSearchParams({
      page: String(pageNum),
      pageSize: String(HISTORY_PAGE_SIZE),
    });
    const res = await fetch(`/api/follow-up/${customerId}/records?${params}`);
    if (res.ok) {
      const json = await res.json();
      setRecords(json.data);
      setRecordsTotal(json.pagination.total);
      setRecordsTotalPages(json.pagination.totalPages);
      setRecordsPage(json.pagination.page);
    }
    setRecordsLoading(false);
  }

  function openFollowModal(row: FollowUpRow) {
    setFollowTarget(row);
    setFollowForm({
      followedAt: nowDatetimeLocal(),
      content: "",
      nextPlan: "",
      nextFollowUpAt: "",
    });
    setError("");
    setFollowOpen(true);
  }

  function openProfileModal(row: FollowUpRow) {
    setProfileId(row.id);
    setProfile(null);
    setNotesForm("");
    setBirthdayForm("");
    setRecords([]);
    setRecordsPage(1);
    setError("");
    setProfileOpen(true);
    loadProfile(row.id);
    loadRecords(row.id, 1);
  }

  function handleSearch() {
    setAppliedQ(draftQ);
    setAppliedSalesFilter(draftSalesFilter);
    setAppliedClosedOnly(draftClosedOnly);
    setPage(1);
  }

  function handleResetFilters() {
    setDraftQ("");
    setDraftSalesFilter("");
    setDraftClosedOnly(isAdmin);
    setAppliedQ("");
    setAppliedSalesFilter("");
    setAppliedClosedOnly(isAdmin);
    setSegment("");
    setPage(1);
  }

  function handleSegmentChange(key: SegmentFilter) {
    setSegment(key);
    setPage(1);
  }

  async function handleSaveFollowUp() {
    if (!followTarget) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/follow-up/${followTarget.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(followForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setFollowOpen(false);
    setFollowTarget(null);
    await load();
    setSaving(false);
  }

  async function handleSaveNotes() {
    if (!profileId) return;
    setNotesSaving(true);
    setError("");
    const res = await fetch(`/api/follow-up/${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpNotes: notesForm }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setNotesSaving(false);
      return;
    }
    setProfile(data);
    setNotesSaving(false);
  }

  async function handleSaveBirthday() {
    if (!profileId) return;
    setBirthdaySaving(true);
    setError("");
    const res = await fetch(`/api/follow-up/${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthday: birthdayForm || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setBirthdaySaving(false);
      return;
    }
    setProfile(data);
    setBirthdayForm(data.birthday ?? "");
    await load();
    setBirthdaySaving(false);
  }

  async function handleAbandon() {
    if (!abandonTargetId) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/follow-up/${abandonTargetId}/abandon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: abandonReason }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "操作失败");
      setSaving(false);
      return;
    }
    setAbandonOpen(false);
    setAbandonReason("");
    setAbandonTargetId(null);
    setProfileOpen(false);
    await load();
    setSaving(false);
  }

  async function handleRestore(customerId: string) {
    if (!confirm("确定恢复该客户的跟进？")) return;
    const res = await fetch(`/api/follow-up/${customerId}/restore`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "恢复失败");
      return;
    }
    await load();
  }

  function openAbandonModal(customerId: string) {
    setAbandonTargetId(customerId);
    setAbandonReason("");
    setError("");
    setAbandonOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-serif font-bold">客户跟进</h1>
        <p className="text-muted text-sm mt-1 font-serif">
          管理线索与已成交客户的跟进记录，及时提醒待跟进事项
        </p>
      </div>

      {stats && (
        <div className="stat-tile-grid cols-6 gap-3">
          {[
            { key: "" as SegmentFilter, label: "跟进中", value: stats.total },
            { key: "LEAD" as SegmentFilter, label: "线索", value: stats.lead },
            { key: "CLOSED" as SegmentFilter, label: "已成交", value: stats.closed },
            { key: "CHURNED" as SegmentFilter, label: "流失", value: stats.churned },
            { key: "ABANDONED" as SegmentFilter, label: "已放弃", value: stats.abandoned },
            {
              key: "REMINDER" as SegmentFilter,
              label: "待跟进",
              value: stats.dueSoon + stats.overdue,
              highlight: stats.overdue > 0,
            },
          ].map((item) => (
            <button
              key={item.key || "all"}
              type="button"
              onClick={() => handleSegmentChange(item.key)}
              className={cn(
                "rounded-sm border p-3 text-left transition-colors font-serif",
                segment === item.key
                  ? "border-wine bg-wine/5"
                  : "border-border bg-paper hover:border-wine/40"
              )}
            >
              <div className="text-xs text-muted">{item.label}</div>
              <div
                className={cn(
                  "text-xl font-bold mt-1",
                  item.highlight ? "text-red-600" : "text-ink"
                )}
              >
                {item.value}
              </div>
              {item.key === "REMINDER" && stats.overdue > 0 && (
                <div className="text-xs text-red-600 mt-0.5">
                  逾期 {stats.overdue}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          {isAdmin && (
            <label className="flex items-center gap-2 mb-4 text-sm font-serif cursor-pointer">
              <input
                type="checkbox"
                checked={draftClosedOnly}
                onChange={(e) => {
                  setDraftClosedOnly(e.target.checked);
                  setAppliedClosedOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-border"
              />
              只显示成交客户
            </label>
          )}

          <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {SEGMENT_TABS.map((tab) => (
              <button
                key={tab.key || "all"}
                type="button"
                onClick={() => handleSegmentChange(tab.key)}
                className={cn(
                  "shrink-0 whitespace-nowrap px-3 py-1.5 rounded-sm text-sm font-serif transition-colors",
                  segment === tab.key
                    ? "bg-wine text-paper"
                    : "bg-gray-100 text-muted hover:bg-gray-200"
                )}
              >
                {tab.label}
                {tab.key === "REMINDER" && stats && stats.overdue > 0 && (
                  <Bell className="inline h-3.5 w-3.5 ml-1 text-amber-200" />
                )}
              </button>
            ))}
          </div>

          <div className="filter-grid">
            <FilterField label="客户名 / 电话" className="filter-field-wide">
              <Input
                placeholder="输入关键词"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </FilterField>
            {isAdmin && (
              <FilterField label="负责销售">
                <Select
                  value={draftSalesFilter}
                  onChange={(e) => setDraftSalesFilter(e.target.value)}
                >
                  <option value="">全部销售</option>
                  {salesUsers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FilterField>
            )}
            <div className="filter-actions">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              查询
            </Button>
            <Button variant="secondary" onClick={handleResetFilters}>
              重置
            </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : loadError ? (
            <div className="text-center py-12 text-red-700">{loadError}</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted">暂无客户</div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="w-full text-sm ink-table">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-3">客户</th>
                      <th className="pb-3">类型</th>
                      <th className="pb-3">上次下单距今</th>
                      {isAdmin && <th className="pb-3">负责销售</th>}
                      <th className="pb-3">最近跟进</th>
                      <th className="pb-3">下次跟进</th>
                      <th className="pb-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b border-border/40",
                          rowHighlight(
                            row.reminderStatus,
                            row.followUpStatus === "ABANDONED",
                            row.birthdayReminderStatus
                          )
                        )}
                      >
                        <td className="py-3">
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/customers/${row.id}`}
                              className={cn(
                                "hover:underline",
                                row.birthdayReminderStatus !== "NONE" &&
                                  row.followUpStatus === "ACTIVE"
                                  ? "text-pink-700 font-semibold"
                                  : "text-wine"
                              )}
                            >
                              {row.name}
                            </Link>
                            {row.birthdayReminderStatus !== "NONE" &&
                              row.followUpStatus === "ACTIVE" && (
                                <Badge
                                  variant="wine"
                                  className="animate-pulse bg-pink-100 text-pink-800 border-pink-300"
                                >
                                  🎂 {BIRTHDAY_REMINDER_LABELS[row.birthdayReminderStatus]}
                                </Badge>
                              )}
                            {row.reminderStatus !== "NONE" &&
                              row.followUpStatus === "ACTIVE" && (
                                <Badge
                                  variant={
                                    row.reminderStatus === "OVERDUE"
                                      ? "danger"
                                      : "warning"
                                  }
                                  className="animate-pulse"
                                >
                                  {row.reminderStatus === "OVERDUE" && (
                                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                                  )}
                                  {REMINDER_LABELS[row.reminderStatus]}
                                </Badge>
                              )}
                            {row.followUpStatus === "ABANDONED" && (
                              <Badge variant="default">已放弃</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted mt-0.5">
                            {row.phone}
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              row.segment === "CHURNED" ? "danger" : "wine"
                            }
                          >
                            {SEGMENT_LABELS[row.segment]}
                          </Badge>
                        </td>
                        <td className="py-3">
                          {row.customerStatus === "CLOSED" && row.lastOrderAt ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 font-medium",
                                row.churnLevel === "GREEN" && "text-green-700",
                                row.churnLevel === "YELLOW" && "text-amber-700",
                                row.churnLevel === "RED" && "text-red-700"
                              )}
                            >
                              <span
                                className={cn(
                                  "inline-block h-2 w-2 rounded-full",
                                  row.churnLevel === "GREEN" && "bg-green-500",
                                  row.churnLevel === "YELLOW" && "bg-amber-500",
                                  row.churnLevel === "RED" && "bg-red-500"
                                )}
                              />
                              {row.sinceLastOrder}
                              {row.churnLevel && (
                                <span className="text-xs font-normal">
                                  ({CHURN_LABELS[row.churnLevel]})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3">{row.sales.name}</td>
                        )}
                        <td className="py-3">
                          {row.latestFollowUp ? (
                            <div>
                              <div className="text-xs text-muted">
                                {formatDate(row.latestFollowUp.followedAt)}
                              </div>
                              <div className="line-clamp-1 max-w-[200px]">
                                {row.latestFollowUp.content}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted">暂无</span>
                          )}
                        </td>
                        <td className="py-3">
                          {row.latestFollowUp?.nextFollowUpAt ? (
                            <span
                              className={cn(
                                row.reminderStatus === "OVERDUE" &&
                                  "text-red-700 font-semibold",
                                row.reminderStatus === "DUE_SOON" &&
                                  "text-amber-700 font-semibold"
                              )}
                            >
                              <Clock className="inline h-3.5 w-3.5 mr-0.5" />
                              {formatDate(row.latestFollowUp.nextFollowUpAt)}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 space-x-2 whitespace-nowrap">
                          {row.followUpStatus === "ACTIVE" ? (
                            <>
                              <button
                                onClick={() => openFollowModal(row)}
                                className="text-wine hover:underline text-xs inline-flex items-center gap-0.5"
                              >
                                <Phone className="h-3 w-3" />
                                跟进
                              </button>
                              {row.canAbandon && (
                                <button
                                  onClick={() => openAbandonModal(row.id)}
                                  className="text-muted hover:text-red-700 text-xs inline-flex items-center gap-0.5"
                                >
                                  <UserX className="h-3 w-3" />
                                  放弃
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handleRestore(row.id)}
                              className="text-wine hover:underline text-xs inline-flex items-center gap-0.5"
                            >
                              <RotateCcw className="h-3 w-3" />
                              恢复跟进
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={DEFAULT_PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Modal
        open={followOpen}
        onClose={() => setFollowOpen(false)}
        title={followTarget ? `跟进 · ${followTarget.name}` : "新增跟进"}
      >
        <div className="space-y-3">
          <div>
            <Label>跟进时间 *</Label>
            <Input
              type="datetime-local"
              value={followForm.followedAt}
              onChange={(e) =>
                setFollowForm({ ...followForm, followedAt: e.target.value })
              }
            />
          </div>
          <div>
            <Label>跟进内容 *</Label>
            <Textarea
              value={followForm.content}
              onChange={(e) =>
                setFollowForm({ ...followForm, content: e.target.value })
              }
              rows={4}
              placeholder="记录本次沟通情况..."
            />
          </div>
          <div>
            <Label>下一次跟进计划</Label>
            <Textarea
              value={followForm.nextPlan}
              onChange={(e) =>
                setFollowForm({ ...followForm, nextPlan: e.target.value })
              }
              rows={2}
              placeholder="下次沟通目标或要点..."
            />
          </div>
          <div>
            <Label>下一次跟进时间</Label>
            <Input
              type="datetime-local"
              value={followForm.nextFollowUpAt}
              onChange={(e) =>
                setFollowForm({
                  ...followForm,
                  nextFollowUpAt: e.target.value,
                })
              }
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setFollowOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSaveFollowUp} disabled={saving}>
            {saving ? "保存中..." : "保存跟进"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title={profile ? profile.name : "客户详情"}
        className="sm:max-w-2xl"
      >
        {profileLoading || !profile ? (
          <div className="py-8 text-center text-muted">加载中...</div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted text-xs">客户类型</div>
                <Badge variant={profile.segment === "CHURNED" ? "danger" : "wine"}>
                  {SEGMENT_LABELS[profile.segment]}
                </Badge>
              </div>
              <div>
                <div className="text-muted text-xs">渠道</div>
                <div>{profile.channelName || "—"}</div>
              </div>
              <div>
                <div className="text-muted text-xs">电话</div>
                <div>{profile.phone || "—"}</div>
              </div>
              <div>
                <div className="text-muted text-xs">负责销售</div>
                <div>{profile.sales.name}</div>
              </div>
              <div>
                <div className="text-muted text-xs">上次下单距今</div>
                <div>{profile.sinceLastOrder}</div>
              </div>
              <div>
                <div className="text-muted text-xs">跟进次数</div>
                <div>{profile.followUpCount} 次</div>
              </div>
              {profile.address && (
                <div className="col-span-2">
                  <div className="text-muted text-xs">地址</div>
                  <div>{profile.address}</div>
                </div>
              )}
            </div>

            <div>
              <Label>客户生日</Label>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Input
                  type="date"
                  value={birthdayForm}
                  onChange={(e) => setBirthdayForm(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSaveBirthday}
                  disabled={birthdaySaving}
                >
                  {birthdaySaving ? "保存中..." : "保存生日"}
                </Button>
                {profile.birthdayReminderStatus &&
                  profile.birthdayReminderStatus !== "NONE" && (
                    <Badge className="bg-pink-100 text-pink-800 border-pink-300">
                      🎂 {BIRTHDAY_REMINDER_LABELS[profile.birthdayReminderStatus]}
                    </Badge>
                  )}
              </div>
              <p className="text-xs text-muted mt-1">
                设置后将在生日前 7 天至生日后 3 天在列表中醒目提醒
              </p>
            </div>

            <div>
              <Label>客户描述备注</Label>
              <Textarea
                value={notesForm}
                onChange={(e) => setNotesForm(e.target.value)}
                rows={3}
                placeholder="记录该客户的特殊说明、偏好、注意事项等..."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                >
                  {notesSaving ? "保存中..." : "保存备注"}
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3 font-serif">历史跟进记录</h3>
              {recordsLoading ? (
                <div className="text-center py-6 text-muted text-sm">加载中...</div>
              ) : records.length === 0 ? (
                <div className="text-center py-6 text-muted text-sm border border-border rounded-sm">
                  暂无跟进记录
                </div>
              ) : (
                <>
                  <div className="space-y-3 border border-border rounded-sm p-3">
                    {records.map((r) => (
                      <div
                        key={r.id}
                        className="border-b border-border/40 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span>{r.userName}</span>
                          <span>{formatDate(r.followedAt)}</span>
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{r.content}</p>
                        {r.nextPlan && (
                          <p className="text-xs text-muted mt-1">
                            下次计划：{r.nextPlan}
                          </p>
                        )}
                        {r.nextFollowUpAt && (
                          <p className="text-xs text-muted">
                            下次跟进：{formatDate(r.nextFollowUpAt)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {recordsTotalPages > 1 && (
                    <div className="mt-3">
                      <Pagination
                        page={recordsPage}
                        totalPages={recordsTotalPages}
                        total={recordsTotal}
                        pageSize={HISTORY_PAGE_SIZE}
                        onPageChange={(p) => {
                          if (profileId) loadRecords(profileId, p);
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        )}
        <ModalFooter>
          {profile?.followUpStatus === "ACTIVE" && profile.canAbandon && (
            <Button
              variant="secondary"
              className="mr-auto text-red-700"
              onClick={() => openAbandonModal(profile.id)}
            >
              <UserX className="h-4 w-4 mr-1" />
              放弃客户
            </Button>
          )}
          <Button variant="secondary" onClick={() => setProfileOpen(false)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={abandonOpen}
        onClose={() => setAbandonOpen(false)}
        title="放弃客户"
      >
        <p className="text-sm text-muted mb-3 font-serif">
          放弃后该客户将不再出现在跟进列表中，可随时恢复。
        </p>
        <div>
          <Label>放弃理由 *</Label>
          <Textarea
            value={abandonReason}
            onChange={(e) => setAbandonReason(e.target.value)}
            rows={3}
            placeholder="请说明放弃原因..."
          />
        </div>
        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAbandonOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleAbandon}
            disabled={saving || !abandonReason.trim()}
          >
            {saving ? "提交中..." : "确认放弃"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
