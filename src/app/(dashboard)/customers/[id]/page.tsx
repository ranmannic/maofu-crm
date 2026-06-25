import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Customer360Page } from "@/components/customers/customer-360-page";

export default async function CustomerDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return <Customer360Page customerId={id} user={session} />;
}
