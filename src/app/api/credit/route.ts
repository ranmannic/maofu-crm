import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getCreditStats, syncEligibleCreditOrders } from "@/lib/credit";
import {
  syncPerformanceData,
  resolveReconciliationPerformanceAmount,
  parseReconcileItemsFromDetail,
} from "@/lib/performance";
import { toBottleCount, resolveBottlesPerUnit } from "@/lib/unit-convert";
import { SPEC_UNIT_LABELS } from "@/lib/constants";
import type { Prisma, SpecUnit } from "@/generated/prisma/client";

type CreditView = "active" | "settled";

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    customer: { select: { id: true; name: true; sales: { select: { id: true; name: true } } } };
    items: true;
    creditLines: true;
    reconciliationRecords: true;
  };
}>;

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(["ADMIN", "SALES", "OPERATIONS"]);
    const { searchParams } = new URL(request.url);
    const customerQ = searchParams.get("customer")?.trim();
    const orderNoQ = searchParams.get("orderNo")?.trim();
    const view = (searchParams.get("view") || "active") as CreditView;

    const salesScope =
      session.role === "SALES"
        ? session.id
        : searchParams.get("salesId") || undefined;

    if (view === "active") {
      await syncEligibleCreditOrders(salesScope);
      try {
        await syncPerformanceData(salesScope);
      } catch (error) {
        console.error("[credit] syncPerformanceData", error);
      }
    }

    const stats = view === "active" ? await getCreditStats(salesScope) : null;

    const orderWhere: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...(salesScope ? { salesId: salesScope } : {}),
    };

    if (view === "settled") {
      orderWhere.creditStatus = "SETTLED";
    } else {
      orderWhere.creditStatus = { in: ["ACTIVE", "BAD_DEBT"] };
    }

    if (orderNoQ) {
      orderWhere.orderNo = { contains: orderNoQ };
    }

    const [orders, specRows] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              sales: { select: { id: true, name: true } },
            },
          },
          items: true,
          creditLines: true,
          reconciliationRecords: {
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: view === "settled" ? { paidAt: "desc" } : { orderedAt: "desc" },
      }),
      prisma.productSpec.findMany({
        select: { id: true, name: true, unitType: true, bottlesPerUnit: true },
      }),
    ]);

    const specMap = new Map(specRows.map((s) => [s.id, s]));

    function bottlesPerUnit(specId: string, specName: string, unitType: SpecUnit) {
      const spec = specMap.get(specId);
      return resolveBottlesPerUnit(
        spec?.name ?? specName,
        spec?.unitType ?? unitType,
        spec?.bottlesPerUnit
      );
    }

    const customerIds = [...new Set(orders.map((o) => o.customerId))];
    const inventories =
      view === "active" && customerIds.length > 0
        ? await prisma.customerInventory.findMany({
            where: {
              customerId: { in: customerIds },
              ...(salesScope ? { customer: { salesId: salesScope } } : {}),
            },
            orderBy: { productName: "asc" },
          })
        : [];

    const customerMap = new Map<
      string,
      {
        id: string;
        name: string;
        sales: { id: string; name: string };
        inventory: typeof inventories;
        orders: OrderWithRelations[];
      }
    >();

    for (const order of orders) {
      if (customerQ && !order.customerName.includes(customerQ)) continue;

      if (view === "active") {
        if (order.creditStatus === "SETTLED") continue;
        if (order.paymentStatus === "PAID" && order.creditStatus !== "BAD_DEBT") {
          continue;
        }
      }

      const cid = order.customerId;
      if (!customerMap.has(cid)) {
        customerMap.set(cid, {
          id: cid,
          name: order.customerName,
          sales: order.customer.sales,
          inventory: inventories.filter((i) => i.customerId === cid),
          orders: [],
        });
      }
      customerMap.get(cid)!.orders.push(order);
    }

    const customers = Array.from(customerMap.values()).map((c) => {
      const unreconciledAmount = c.orders
        .filter((o) => o.creditStatus === "ACTIVE")
        .reduce((s, o) => s + Math.max(0, o.totalAmount - o.paidAmount), 0);

      return {
        id: c.id,
        name: c.name,
        sales: c.sales,
        unreconciledAmount,
        inventory: c.inventory.map((i) => ({
          id: i.id,
          productName: i.productName,
          specName: i.specName,
          unitLabel: SPEC_UNIT_LABELS[i.unitType],
          unreconciledQty: i.unreconciledQty,
          unreconciledBottles: toBottleCount(
            i.unreconciledQty,
            bottlesPerUnit(i.productSpecId, i.specName, i.unitType)
          ),
        })),
        orders: c.orders.map((o) => serializeCreditOrder(o, bottlesPerUnit)),
      };
    });

    const settledOrderCount =
      view === "settled"
        ? customers.reduce((sum, c) => sum + c.orders.length, 0)
        : undefined;

    return NextResponse.json({
      view,
      stats,
      settledOrderCount,
      customers,
      canEdit: ["OPERATIONS", "ADMIN"].includes(session.role),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function serializeCreditOrder(
  o: OrderWithRelations,
  bottlesPerUnit: (specId: string, specName: string, unitType: SpecUnit) => number
) {
  return {
    id: o.id,
    orderNo: o.orderNo,
    totalAmount: o.totalAmount,
    paidAmount: o.paidAmount,
    unreconciledAmount: Math.max(0, o.totalAmount - o.paidAmount),
    paymentStatus: o.paymentStatus,
    creditStatus: o.creditStatus,
    badDebtAmount: o.badDebtAmount,
    badDebtGoodsRecovered: o.badDebtGoodsRecovered,
    badDebtNotes: o.badDebtNotes,
    orderedAt: o.orderedAt,
    paidAt: o.paidAt,
    items: o.items.map((item) => {
      const line = o.creditLines.find((l) => l.orderItemId === item.id);
      const perUnit = bottlesPerUnit(
        item.productSpecId,
        item.specName,
        item.unitType
      );
      const unreconciledQty = line?.unreconciledQty ?? item.quantity;
      const reconciledQty = line?.reconciledQty ?? 0;
      return {
        id: item.id,
        productName: item.productName,
        specName: item.specName,
        unitType: item.unitType,
        unitLabel: SPEC_UNIT_LABELS[item.unitType],
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        quantityBottles: toBottleCount(item.quantity, perUnit),
        unreconciledQty,
        unreconciledBottles: toBottleCount(unreconciledQty, perUnit),
        reconciledQty,
        reconciledBottles: toBottleCount(reconciledQty, perUnit),
        isGift: item.isGift,
        badDebtRecoveredQty: line?.badDebtRecoveredQty ?? 0,
      };
    }),
    creditLines: o.creditLines,
    reconciliationRecords: o.reconciliationRecords.map((rec) => ({
      id: rec.id,
      action: rec.action,
      paidAmount: rec.paidAmount,
      paymentStatus: rec.paymentStatus,
      performanceAmount: resolveReconciliationPerformanceAmount(rec, o.items),
      paidAt: rec.paidAt,
      userName: rec.userName,
      detail: rec.detail,
      createdAt: rec.createdAt,
      items: parseReconcileDetail(rec.detail, o.items),
    })),
  };
}

function parseReconcileDetail(
  detail: string | null,
  orderItems: { id: string; productName: string; specName: string; isGift?: boolean }[]
) {
  const reconcileItems = parseReconcileItemsFromDetail(detail);
  const itemMap = new Map(orderItems.map((i) => [i.id, i]));
  return reconcileItems.map((i) => ({
    productName: itemMap.get(i.orderItemId)?.productName ?? "",
    specName: itemMap.get(i.orderItemId)?.specName ?? "",
    quantity: i.quantity,
    isGift: itemMap.get(i.orderItemId)?.isGift ?? false,
  }));
}
