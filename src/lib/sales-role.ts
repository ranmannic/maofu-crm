import type { SessionUser } from "@/lib/auth-types";
import type { Role } from "@/generated/prisma/client";

export function isSalesManagerRole(role: Role) {
  return role === "SALES_MANAGER";
}

export function isSalesFieldRole(role: Role) {
  return role === "SALES" || role === "SALES_MANAGER";
}

/** 首页全站/小队级业绩统计（不含成本毛利） */
export function hasOrgWidePerformanceStats(role: Role) {
  return role === "ADMIN" || role === "SALES_MANAGER";
}

export function isSalesIdInScope(
  scope: string[] | null,
  salesId: string
): boolean {
  if (scope === null) return true;
  return scope.includes(salesId);
}

export function applySalesIdScope(
  where: { salesId?: string | { in: string[] } | unknown },
  scopeIds: string[] | null,
  filterId?: string
) {
  if (filterId) {
    where.salesId = filterId;
    return;
  }
  if (scopeIds === null) return;
  if (scopeIds.length === 1) where.salesId = scopeIds[0];
  else where.salesId = { in: scopeIds };
}

export function isCustomerVisibleInTeamScope(
  session: SessionUser,
  customer: { salesId: string; deletedAt: Date | null },
  teamScope: string[] | null
): boolean {
  if (session.role === "ADMIN") return true;
  if (session.role === "SALES") {
    return customer.salesId === session.id && !customer.deletedAt;
  }
  if (session.role === "SALES_MANAGER") {
    return teamScope !== null && teamScope.includes(customer.salesId);
  }
  return false;
}

export function isSalesManagerReadOnlyCustomers(session: SessionUser) {
  return session.role === "SALES_MANAGER";
}

export function canViewCustomerPhone(
  session: SessionUser,
  customerSalesId: string,
  managerCanViewContact?: boolean
): boolean {
  if (session.role === "ADMIN") return true;
  if (session.role === "SALES" && customerSalesId === session.id) return true;
  if (session.role === "SALES_MANAGER" && managerCanViewContact) return true;
  return false;
}
