/**
 * 为「毛府一队」各销售、各客户生成历史订单（2024 年至今，≥200 条）
 *
 * ⚠️ 仅限本地开发 / 演示库。禁止在生产环境或 prod.db 上执行。
 *
 * 用法：npx tsx prisma/seed-maofu-team1-orders.ts
 */
import "dotenv/config";
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, type SpecUnit } from "../src/generated/prisma/client";

function resolveDbPath() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  return path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
}

function assertDevDatabaseOnly() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = resolveDbPath();
  if (
    process.env.NODE_ENV === "production" ||
    /prod\.db/i.test(dbUrl) ||
    /prod\.db/i.test(dbPath) ||
    dbPath.includes("/data/prod.db") ||
    dbPath.includes("\\data\\prod.db")
  ) {
    throw new Error(
      "拒绝执行：本脚本仅用于本地开发库，禁止对生产库（prod.db / NODE_ENV=production）写入演示订单"
    );
  }
}

const adapter = new PrismaBetterSqlite3({ url: resolveDbPath() });
const prisma = new PrismaClient({ adapter });

const TEAM_NAME = "毛府一队";
const TARGET_ORDERS = 220;
const ORDER_NO_PREFIX = "MF1T";

const CUSTOMER_POOL = [
  "韶关和泰烟酒店",
  "曲江金源礼品行",
  "乐昌红星超市",
  "始兴福满家便利",
  "仁化山水酒庄专营",
  "翁源喜宴礼品店",
  "新丰村头烟酒行",
  "乳源瑶寨特产店",
  "浈江团购客户部",
  "武江商务会所",
  "北江人家餐饮",
  "南雄老街酒坊",
  "丹霞客栈采购部",
  "毛府内部渠道店",
  "清远清城烟酒店",
  "英德茶叶伴手礼店",
  "连州乡土礼品行",
  "阳山农贸烟酒",
  "佛冈周末礼盒店",
  "从化温泉度假村",
  "广州番禺会所",
  "东莞厚街团购",
  "佛山禅城烟酒城",
  "中山古镇礼品汇",
];

const CHANNEL_CHILD_NAMES = [
  "团购客户",
  "高端烟酒店",
  "烟酒杂货店",
  "超市便利店",
  "礼品店",
  "村商店",
  "线下直销",
  "红白事渠道",
  "内部渠道",
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function pad(n: number, len = 4) {
  return String(n).padStart(len, "0");
}

type SpecRow = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  unitType: SpecUnit;
  price: number;
  cost: number;
};

