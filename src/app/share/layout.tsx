import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "毛府酒庄",
  robots: { index: false, follow: false },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f3eb] text-[#2b2620] font-serif antialiased">
      {children}
    </div>
  );
}
