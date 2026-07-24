import { prisma } from "@/lib/prisma";
import { summarizePeriodPerformance } from "@/lib/stats-performance";

export type TeamPerformanceRow = {
  managerId: string | null;
  teamName: string;
  managerName: string | null;
  memberCount: number;
  orderCount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
};

type PeriodOrder = {
  id: string;
  salesId: string;
  productAmount: number;
  performanceRecords: { amount: number }[];
};

export async function buildTeamPerformanceStats(
  periodOrders: PeriodOrder[]
): Promise<{ teams: TeamPerformanceRow[]; myTeam: TeamPerformanceRow | null }> {
  const managers = await prisma.user.findMany({
    where: { role: "SALES_MANAGER" },
    select: {
      id: true,
      name: true,
      salesTeamName: true,
      managedSales: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const teams: TeamPerformanceRow[] = managers.map((m) => {
    const memberIds = new Set(m.managedSales.map((s) => s.id));
    const orders = periodOrders.filter((o) => memberIds.has(o.salesId));
    const perf = summarizePeriodPerformance(orders);
    return {
      managerId: m.id,
      teamName: m.salesTeamName?.trim() || `${m.name}小队`,
      managerName: m.name,
      memberCount: m.managedSales.length,
      orderCount: orders.length,
      totalAmount: perf.total,
      paidAmount: perf.collected,
      unpaidAmount: perf.uncollected,
    };
  });

  const assignedSalesIds = new Set(
    managers.flatMap((m) => m.managedSales.map((s) => s.id))
  );
  const unassignedOrders = periodOrders.filter(
    (o) => !assignedSalesIds.has(o.salesId)
  );
  if (unassignedOrders.length > 0) {
    const perf = summarizePeriodPerformance(unassignedOrders);
    teams.push({
      managerId: null,
      teamName: "未编小队",
      managerName: null,
      memberCount: 0,
      orderCount: unassignedOrders.length,
      totalAmount: perf.total,
      paidAmount: perf.collected,
      unpaidAmount: perf.uncollected,
    });
  }

  return { teams, myTeam: null };
}

export function pickMyTeam(
  teams: TeamPerformanceRow[],
  managerId: string
): TeamPerformanceRow | null {
  return teams.find((t) => t.managerId === managerId) ?? null;
}
