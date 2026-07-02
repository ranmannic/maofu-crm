import { prisma } from "@/lib/prisma";
import { getEditionState, isPremiumEdition } from "@/lib/edition";
import { roundStockQty } from "@/lib/utils";
import type {
  Prisma,
  StockBasisLineType,
  StockMovementReason,
  StockPoolType,
  WineSkuType,
} from "@/generated/prisma/client";

export const STOCK_MOVEMENT_LABELS: Record<StockMovementReason, string> = {
  PURCHASE_IN: "采购入库",
  SHIP_OUT: "订单发货出库",
  SHIP_CANCEL_IN: "取消发货回库",
  ORDER_DELETE_IN: "删除订单回库",
  BAD_DEBT_RECOVER_IN: "坏账收回回库",
  MANUAL_WRITE_OFF: "手工销库",
  MANUAL_ADJUST: "库存盘点调整",
};

export const WINE_SKU_LABELS: Record<WineSkuType, string> = {
  BOTTLE: "瓶",
  LITER: "升",
};

function formatWineQty(qty: number, skuType: WineSkuType) {
  if (skuType === "LITER") return roundStockQty(qty).toString();
  return String(Math.round(qty));
}

type Tx = Prisma.TransactionClient;

export type StockBasisLine = {
  lineType: StockBasisLineType;
  materialId: string | null;
  wineProductId: string | null;
  wineSkuType: WineSkuType | null;
  quantity: number;
};

export async function isInventoryLinkageEnabled() {
  const edition = await getEditionState();
  return isPremiumEdition(edition);
}

export async function ensureWineStock(
  productId: string,
  skuType: WineSkuType,
  tx?: Tx
) {
  const client = tx ?? prisma;
  const existing = await client.wineStock.findUnique({
    where: { productId_skuType: { productId, skuType } },
  });
  if (existing) return existing;
  return client.wineStock.create({
    data: { productId, skuType, stockQty: 0, lowStockThreshold: 0 },
  });
}

export async function getSpecStockBasisLines(
  productSpecId: string,
  tx?: Tx
): Promise<StockBasisLine[]> {
  const client = tx ?? prisma;
  const lines = await client.productSpecStockBasisLine.findMany({
    where: { productSpecId },
    orderBy: { sortOrder: "asc" },
  });
  if (lines.length > 0) {
    return lines.map((l) => ({
      lineType: l.lineType,
      materialId: l.materialId,
      wineProductId: l.wineProductId,
      wineSkuType: l.wineSkuType,
      quantity: l.quantity,
    }));
  }

  return [];
}

async function wineStockQty(
  productId: string,
  skuType: WineSkuType,
  tx?: Tx
) {
  const stock = await ensureWineStock(productId, skuType, tx);
  return stock.stockQty;
}

async function materialQty(materialId: string, tx?: Tx) {
  const client = tx ?? prisma;
  const m = await client.material.findUnique({ where: { id: materialId } });
  return m?.stockQty ?? 0;
}

export async function calcSpecMaxSellable(
  productSpecId: string,
  tx?: Tx
): Promise<number> {
  const lines = await getSpecStockBasisLines(productSpecId, tx);
  if (lines.length === 0) return 0;

  let maxSellable = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    if (line.lineType === "WINE") {
      const pid = line.wineProductId;
      const sku = line.wineSkuType ?? "BOTTLE";
      if (!pid) {
        maxSellable = 0;
        continue;
      }
      const qty = await wineStockQty(pid, sku, tx);
      maxSellable = Math.min(maxSellable, Math.floor(qty / line.quantity));
    } else {
      if (!line.materialId) {
        maxSellable = 0;
        continue;
      }
      const qty = await materialQty(line.materialId, tx);
      maxSellable = Math.min(maxSellable, Math.floor(qty / line.quantity));
    }
  }

  return Number.isFinite(maxSellable) ? Math.max(0, maxSellable) : 0;
}

export async function calcSpecMaxSellableBatch(specIds: string[]) {
  const result = new Map<string, number>();
  for (const id of specIds) {
    result.set(id, await calcSpecMaxSellable(id));
  }
  return result;
}

interface MovementInput {
  poolType: StockPoolType;
  productId?: string | null;
  materialId?: string | null;
  wineSkuType?: WineSkuType | null;
  productSpecId?: string | null;
  delta: number;
  reason: StockMovementReason;
  notes?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
  userId?: string | null;
  userName?: string | null;
  allowNegative?: boolean;
}

