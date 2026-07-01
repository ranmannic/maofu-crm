import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CommissionsPage } from "@/components/commissions/commissions-page";

export default async function CommissionsRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");
  return <CommissionsPage />;
}
