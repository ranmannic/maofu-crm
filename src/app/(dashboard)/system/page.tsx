import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SystemPage } from "@/components/system/system-page";

export default async function SystemRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");
  return <SystemPage />;
}
