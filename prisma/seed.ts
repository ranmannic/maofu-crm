import "dotenv/config";
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

function resolveDbPath() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  return path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
}

const adapter = new PrismaBetterSqlite3({ url: resolveDbPath() });
const prisma = new PrismaClient({ adapter });

const CHANNEL_TREE: { category: string; children: string[] }[] = [
  { category: "团购业务", children: ["团购客户", "高端烟酒店"] },
  {
    category: "批发业务",
    children: ["烟酒杂货店", "超市便利店", "礼品店", "村商店"],
  },
  { category: "直销业务", children: ["线上直销", "线下直销"] },
  { category: "分销业务", children: ["线上分销", "红白事渠道", "外部销售"] },
  { category: "特渠业务", children: ["内部渠道"] },
];

async function seedChannels() {
  const channelMap: Record<string, string> = {};
  const validNames = new Set<string>();

  for (let i = 0; i < CHANNEL_TREE.length; i++) {
    const { category, children } = CHANNEL_TREE[i];
    validNames.add(category);
    children.forEach((name) => validNames.add(name));

    const parent = await prisma.channelType.upsert({
      where: { name: category },
      update: { sortOrder: i, parentId: null },
      create: { name: category, sortOrder: i, parentId: null },
    });
    channelMap[category] = parent.id;

    for (let j = 0; j < children.length; j++) {
      const childName = children[j];
      const child = await prisma.channelType.upsert({
        where: { name: childName },
        update: { sortOrder: j, parentId: parent.id },
        create: {
          name: childName,
          sortOrder: j,
          parentId: parent.id,
        },
      });
      channelMap[childName] = child.id;
    }
  }

  // 将仍挂在旧渠道上的客户迁移到新二级渠道
  const defaultChildId = channelMap["团购客户"];
  const staleWithCustomers = await prisma.channelType.findMany({
    where: {
      name: { notIn: [...validNames] },
    },
    select: { id: true },
  });
  if (staleWithCustomers.length > 0) {
    await prisma.customer.updateMany({
      where: { channelId: { in: staleWithCustomers.map((c) => c.id) } },
      data: { channelId: defaultChildId },
    });
  }

  // 清理旧版一级渠道（无 parentId 且不在新分类体系中）
  const stale = await prisma.channelType.findMany({
    where: {
      parentId: null,
      name: { notIn: [...validNames] },
    },
    include: { _count: { select: { customers: true, children: true } } },
  });

  for (const ch of stale) {
    if (ch._count.customers > 0 || ch._count.children > 0) continue;
    await prisma.channelType.delete({ where: { id: ch.id } });
  }

  // 清理其它不在新体系中的孤立二级/旧渠道
  await prisma.channelType.deleteMany({
    where: {
      name: { notIn: [...validNames] },
      customers: { none: {} },
      children: { none: {} },
    },
  });

  return channelMap;
}