export async function applyPoolMovement(input: MovementInput, tx?: Tx) {
  if (input.delta === 0) throw new Error("库存变动数量不能为 0");

  const run = async (client: Tx) => {
    let stockAfter = 0;

    if (input.poolType === "WINE") {
      if (!input.productId) throw new Error("缺少产品 ID");
      const skuType = input.wineSkuType ?? "BOTTLE";
      const stock = await ensureWineStock(input.productId, skuType, client);
      const product = await client.product.findUnique({
        where: { id: input.productId },
        select: { name: true },
      });
      const unit = WINE_SKU_LABELS[skuType];
      const next = roundStockQty(stock.stockQty + input.delta);
      if (next < 0 && !input.allowNegative) {
        throw new Error(
          `${product?.name ?? "产品"} 酒体库存不足（当前 ${formatWineQty(stock.stockQty, skuType)} ${unit}，需 ${formatWineQty(Math.abs(input.delta), skuType)} ${unit}）`
        );
      }
      await client.wineStock.update({
        where: { id: stock.id },
        data: { stockQty: next },
      });
      stockAfter = next;
    } else {
      if (!input.materialId) throw new Error("缺少物料 ID");
      const material = await client.material.findUnique({
        where: { id: input.materialId },
      });
      if (!material) throw new Error("物料不存在");
      const next = material.stockQty + input.delta;
      if (next < 0 && !input.allowNegative) {
        throw new Error(
          `物料「${material.name}」库存不足（当前 ${material.stockQty}，需 ${Math.abs(input.delta)}）`
        );
      }
      await client.material.update({
        where: { id: input.materialId },
        data: { stockQty: next },
      });
      stockAfter = next;
    }

    await client.stockMovement.create({
      data: {
        poolType: input.poolType,
        productId: input.productId ?? null,
        materialId: input.materialId ?? null,
        wineSkuType: input.poolType === "WINE" ? (input.wineSkuType ?? "BOTTLE") : null,
        productSpecId: input.productSpecId ?? null,
        delta: input.delta,
        stockAfter,
        reason: input.reason,
        notes: input.notes ?? null,
        orderId: input.orderId ?? null,
        orderItemId: input.orderItemId ?? null,
        userId: input.userId ?? null,
        userName: input.userName ?? null,
      },
    });

    return { stockAfter };
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

async function applyBasisDelta(
  lines: StockBasisLine[],
  specQty: number,
  sign: 1 | -1,
  meta: Omit<
    MovementInput,
    "poolType" | "productId" | "materialId" | "wineSkuType" | "delta"
  >,
  tx: Tx
) {
  for (const line of lines) {
    const delta = roundStockQty(sign * line.quantity * specQty);
    if (delta === 0) continue;
    if (line.lineType === "WINE") {
      if (!line.wineProductId) continue;
      await applyPoolMovement(
        {
          ...meta,
          poolType: "WINE",
          productId: line.wineProductId,
          materialId: null,
          wineSkuType: line.wineSkuType ?? "BOTTLE",
          delta,
        },
        tx
      );
    } else if (line.materialId) {
      await applyPoolMovement(
        {
          ...meta,
          poolType: "MATERIAL",
          productId: null,
          materialId: line.materialId,
          wineSkuType: null,
          delta,
        },
        tx
      );
    }
  }
}

export async function deductOrderStock(
  orderId: string,
  user?: { id: string; name: string },
  tx?: Tx
) {
  if (!(await isInventoryLinkageEnabled())) return;

  const run = async (client: Tx) => {
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || !order.isShipped || order.stockDeducted) return;

    for (const item of order.items) {
      if (item.isGift) continue;
      const lines = await getSpecStockBasisLines(item.productSpecId, client);
      await applyBasisDelta(
        lines,
        item.quantity,
        -1,
        {
          reason: "SHIP_OUT",
          orderId: order.id,
          orderItemId: item.id,
          productSpecId: item.productSpecId,
          userId: user?.id ?? null,
          userName: user?.name ?? null,
          notes: `订单 ${order.orderNo} 发货出库`,
        },
        client
      );
    }

    await client.order.update({
      where: { id: orderId },
      data: { stockDeducted: true },
    });
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

export async function restoreOrderStock(
  orderId: string,
  reason: "SHIP_CANCEL_IN" | "ORDER_DELETE_IN",
  user?: { id: string; name: string },
  tx?: Tx
) {
  if (!(await isInventoryLinkageEnabled())) return;

  const run = async (client: Tx) => {
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || !order.stockDeducted) return;

    const note =
      reason === "ORDER_DELETE_IN"
        ? `订单 ${order.orderNo} 删除回库`
        : `订单 ${order.orderNo} 取消发货回库`;

    for (const item of order.items) {
      if (item.isGift) continue;
      const lines = await getSpecStockBasisLines(item.productSpecId, client);
      await applyBasisDelta(
        lines,
        item.quantity,
        1,
        {
          reason,
          orderId: order.id,
          orderItemId: item.id,
          productSpecId: item.productSpecId,
          userId: user?.id ?? null,
          userName: user?.name ?? null,
          notes: note,
        },
        client
      );
    }

    await client.order.update({
      where: { id: orderId },
      data: { stockDeducted: false },
    });
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

export async function recoverBadDebtStock(
  orderId: string,
  items: { orderItemId: string; productSpecId: string; recoveredQty: number }[],
  user: { id: string; name: string }
) {
  if (!(await isInventoryLinkageEnabled())) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNo: true },
  });
  if (!order) return;

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      if (item.recoveredQty <= 0) continue;
      const lines = await getSpecStockBasisLines(item.productSpecId, tx);
      await applyBasisDelta(
        lines,
        item.recoveredQty,
        1,
        {
          reason: "BAD_DEBT_RECOVER_IN",
          orderId,
          orderItemId: item.orderItemId,
          productSpecId: item.productSpecId,
          userId: user.id,
          userName: user.name,
          notes: `订单 ${order.orderNo} 坏账收回回库`,
        },
        tx
      );
    }
  });
}

