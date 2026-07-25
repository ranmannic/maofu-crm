export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f8fc_0%,#e8eef5_100%)]">
      {children}
    </div>
  );
}
