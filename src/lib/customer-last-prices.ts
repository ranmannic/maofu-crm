import { prisma } from "@/lib/prisma";

/** 客户各规格最近一次非赠品拿货单价 */
export async function getCustomerLastPrices(
  customerId: string
): Promise<Record<string, number>> {
  const rows = await prisma.orderItem.findMany({
    where: {
      isGift: false,
      order: { customerId, deletedAt: null },
    },
    select: {
      productSpecId: true,
      unitPrice: true,
      order: { select: { orderedAt: true } },
    },
    orderBy: { order: { orderedAt: "desc" } },
  });

  const map: Record<string, number> = {};
  for (const row of rows) {
    if (map[row.productSpecId] === undefined) {
      map[row.productSpecId] = row.unitPrice;
    }
  }
  return map;
}
