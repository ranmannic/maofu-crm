import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import "./edition-theme.css";
import { getPublicSiteSettings } from "@/lib/site-settings";
import { SiteSettingsProvider } from "@/components/site/site-settings-provider";

const notoSans = Noto_Sans_SC({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const notoSerif = Noto_Serif_SC({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSiteSettings();
  return {
    title: `${settings.siteName} - 订单与CRM管理后台`,
    description: `${settings.siteName}订单与CRM管理后台，支持销售、职能、管理员三角色`,
    icons: settings.siteIconUrl
      ? {
          icon: settings.siteIconUrl,
          shortcut: settings.siteIconUrl,
          apple: settings.siteIconUrl,
        }
      : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteSettings = await getPublicSiteSettings();
  return (
    <html
      lang="zh-CN"
      className={`${notoSans.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteSettingsProvider initialSettings={siteSettings}>
          {children}
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
