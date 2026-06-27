import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { OrdersPage } from "@/components/orders/orders-page";

export default async function NewOrderRoute({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; returnTo?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["ADMIN", "SALES"].includes(session.role)) redirect("/orders");

  const params = await searchParams;
  if (!params.customerId) redirect("/orders");

  const returnTo =
    params.returnTo || `/customers/${params.customerId}`;

  return (
    <OrdersPage
      user={session}
      variant="create"
      initialCustomerId={params.customerId}
      returnTo={returnTo}
    />
  );
}
