import { prisma } from "@/lib/prisma";

export const DEFAULT_REGISTER_PASSWORD = "12345";

export function isSelfRegisterForcedOpen() {
  return process.env.ENABLE_SELF_REGISTER === "true";
}

export async function isRegisterAvailable() {
  if (isSelfRegisterForcedOpen()) return true;
  const count = await prisma.user.count();
  return count === 0;
}
