import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FollowUpPage } from "@/components/follow-up/follow-up-page";

export default async function FollowUpRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "OPERATIONS") redirect("/orders");
  return <FollowUpPage user={session} />;
}
