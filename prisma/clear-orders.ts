/**
 * 清空全部订单及关联数据，保留：账号、客户、产品、渠道。
 * 生产环境执行前必须先备份数据库。
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const before = await prisma.order.count();
  console.log(`当前订单数：${before}`);

  await prisma.$transaction(async (tx) => {
    // 账期客户库存与订单无 FK，需单独清理
    await tx.customerInventory.deleteMany();
    // 子表随 Order 级联删除；先删业绩记录避免孤立数据
    await tx.performanceRecord.deleteMany();
    await tx.order.deleteMany();
  });

  const after = await prisma.order.count();
  const kept = {
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    products: await prisma.product.count(),
    channels: await prisma.channelType.count(),
  };

  console.log(`已清空订单，剩余订单数：${after}`);
  console.log("保留数据：", kept);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
