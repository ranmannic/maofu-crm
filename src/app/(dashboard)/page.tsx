import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "OPERATIONS") redirect("/workbench");
  return <DashboardPage user={session} />;
}