export async function replaceSpecStockBasis(
  productSpecId: string,
  lines: StockBasisLine[]
) {
  if (lines.length === 0) {
    throw new Error("请至少配置一条库存依据");
  }

  for (const line of lines) {
    if (line.lineType === "WINE" && line.wineSkuType === "LITER") {
      if (line.quantity <= 0) throw new Error("散酒库存依据数量须大于 0");
    } else if (line.quantity <= 0 || !Number.isInteger(line.quantity)) {
      throw new Error("库存依据数量须为大于等于 1 的整数");
    }
    if (line.lineType === "WINE") {
      if (!line.wineProductId) throw new Error("酒体依据须指定产品");
      if (!line.wineSkuType) throw new Error("酒体依据须指定 SKU（瓶/升）");
    }
    if (line.lineType === "MATERIAL" && !line.materialId) {
      throw new Error("物料依据须选择物料");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.productSpecStockBasisLine.deleteMany({ where: { productSpecId } });
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      await tx.productSpecStockBasisLine.create({
        data: {
          productSpecId,
          lineType: line.lineType,
          materialId: line.materialId,
          wineProductId: line.wineProductId,
          wineSkuType: line.lineType === "WINE" ? line.wineSkuType : null,
          quantity: roundStockQty(line.quantity),
          sortOrder: index,
        },
      });
    }
  });
}

export async function getLowStockAlerts() {
  const [wines, materials] = await Promise.all([
    prisma.wineStock.findMany({
      include: { product: { select: { name: true } } },
    }),
    prisma.material.findMany(),
  ]);

  const wineAlerts = wines
    .filter((w) => w.lowStockThreshold > 0 && w.stockQty <= w.lowStockThreshold)
    .map((w) => ({
      type: "WINE" as const,
      id: w.id,
      name: `${w.product.name}（${WINE_SKU_LABELS[w.skuType]}）`,
      stockQty: w.stockQty,
      lowStockThreshold: w.lowStockThreshold,
      unitLabel: WINE_SKU_LABELS[w.skuType],
    }));

  const materialAlerts = materials
    .filter((m) => m.stockQty <= m.lowStockThreshold)
    .map((m) => ({
      type: "MATERIAL" as const,
      id: m.id,
      name: m.name,
      stockQty: m.stockQty,
      lowStockThreshold: m.lowStockThreshold,
      unitLabel: m.unit,
    }));

  return [...wineAlerts, ...materialAlerts];
}

export async function listSellableSpecs() {
  const specs = await prisma.productSpec.findMany({
    include: {
      product: { select: { id: true, name: true } },
      stockBasisLines: {
        include: { material: { select: { id: true, name: true, unit: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ product: { name: "asc" } }, { createdAt: "asc" }],
  });

  const sellableMap = await calcSpecMaxSellableBatch(specs.map((s) => s.id));

  return specs.map((s) => {
    const stockConfigured = s.stockBasisLines.length > 0;

    return {
      id: s.id,
      productId: s.productId,
      productName: s.product.name,
      specName: s.name,
      unitType: s.unitType,
      bottlesPerUnit: s.bottlesPerUnit,
      stockConfigured,
      maxSellable: stockConfigured ? (sellableMap.get(s.id) ?? 0) : null,
    };
  });
}
