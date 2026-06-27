import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FollowUpWritePage } from "@/components/follow-up/follow-up-write-page";

export default async function FollowUpWriteRoute({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; returnTo?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["ADMIN", "SALES"].includes(session.role)) redirect("/follow-up");

  const params = await searchParams;
  if (!params.customerId) redirect("/follow-up");

  const returnTo =
    params.returnTo || `/customers/${params.customerId}`;

  return (
    <FollowUpWritePage
      user={session}
      customerId={params.customerId}
      returnTo={returnTo}
    />
  );
}
