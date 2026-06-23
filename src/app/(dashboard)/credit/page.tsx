import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CreditPage } from "@/components/credit/credit-page";

export default async function CreditRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["ADMIN", "SALES", "OPERATIONS"].includes(session.role)) {
    redirect("/orders");
  }
  return <CreditPage user={session} />;
}
