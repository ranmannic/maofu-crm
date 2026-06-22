import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CustomersPage } from "@/components/customers/customers-page";

export default async function CustomersRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <CustomersPage user={session} />;
}
