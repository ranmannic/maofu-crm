import { prisma } from "../src/lib/prisma";

/** 将已有收款订单的客户同步为成交客户 */
async function main() {
  const paidCustomerIds = await prisma.order.findMany({
    where: {
      deletedAt: null,
      paymentStatus: { in: ["PAID", "PARTIAL"] },
      paidAmount: { gt: 0 },
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });

  const ids = paidCustomerIds.map((r) => r.customerId);
  if (ids.length === 0) {
    console.log("无需同步：没有已收款订单");
    return;
  }

  const result = await prisma.customer.updateMany({
    where: { id: { in: ids }, customerStatus: "LEAD" },
    data: { customerStatus: "CLOSED" },
  });

  console.log(`已同步 ${result.count} 位客户为成交客户`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