async function main() {
  const password = await bcrypt.hash("123456", 10);
  const channelMap = await seedChannels();

  const sales1 = await prisma.user.upsert({
    where: { username: "sales01" },
    update: {},
    create: {
      username: "sales01",
      password,
      name: "张销售",
      role: "SALES",
    },
  });

  const sales2 = await prisma.user.upsert({
    where: { username: "sales02" },
    update: {},
    create: {
      username: "sales02",
      password,
      name: "李销售",
      role: "SALES",
    },
  });

  const ops = await prisma.user.upsert({
    where: { username: "ops01" },
    update: {},
    create: {
      username: "ops01",
      password,
      name: "王职能",
      role: "OPERATIONS",
    },
  });

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password,
      name: "系统管理员",
      role: "ADMIN",
    },
  });

  const product1 = await prisma.product.upsert({
    where: { id: "seed-product-1" },
    update: {},
    create: {
      id: "seed-product-1",
      name: "毛府珍藏红酒",
      description: "毛府酒庄经典珍藏系列",
      specs: {
        create: [
          { name: "750ml 单瓶", unitType: "BOTTLE", bottlesPerUnit: 1, price: 298, cost: 120 },
          { name: "750ml 礼盒装", unitType: "SET", bottlesPerUnit: 1, price: 688, cost: 280 },
        ],
      },
    },
    include: { specs: true },
  });

  const product2 = await prisma.product.upsert({
    where: { id: "seed-product-2" },
    update: {},
    create: {
      id: "seed-product-2",
      name: "毛府窖藏白酒",
      description: "传统工艺窖藏",
      specs: {
        create: [
          { name: "500ml", unitType: "BOTTLE", bottlesPerUnit: 1, price: 168, cost: 65 },
          { name: "整箱6瓶", unitType: "BOX", bottlesPerUnit: 6, price: 898, cost: 360 },
        ],
      },
    },
    include: { specs: true },
  });

  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: "seed-customer-1" },
      update: {
        channelId: channelMap["团购客户"],
        deletedAt: null,
      },
      create: {
        id: "seed-customer-1",
        name: "北京华盛商贸",
        phone: "13800138001",
        channelId: channelMap["团购客户"],
        address: "北京市朝阳区",
        salesId: sales1.id,
      },
    }),
    prisma.customer.upsert({
      where: { id: "seed-customer-2" },
      update: {
        channelId: channelMap["线上直销"],
        deletedAt: null,
      },
      create: {
        id: "seed-customer-2",
        name: "上海品酒汇",
        phone: "13900139002",
        channelId: channelMap["线上直销"],
        address: "上海市浦东新区",
        salesId: sales1.id,
      },
    }),
    prisma.customer.upsert({
      where: { id: "seed-customer-3" },
      update: {
        channelId: channelMap["高端烟酒店"],
        deletedAt: null,
      },
      create: {
        id: "seed-customer-3",
        name: "广州酒文化会所",
        phone: "13700137003",
        channelId: channelMap["高端烟酒店"],
        address: "广州市天河区",
        salesId: sales2.id,
      },
    }),
  ]);

  const spec1 = product1.specs[0];
  const spec2 = product2.specs[0];
  const productAmount1 = spec1.price * 10;
  const cost1 = spec1.cost * 10;
  const shippingFee1 = 120;
  const otherFee1 = 0;
  const calculated1 = productAmount1 + shippingFee1 + otherFee1;

  await prisma.order.upsert({
    where: { orderNo: "MF202506220001" },
    update: {
      productAmount: productAmount1,
      shippingFee: shippingFee1,
      otherFee: otherFee1,
      calculatedAmount: calculated1,
      totalAmount: calculated1,
      productCostTotal: cost1,
      paymentStatus: "PAID",
      isPaid: true,
      paidAmount: calculated1,
    },
    create: {
      orderNo: "MF202506220001",
      customerId: customers[0].id,
      customerName: customers[0].name,
      salesId: sales1.id,
      handlerId: ops.id,
      productAmount: productAmount1,
      shippingFee: shippingFee1,
      otherFee: otherFee1,
      calculatedAmount: calculated1,
      totalAmount: calculated1,
      productCostTotal: cost1,
      paymentStatus: "PAID",
      isPaid: true,
      paidAmount: calculated1,
      isShipped: true,
      orderedAt: new Date(),
      paidAt: new Date(),
      notes: "首批试订单",
      items: {
        create: [
          {
            productId: product1.id,
            productSpecId: spec1.id,
            productName: product1.name,
            specName: spec1.name,
            unitType: spec1.unitType,
            quantity: 10,
            unitPrice: spec1.price,
            unitCost: spec1.cost,
          },
        ],
      },
      shipping: {
        create: {
          carrier: "顺丰速运",
          trackingNo: "SF1234567890",
          address: customers[0].address,
          shippedAt: new Date(),
        },
      },
    },
  });

  const productAmount2 = spec2.price * 5 + product1.specs[1].price * 2;
  const cost2 = spec2.cost * 5 + product1.specs[1].cost * 2;
  const shippingFee2 = 80;
  const otherFee2 = 50;
  const calculated2 = productAmount2 + shippingFee2 + otherFee2;

  await prisma.order.upsert({
    where: { orderNo: "MF202506220002" },
    update: {
      productAmount: productAmount2,
      shippingFee: shippingFee2,
      otherFee: otherFee2,
      calculatedAmount: calculated2,
      totalAmount: calculated2,
      productCostTotal: cost2,
      paymentStatus: "PARTIAL",
      isPaid: false,
      paidAmount: 1000,
    },
    create: {
      orderNo: "MF202506220002",
      customerId: customers[1].id,
      customerName: customers[1].name,
      salesId: sales1.id,
      productAmount: productAmount2,
      shippingFee: shippingFee2,
      otherFee: otherFee2,
      calculatedAmount: calculated2,
      totalAmount: calculated2,
      productCostTotal: cost2,
      paymentStatus: "PARTIAL",
      isPaid: false,
      paidAmount: 1000,
      isShipped: false,
      orderedAt: new Date(),
      paidAt: new Date(),
      notes: "部分收款",
      items: {
        create: [
          {
            productId: product2.id,
            productSpecId: spec2.id,
            productName: product2.name,
            specName: spec2.name,
            unitType: spec2.unitType,
            quantity: 5,
            unitPrice: spec2.price,
            unitCost: spec2.cost,
          },
          {
            productId: product1.id,
            productSpecId: product1.specs[1].id,
            productName: product1.name,
            specName: product1.specs[1].name,
            unitType: product1.specs[1].unitType,
            quantity: 2,
            unitPrice: product1.specs[1].price,
            unitCost: product1.specs[1].cost,
          },
        ],
      },
    },
  });

  // 未付款已发货 — 账期核销演示
  const productAmount3 = spec1.price * 6;
  const cost3 = spec1.cost * 6;
  const shippingFee3 = 60;
  const calculated3 = productAmount3 + shippingFee3;

  await prisma.order.upsert({
    where: { orderNo: "MF202506220003" },
    update: {
      paymentStatus: "UNPAID",
      isPaid: false,
      paidAmount: 0,
      isShipped: true,
    },
    create: {
      orderNo: "MF202506220003",
      customerId: customers[2].id,
      customerName: customers[2].name,
      salesId: sales2.id,
      handlerId: ops.id,
      productAmount: productAmount3,
      shippingFee: shippingFee3,
      otherFee: 0,
      calculatedAmount: calculated3,
      totalAmount: calculated3,
      productCostTotal: cost3,
      paymentStatus: "UNPAID",
      isPaid: false,
      paidAmount: 0,
      isShipped: true,
      orderedAt: new Date(),
      notes: "未付款已发货（账期）",
      items: {
        create: [
          {
            productId: product1.id,
            productSpecId: spec1.id,
            productName: product1.name,
            specName: spec1.name,
            unitType: spec1.unitType,
            quantity: 6,
            unitPrice: spec1.price,
            unitCost: spec1.cost,
          },
        ],
      },
      shipping: {
        create: {
          carrier: "德邦快递",
          trackingNo: "DP9876543210",
          address: customers[2].address,
          shippedAt: new Date(),
        },
      },
    },
  });

  console.log("Seed completed:");
  console.log(`  Channels: ${Object.keys(channelMap).length} (5 categories + 12 sub-channels)`);
  console.log(`  Customers: ${customers.length} demo records`);
  console.log("  Credit demo orders:");
  console.log("    MF202506220002 — 部分付款（账期核销）");
  console.log("    MF202506220003 — 未付款已发货（账期核销）");
  console.log("  Admin: admin / 123456");
  console.log("  Sales: sales01, sales02 / 123456");
  console.log("  Ops: ops01 / 123456");

  const { syncEligibleCreditOrders } = await import("../src/lib/credit");
  await prisma.productSpec.updateMany({
    where: { name: "整箱6瓶" },
    data: { bottlesPerUnit: 6 },
  });
  await syncEligibleCreditOrders();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
