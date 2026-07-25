import { redirect } from "next/navigation";
import { WelcomePage } from "@/components/welcome/welcome-page";
import { getSession } from "@/lib/auth";
import { isRegisterAvailable } from "@/lib/register";

export default async function WelcomeRoute() {
  const session = await getSession();
  if (session) redirect("/");

  const registerAvailable = await isRegisterAvailable();

  return <WelcomePage registerAvailable={registerAvailable} />;
}
