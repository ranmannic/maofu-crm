"use client";

import { useEffect, useRef, useState } from "react";
import { Crown, HardDriveUpload, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useEdition } from "@/components/edition/edition-provider";
import { PremiumExperienceModal } from "@/components/edition/premium-experience-modal";
import { StoragePricingModal } from "@/components/site/storage-pricing-modal";
import { useSiteSettings } from "@/components/site/site-settings-provider";
import { formatBytes } from "@/lib/utils";

type SiteSettingsResponse = {
  siteName: string;
  siteIconUrl: string | null;
  storage: {
    usedBytes: number;
    limitBytes: number;
    canUpgradeToPremium: boolean;
    isPremium: boolean;
  };
};

export function WebsiteSettingsSection() {
  const { startTrial, isPremiumActive } = useEdition();
  const { refresh: refreshSiteSettings } = useSiteSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [siteName, setSiteName] = useState("毛府酒庄");
  const [siteIconUrl, setSiteIconUrl] = useState<string | null>(null);
  const [storage, setStorage] = useState<SiteSettingsResponse["storage"] | null>(null);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/settings/site");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "加载失败");
      setLoading(false);
      return;
    }
    setSiteName(data.siteName ?? "毛府酒庄");
    setSiteIconUrl(data.siteIconUrl ?? null);
    setStorage(data.storage ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveName() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings/site", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setSiteName(data.siteName);
    setSaving(false);
    await refreshSiteSettings();
  }

  async function uploadIcon(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    setError("");
    const res = await fetch("/api/settings/site", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "上传失败");
      setUploading(false);
      return;
    }
    setSiteIconUrl(data.siteIconUrl ?? null);
    setUploading(false);
    await refreshSiteSettings();
  }

  async function handleStartTrial() {
    setStartingTrial(true);
    const ok = await startTrial();
    setStartingTrial(false);
    if (ok) {
      setPremiumModalOpen(false);
      await load();
    }
  }

  const ratio = storage ? Math.min(100, Math.round((storage.usedBytes / storage.limitBytes) * 100)) : 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">网站品牌设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="py-10 text-center text-muted">加载中...</div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card"
                >
                  {siteIconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={siteIconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">网站图标</p>
                  <p className="mt-1 text-xs text-muted">
                    将同步显示在登录页、菜单栏左上角与浏览器标签页。
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "上传中..." : "上传图标"}
                  </Button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadIcon(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
              </div>

              <div>
                <Label>网站名称</Label>
                <Input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="请输入网站名称"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end">
                <Button onClick={saveName} disabled={saving || !siteName.trim()}>
                  {saving ? "保存中..." : "保存品牌设置"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">网站存储空间</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !storage ? (
            <div className="py-10 text-center text-muted">加载中...</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    已使用 {formatBytes(storage.usedBytes)} / {formatBytes(storage.limitBytes)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    统计范围包括上传的订单凭证、产品图片、网站图标等文件。
                  </p>
                </div>
                <div className="shrink-0 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted">
                  {storage.isPremium ? "高级版上限 1GB" : "普通版上限 200MB"}
                </div>
              </div>

              <div className="h-2 rounded-full bg-card">
                <div
                  className="h-2 rounded-full bg-wine transition-all"
                  style={{ width: `${ratio}%` }}
                />
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <HardDriveUpload className="mt-0.5 h-5 w-5 text-wine" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">需要更多空间？</p>
                    <p className="mt-1 text-xs text-muted">
                      {isPremiumActive
                        ? "高级版可按 20 元 / GB / 年追加空间，适合持续增长的图片与凭证。"
                        : "升级到高级版后，基础空间直接提升到 1GB，并解锁更多经营能力。"}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      isPremiumActive ? setStorageModalOpen(true) : setPremiumModalOpen(true)
                    }
                  >
                    {isPremiumActive ? (
                      "查看扩容价目表"
                    ) : (
                      <>
                        <Crown className="mr-2 h-4 w-4" />
                        升级高级版
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <PremiumExperienceModal
        open={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
        onStartTrial={handleStartTrial}
        starting={startingTrial}
      />
      <StoragePricingModal
        open={storageModalOpen}
        onClose={() => setStorageModalOpen(false)}
      />
    </div>
  );
}
