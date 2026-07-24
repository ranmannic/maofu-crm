import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth-types";
import { isCustomerVisibleInTeamScope, isSalesIdInScope } from "@/lib/sales-role";

export {
  isSalesManagerRole,
  isSalesFieldRole,
  hasOrgWidePerformanceStats,
  isSalesIdInScope,
  applySalesIdScope,
  isCustomerVisibleInTeamScope,
  isSalesManagerReadOnlyCustomers,
  canViewCustomerPhone,
} from "@/lib/sales-role";

const EMPTY_SCOPE = ["__no_sales_scope__"];

/** null = 全站；否则为可见的销售 id 列表 */
export async function getSalesScopeIds(
  session: SessionUser
): Promise<string[] | null> {
  if (session.role === "ADMIN") return null;
  if (session.role === "SALES") return [session.id];
  if (session.role === "SALES_MANAGER") {
    const ids = await getManagedSalesIds(session.id);
    return ids.length > 0 ? ids : EMPTY_SCOPE;
  }
  return EMPTY_SCOPE;
}

export async function getManagedSalesIds(managerId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { salesManagerId: managerId, role: "SALES" },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => r.id);
}

/** 订单/账期：销售本人；销售管理为管辖队员 */
export type SalesScopeFilter = string | { in: string[] } | undefined;

export async function getOrderSalesScopeFilter(
  session: SessionUser
): Promise<SalesScopeFilter> {
  if (session.role === "SALES") return session.id;
  if (session.role === "SALES_MANAGER") {
    const ids = await getManagedSalesIds(session.id);
    if (ids.length === 0) return { in: EMPTY_SCOPE };
    if (ids.length === 1) return ids[0];
    return { in: ids };
  }
  return undefined;
}

export async function canAccessOrderSales(
  session: SessionUser,
  orderSalesId: string
): Promise<boolean> {
  if (session.role === "ADMIN" || session.role === "OPERATIONS") return true;
  if (session.role === "SALES") return orderSalesId === session.id;
  if (session.role === "SALES_MANAGER") {
    const scope = await getSalesScopeIds(session);
    return isSalesIdInScope(scope, orderSalesId);
  }
  return false;
}

export async function getManagerContactVisibility(
  session: SessionUser
): Promise<boolean> {
  if (session.role !== "SALES_MANAGER") return false;
  const profile = await loadManagerProfile(session.id);
  return profile?.canViewCustomerContact ?? false;
}

export async function canReadCustomerRecord(
  session: SessionUser,
  customer: { salesId: string; deletedAt: Date | null }
): Promise<boolean> {
  if (session.role === "ADMIN") return true;
  if (session.role === "SALES") {
    return customer.salesId === session.id && !customer.deletedAt;
  }
  if (session.role === "SALES_MANAGER") {
    const scope = await getSalesScopeIds(session);
    return isCustomerVisibleInTeamScope(session, customer, scope);
  }
  return false;
}

export async function loadManagerProfile(managerId: string) {
  return prisma.user.findUnique({
    where: { id: managerId },
    select: {
      salesTeamName: true,
      canViewCustomerContact: true,
      name: true,
    },
  });
}

export async function assignSalesTeam(
  managerId: string,
  data: {
    salesTeamName?: string | null;
    canViewCustomerContact?: boolean;
    managedSalesIds?: string[];
  }
) {
  const manager = await prisma.user.findUnique({ where: { id: managerId } });
  if (!manager || manager.role !== "SALES_MANAGER") {
    throw new Error("仅销售管理账号可配置小队");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: managerId },
      data: {
        salesTeamName: data.salesTeamName?.trim() || null,
        canViewCustomerContact: data.canViewCustomerContact ?? undefined,
      },
    });

    if (data.managedSalesIds !== undefined) {
      const ids = [...new Set(data.managedSalesIds)];
      if (ids.length > 0) {
        const salesRows = await tx.user.findMany({
          where: { id: { in: ids }, role: "SALES" },
          select: { id: true },
        });
        if (salesRows.length !== ids.length) {
          throw new Error("管辖名单只能包含销售账号");
        }
      }

      await tx.user.updateMany({
        where: { salesManagerId: managerId, role: "SALES" },
        data: { salesManagerId: null },
      });

      for (const salesId of ids) {
        const other = await tx.user.findFirst({
          where: {
            id: salesId,
            role: "SALES",
            salesManagerId: { not: null },
            NOT: { salesManagerId: managerId },
          },
        });
        if (other) {
          throw new Error("每名销售只能归属一个小队");
        }
        await tx.user.update({
          where: { id: salesId },
          data: { salesManagerId: managerId },
        });
      }
    }
  });
}