async function main() {
  assertDevDatabaseOnly();

  const manager = await prisma.user.findFirst({
    where: { role: "SALES_MANAGER", salesTeamName: TEAM_NAME },
    include: {
      managedSales: {
        where: { role: "SALES" },
        select: { id: true, name: true, username: true },
      },
    },
  });

  if (!manager || manager.managedSales.length === 0) {
    throw new Error(`未找到小队「${TEAM_NAME}」或其销售成员，请先在用户管理中配置`);
  }

  console.log(
    `小队：${manager.salesTeamName} / 负责人 ${manager.name} / 销售 ${manager.managedSales.map((s) => s.name).join("、")}`
  );

  const ops = await prisma.user.findFirst({ where: { role: "OPERATIONS" } });
  const channels = await prisma.channelType.findMany({
    where: { name: { in: CHANNEL_CHILD_NAMES }, parentId: { not: null } },
    select: { id: true, name: true },
  });
  if (channels.length === 0) {
    throw new Error("未找到可用二级渠道，请先执行渠道初始化");
  }

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { specs: { where: { deletedAt: null } } },
  });
  const specs: SpecRow[] = products.flatMap((p) =>
    p.specs.map((s) => ({
      id: s.id,
      productId: p.id,
      productName: p.name,
      name: s.name,
      unitType: s.unitType,
      price: s.price,
      cost: s.cost,
    }))
  );
  if (specs.length === 0) {
    throw new Error("没有可用产品规格，无法生成订单");
  }

  // 清理本脚本历史生成的订单（可重复执行）
  const old = await prisma.order.findMany({
    where: { orderNo: { startsWith: ORDER_NO_PREFIX } },
    select: { id: true },
  });
  if (old.length > 0) {
    const ids = old.map((o) => o.id);
    await prisma.performanceRecord.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.shippingInfo.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    console.log(`已清理历史生成订单 ${old.length} 条`);
  }

  // 为每位销售补足客户（每人至少 8 个）
  const customersBySales = new Map<string, { id: string; name: string }[]>();
  let customerNameIdx = 0;

  for (const sales of manager.managedSales) {
    let list = await prisma.customer.findMany({
      where: { salesId: sales.id, deletedAt: null },
      select: { id: true, name: true },
    });

    while (list.length < 8) {
      const baseName = CUSTOMER_POOL[customerNameIdx % CUSTOMER_POOL.length]!;
      customerNameIdx += 1;
      const name = `${baseName}·${sales.name.slice(0, 1)}${list.length + 1}`;
      const phone = `139${String(randInt(10000000, 99999999))}`;
      const created = await prisma.customer.create({
        data: {
          name,
          phone,
          channelId: pick(channels).id,
          address: "广东省韶关市",
          salesId: sales.id,
          customerStatus: "LEAD",
          followUpStatus: "ACTIVE",
        },
        select: { id: true, name: true },
      });
      list.push(created);
    }

    customersBySales.set(sales.id, list);
    console.log(`销售 ${sales.name} 客户数：${list.length}`);
  }

  const start = new Date("2024-01-01T00:00:00");
  const end = new Date();
  let createdCount = 0;
  let seq = 1;

  // 先保证每位销售、每位客户至少有若干单
  for (const sales of manager.managedSales) {
    const customers = customersBySales.get(sales.id)!;
    for (const customer of customers) {
      const n = randInt(3, 6);
      for (let i = 0; i < n; i++) {
        await createOneOrder({
          salesId: sales.id,
          customer,
          specs,
          opsId: ops?.id ?? null,
          orderedAt: randomDate(start, end),
          seq: seq++,
        });
        createdCount += 1;
      }
    }
  }

  // 补足到目标数量，随机分配销售与客户
  while (createdCount < TARGET_ORDERS) {
    const sales = pick(manager.managedSales);
    const customer = pick(customersBySales.get(sales.id)!);
    await createOneOrder({
      salesId: sales.id,
      customer,
      specs,
      opsId: ops?.id ?? null,
      orderedAt: randomDate(start, end),
      seq: seq++,
    });
    createdCount += 1;
  }

  // 有收款的客户标记成交
  const paidCustomerIds = await prisma.order.findMany({
    where: {
      orderNo: { startsWith: ORDER_NO_PREFIX },
      paidAmount: { gt: 0 },
      paymentStatus: { in: ["PAID", "PARTIAL"] },
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });
  if (paidCustomerIds.length > 0) {
    await prisma.customer.updateMany({
      where: { id: { in: paidCustomerIds.map((c) => c.customerId) } },
      data: { customerStatus: "CLOSED" },
    });
  }

  const total = await prisma.order.count({
    where: { orderNo: { startsWith: ORDER_NO_PREFIX } },
  });
  const bySales = await prisma.order.groupBy({
    by: ["salesId"],
    where: { orderNo: { startsWith: ORDER_NO_PREFIX } },
    _count: true,
    _sum: { totalAmount: true, paidAmount: true },
  });

  console.log(`\n生成完成：${total} 条订单（目标 ≥ ${TARGET_ORDERS}）`);
  for (const row of bySales) {
    const sales = manager.managedSales.find((s) => s.id === row.salesId);
    console.log(
      `  - ${sales?.name ?? row.salesId}: ${row._count} 单，金额合计 ${round2(row._sum.totalAmount ?? 0)}，已收 ${round2(row._sum.paidAmount ?? 0)}`
    );
  }
}

