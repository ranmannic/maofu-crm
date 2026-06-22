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

async function main() {
  const password = await bcrypt.hash("123456", 10);

  const channels = await Promise.all(
    ["线下经销", "电商", "会所", "团购", "其他"].map((name, i) =>
      prisma.channelType.upsert({
        where: { name },
        update: {},
        create: { name, sortOrder: i },
      })
    )
  );
  const channelMap = Object.fromEntries(channels.map((c) => [c.name, c.id]));

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
          { name: "750ml 单瓶", unitType: "BOTTLE", price: 298, cost: 120 },
          { name: "750ml 礼盒装", unitType: "SET", price: 688, cost: 280 },
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
          { name: "500ml", unitType: "BOTTLE", price: 168, cost: 65 },
          { name: "整箱6瓶", unitType: "BOX", price: 898, cost: 360 },
        ],
      },
    },
    include: { specs: true },
  });

  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: "seed-customer-1" },
      update: {},
      create: {
        id: "seed-customer-1",
        name: "北京华盛商贸",
        phone: "13800138001",
        channelId: channelMap["线下经销"],
        address: "北京市朝阳区",
        salesId: sales1.id,
      },
    }),
    prisma.customer.upsert({
      where: { id: "seed-customer-2" },
      update: {},
      create: {
        id: "seed-customer-2",
        name: "上海品酒汇",
        phone: "13900139002",
        channelId: channelMap["电商"],
        address: "上海市浦东新区",
        salesId: sales1.id,
      },
    }),
    prisma.customer.upsert({
      where: { id: "seed-customer-3" },
      update: {},
      create: {
        id: "seed-customer-3",
        name: "广州酒文化会所",
        phone: "13700137003",
        channelId: channelMap["会所"],
        address: "广州市天河区",
        salesId: sales2.id,
      },
    }),
  ]);

  const spec1 = product1.specs[0];
  const spec2 = product2.specs[0];
  const calc1 = spec1.price * 10;
  const cost1 = spec1.cost * 10;

  await prisma.order.upsert({
    where: { orderNo: "MF202506220001" },
    update: {},
    create: {
      orderNo: "MF202506220001",
      customerId: customers[0].id,
      customerName: customers[0].name,
      salesId: sales1.id,
      handlerId: ops.id,
      calculatedAmount: calc1,
      totalAmount: calc1,
      productCostTotal: cost1,
      isPaid: true,
      paidAmount: calc1,
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

  const calc2 = spec2.price * 5 + product1.specs[1].price * 2;
  const cost2 = spec2.cost * 5 + product1.specs[1].cost * 2;

  await prisma.order.upsert({
    where: { orderNo: "MF202506220002" },
    update: {},
    create: {
      orderNo: "MF202506220002",
      customerId: customers[1].id,
      customerName: customers[1].name,
      salesId: sales1.id,
      calculatedAmount: calc2,
      totalAmount: calc2,
      productCostTotal: cost2,
      isPaid: false,
      paidAmount: 0,
      isShipped: false,
      orderedAt: new Date(),
      notes: "待收款",
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

  console.log("Seed completed:");
  console.log("  Admin: admin / 123456");
  console.log("  Sales: sales01, sales02 / 123456");
  console.log("  Ops: ops01 / 123456");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
