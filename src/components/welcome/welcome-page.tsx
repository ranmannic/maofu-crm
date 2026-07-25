"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, Sparkles, Upload, X } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { CrmWorkflowAnimation } from "@/components/welcome/crm-workflow-animation";
import { ADMIN_DASHBOARD_DATA_VISIBLE_KEY } from "@/lib/constants";
import { formatCnMobile, isValidCnMobile, normalizePhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

const FEATURES = [
  "订单、客户、跟进一体化",
  "快速管理产品和库存，更自动",
  "分享产品和订单给顾客，更专业",
  "实时掌握业绩数据，更有谱",
  "销售提成与利润分析",
  "30 天高级版免费试用",
];

export function WelcomePage({ registerAvailable }: { registerAvailable: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const validatePhone = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setPhoneError("请输入手机号");
      return false;
    }
    if (!isValidCnMobile(trimmed)) {
      setPhoneError("请输入正确的 11 位手机号");
      return false;
    }
    setPhoneError("");
    return true;
  }, []);

  function handlePhoneChange(value: string) {
    const digits = normalizePhone(value).slice(0, 11);
    setPhone(digits);
    if (phoneError) validatePhone(digits);
  }

  function handleLogoSelect(file: File | null) {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validatePhone(phone)) return;
    if (!companyName.trim()) {
      setError("请输入公司品牌名");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("phone", phone);
      form.append("companyName", companyName.trim());
      if (smsCode.trim()) form.append("smsCode", smsCode.trim());
      if (logoFile) form.append("logo", logoFile);

      const res = await fetch("/api/auth/register", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }

      sessionStorage.setItem(ADMIN_DASHBOARD_DATA_VISIBLE_KEY, "true");
      router.push(data.redirect || "/");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f8fc_0%,#e8eef5_100%)] text-[#24384f]">
      <div className="mx-auto max-w-6xl px-4 py-8 safe-top safe-bottom sm:px-6 sm:py-12">
        {/* 页头 */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#90c8ff]/50 bg-white/80 px-3 py-1 text-xs text-[#2c4e76] shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-[#4ea9ff]" />
            3 分钟开通 · 高级版 30 天试用
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-[#2c4e76] sm:text-4xl">
            YesCRM 酒庄经营管理系统
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#64748b] sm:text-base">
            从谈客户到收货好评，全流程数字化，让经营更简单。
          </p>
        </div>

        {/* 动态流程 */}
        <div className="mt-8 sm:mt-10">
          <CrmWorkflowAnimation />
        </div>

        {/* 主内容区 */}
        <div className="mt-8 grid gap-6 lg:grid-cols-5 lg:gap-8">
          {/* 左侧卖点 */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-[#c5d5e8] bg-white/90 p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-[#2c4e76]">为什么选择 YesCRM</h2>
              <ul className="mt-4 space-y-3">
                {FEATURES.map((text) => (
                  <li key={text} className="flex items-center gap-2.5 text-sm text-[#475569]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4ea9ff]/15">
                      <Crown className="h-3 w-3 text-[#4ea9ff]" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-xl bg-[#eef4fb] px-4 py-3 text-xs leading-6 text-[#64748b]">
                注册后自动初始化渠道分类，管理员账号即开即用，初始密码{" "}
                <span className="font-medium text-[#2c4e76]">12345</span>
              </div>
            </div>
          </div>

          {/* 右侧注册表单 */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-[#90c8ff]/50 bg-white p-5 shadow-[0_8px_32px_rgba(44,78,118,0.06)] sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#2c4e76]">快速体验</h2>
                  <p className="mt-1 text-sm text-[#64748b]">
                    填写信息，自动注册、登录并初始化你的专属空间
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#4ea9ff]/10 px-3 py-1 text-xs font-medium text-[#4ea9ff]">
                  免费
                </span>
              </div>

              {registerAvailable ? (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4 form-fill">
                  <div>
                    <Label className="text-[#475569]">
                      手机号 <span className="text-[#4ea9ff]">*</span>
                    </Label>
                    <Input
                      value={formatCnMobile(phone)}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onBlur={() => validatePhone(phone)}
                      placeholder="11 位手机号，用于登录"
                      inputMode="numeric"
                      autoComplete="tel"
                      className={cn(
                        "mt-1 border-[#c5d5e8] bg-[#f8fafc] focus:border-[#4ea9ff] focus:ring-[#4ea9ff]/20",
                        phoneError && "border-red-400"
                      )}
                    />
                    {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
                  </div>

                  <div>
                    <Label className="text-[#475569]">
                      短信验证码
                      <span className="ml-2 text-xs font-normal text-[#94a3b8]">选填，暂不校验</span>
                    </Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="可留空"
                        inputMode="numeric"
                        className="flex-1 border-[#c5d5e8] bg-[#f8fafc] focus:border-[#4ea9ff] focus:ring-[#4ea9ff]/20"
                      />
                      <button
                        type="button"
                        disabled
                        className="shrink-0 rounded-lg border border-[#c5d5e8] bg-[#f8fafc] px-3 text-xs text-[#94a3b8]"
                        title="短信验证暂未开放"
                      >
                        获取验证码
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-[#475569]">
                      公司品牌名 <span className="text-[#4ea9ff]">*</span>
                    </Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="如：毛府酒庄"
                      maxLength={40}
                      className="mt-1 border-[#c5d5e8] bg-[#f8fafc] focus:border-[#4ea9ff] focus:ring-[#4ea9ff]/20"
                    />
                  </div>

                  <div>
                    <Label className="text-[#475569]">
                      网站 Logo
                      <span className="ml-2 text-xs font-normal text-[#94a3b8]">选填</span>
                    </Label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => handleLogoSelect(e.target.files?.[0] ?? null)}
                    />
                    {logoPreview ? (
                      <div className="mt-1 flex items-center gap-3 rounded-lg border border-[#c5d5e8] bg-[#f8fafc] p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoPreview} alt="" className="h-12 w-12 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-[#2c4e76]">{logoFile?.name}</div>
                          <div className="text-xs text-[#94a3b8]">将显示在登录页与菜单栏</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleLogoSelect(null);
                            if (fileRef.current) fileRef.current.value = "";
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[#94a3b8] hover:bg-[#eef4fb] hover:text-[#4ea9ff]"
                          aria-label="移除 Logo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#c5d5e8] bg-[#f8fafc] px-4 py-3 text-sm text-[#64748b] transition hover:border-[#4ea9ff]/50 hover:bg-[#eef4fb]"
                      >
                        <Upload className="h-4 w-4" />
                        上传 Logo（JPG/PNG，最大 4MB）
                      </button>
                    )}
                  </div>

                  {error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#4ea9ff] text-sm font-medium text-white shadow-[0_4px_16px_rgba(78,169,255,0.35)] transition hover:bg-[#3699f5] disabled:opacity-50"
                  >
                    <Crown className="h-4 w-4" />
                    {loading ? "开通中..." : "立即开通并进入系统"}
                  </button>

                  <p className="text-center text-xs text-[#94a3b8]">
                    注册即表示同意使用本系统，登录后可在系统管理中修改密码
                  </p>
                </form>
              ) : (
                <div className="mt-6 rounded-xl border border-[#c5d5e8] bg-[#f8fafc] p-6 text-center">
                  <p className="text-sm text-[#64748b]">当前环境已开通，请使用已有账号登录。</p>
                  <Link
                    href="/login"
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#4ea9ff] text-sm font-medium text-white hover:bg-[#3699f5]"
                  >
                    前往登录
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className="text-sm text-[#64748b] transition hover:text-[#4ea9ff]"
          >
            已有账号？直接登录
          </Link>
        </div>
      </div>
    </div>
  );
}
