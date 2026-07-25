import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, withSalesManagerAccess } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { canReadCustomerRecord } from "@/lib/sales-team";
import { SPEC_UNIT_LABELS } from "@/lib/constants";
import type { SpecUnit } from "@/generated/prisma/client";

type Granularity = "month" | "year";

function periodKey(date: Date, granularity: Granularity) {
  const y = date.getFullYear();
  if (granularity === "year") return String(y);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function buildPeriods(start: Date, end: Date, granularity: Granularity): string[] {
  const keys: string[] = [];
  if (granularity === "year") {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      keys.push(String(y));
    }
    return keys;
  }
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    keys.push(periodKey(cursor, "month"));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

/** 客户历史拿货 SKU 数量（按月/年） */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(
      withSalesManagerAccess(["ADMIN", "SALES", "OPERATIONS"])
    );
    const { id } = await params;
    const granularity =
      (request.nextUrl.searchParams.get("granularity") as Granularity) || "month";
    if (granularity !== "month" && granularity !== "year") {
      return apiError("granularity 仅支持 month 或 year");
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, salesId: true, deletedAt: true, name: true },
    });
    if (!customer || customer.deletedAt) return apiError("客户不存在", 404);
    if (!(await canReadCustomerRecord(session, customer))) {
      return apiError("无权限查看该客户", 403);
    }

    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          customerId: id,
          deletedAt: null,
        },
      },
      select: {
        productSpecId: true,
        productName: true,
        specName: true,
        unitType: true,
        quantity: true,
        isGift: true,
        order: { select: { orderedAt: true } },
      },
      orderBy: { order: { orderedAt: "asc" } },
    });

    if (items.length === 0) {
      return NextResponse.json({
        granularity,
        periods: [],
        series: [],
        chartData: [],
        customerName: customer.name,
      });
    }

    const earliest = items[0].order.orderedAt;
    const latest = items.reduce(
      (max, it) => (it.order.orderedAt > max ? it.order.orderedAt : max),
      items[0].order.orderedAt
    );
    const now = new Date();
    const end = latest > now ? latest : now;
    const periods = buildPeriods(earliest, end, granularity);

    type SeriesMeta = {
      productSpecId: string;
      label: string;
      unitType: SpecUnit;
      unitLabel: string;
      firstPeriod: string;
      totalQty: number;
    };

    const seriesMap = new Map<string, SeriesMeta>();
    const qtyMap = new Map<string, number>(); // `${specId}|${period}` -> qty

    for (const it of items) {
      const p = periodKey(it.order.orderedAt, granularity);
      const key = `${it.productSpecId}|${p}`;
      qtyMap.set(key, (qtyMap.get(key) || 0) + it.quantity);

      const existing = seriesMap.get(it.productSpecId);
      if (!existing) {
        seriesMap.set(it.productSpecId, {
          productSpecId: it.productSpecId,
          label: `${it.productName} · ${it.specName}`,
          unitType: it.unitType,
          unitLabel: SPEC_UNIT_LABELS[it.unitType] || it.unitType,
          firstPeriod: p,
          totalQty: it.quantity,
        });
      } else {
        existing.totalQty += it.quantity;
        if (p < existing.firstPeriod) existing.firstPeriod = p;
      }
    }

    const series = Array.from(seriesMap.values()).sort(
      (a, b) => b.totalQty - a.totalQty || a.label.localeCompare(b.label, "zh")
    );

    const chartData = periods.map((period) => {
      const row: Record<string, string | number> = { period };
      for (const s of series) {
        row[s.productSpecId] = qtyMap.get(`${s.productSpecId}|${period}`) || 0;
      }
      return row;
    });

    return NextResponse.json({
      granularity,
      periods,
      series,
      chartData,
      customerName: customer.name,
      startPeriod: periods[0] ?? null,
      endPeriod: periods[periods.length - 1] ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