async function createOneOrder(opts: {
  salesId: string;
  customer: { id: string; name: string };
  specs: SpecRow[];
  opsId: string | null;
  orderedAt: Date;
  seq: number;
}) {
  const itemCount = randInt(1, Math.min(3, opts.specs.length));
  const chosen: SpecRow[] = [];
  const pool = [...opts.specs];
  for (let i = 0; i < itemCount; i++) {
    const idx = randInt(0, pool.length - 1);
    chosen.push(pool.splice(idx, 1)[0]!);
  }

  const items = chosen.map((s) => {
    const quantity = randInt(1, 12);
    const isGift = Math.random() < 0.08;
    return {
      productId: s.productId,
      productSpecId: s.id,
      productName: s.productName,
      specName: s.name,
      unitType: s.unitType,
      quantity,
      unitPrice: isGift ? 0 : s.price,
      unitCost: s.cost,
      isGift,
    };
  });

  const productAmount = round2(
    items.reduce((sum, it) => sum + (it.isGift ? 0 : it.unitPrice * it.quantity), 0)
  );
  const productCostTotal = round2(
    items.reduce((sum, it) => sum + it.unitCost * it.quantity, 0)
  );
  const shippingFee = Math.random() < 0.55 ? round2(randInt(0, 18) * 10) : 0;
  const otherFee = Math.random() < 0.15 ? round2(randInt(1, 8) * 10) : 0;
  const calculatedAmount = round2(productAmount + shippingFee + otherFee);
  // 少量金额微调
  const adjust = Math.random() < 0.12 ? round2(randInt(-3, 5) * 10) : 0;
  const totalAmount = Math.max(0, round2(calculatedAmount + adjust));

  const roll = Math.random();
  let paymentStatus: "UNPAID" | "PARTIAL" | "PAID" = "PAID";
  let paidAmount = totalAmount;
  let isPaid = true;
  let paidAt: Date | null = opts.orderedAt;
  if (roll < 0.12) {
    paymentStatus = "UNPAID";
    paidAmount = 0;
    isPaid = false;
    paidAt = null;
  } else if (roll < 0.28) {
    paymentStatus = "PARTIAL";
    paidAmount = round2(totalAmount * (0.3 + Math.random() * 0.5));
    isPaid = false;
    paidAt = new Date(opts.orderedAt.getTime() + randInt(1, 20) * 86400000);
    if (paidAt > new Date()) paidAt = new Date();
  } else {
    paidAt = new Date(opts.orderedAt.getTime() + randInt(0, 15) * 86400000);
    if (paidAt > new Date()) paidAt = new Date();
  }

  const isShipped = Math.random() < 0.72;
  const y = opts.orderedAt.getFullYear();
  const m = pad(opts.orderedAt.getMonth() + 1, 2);
  const d = pad(opts.orderedAt.getDate(), 2);
  const orderNo = `${ORDER_NO_PREFIX}${y}${m}${d}${pad(opts.seq, 5)}`;

  // 产品业绩口径：按已收比例折算
  const collectPerf =
    totalAmount > 0
      ? round2(productAmount * Math.min(1, paidAmount / totalAmount))
      : 0;

  await prisma.order.create({
    data: {
      orderNo,
      customerId: opts.customer.id,
      customerName: opts.customer.name,
      salesId: opts.salesId,
      handlerId: isShipped ? opts.opsId : null,
      productAmount,
      shippingFee,
      otherFee,
      calculatedAmount,
      totalAmount,
      amountAdjustReason: adjust !== 0 ? "演示数据金额微调" : null,
      productCostTotal,
      paymentStatus,
      isPaid,
      paidAmount,
      isShipped,
      orderedAt: opts.orderedAt,
      paidAt,
      notes: Math.random() < 0.2 ? "批量演示订单" : null,
      stockDeducted: false,
      items: { create: items },
      shipping: isShipped
        ? {
            create: {
              method: pick(["EXPRESS", "LOGISTICS", "SELF_DELIVERY", "PICKUP"] as const),
              carrier: Math.random() < 0.5 ? "顺丰速运" : "德邦物流",
              trackingNo: `SF${randInt(1000000000, 1999999999)}`,
              address: "广东省韶关市",
              shippedAt: new Date(
                opts.orderedAt.getTime() + randInt(0, 7) * 86400000
              ),
            },
          }
        : undefined,
      performanceRecords:
        collectPerf > 0 && paidAt
          ? {
              create: [
                {
                  salesId: opts.salesId,
                  amount: collectPerf,
                  type: "COLLECT",
                  eventAt: paidAt,
                  detail: JSON.stringify({ source: "seed-maofu-team1" }),
                },
              ],
            }
          : undefined,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
