import { getEditionState, isPremiumEdition } from "@/lib/edition";
import { requireSession, PRODUCT_MANAGER_ROLES, type SessionUser } from "@/lib/auth";
import type { Role } from "@/generated/prisma/client";

export async function requirePremiumInventoryManager() {
  const session = await requireSession(PRODUCT_MANAGER_ROLES);
  const edition = await getEditionState();
  if (!isPremiumEdition(edition)) {
    throw new Error("PREMIUM_REQUIRED");
  }
  return session;
}

export async function requirePremiumInventoryReader() {
  const session = await requireSession(["ADMIN", "OPERATIONS", "SALES"]);
  const edition = await getEditionState();
  if (!isPremiumEdition(edition)) {
    throw new Error("PREMIUM_REQUIRED");
  }
  return session;
}

export function inventoryErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "PREMIUM_REQUIRED") {
    return { message: "库存管理为高级版功能", status: 403 as const };
  }
  if (error instanceof Error) {
    return { message: error.message, status: 400 as const };
  }
  return null;
}

export type InventorySession = SessionUser & { role: Role };
