import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { OrdersPage } from "@/components/orders/orders-page";

export default async function OrdersRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <OrdersPage user={session} />;
}
