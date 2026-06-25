import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { handleApiError, apiError } from "@/lib/api";
import {
  buildOrderListWhere,
  orderListInclude,
  parseOrderListFilters,
} from "@/lib/orders-query";
import {
  buildOrderExportBuffer,
  orderExportFileName,
} from "@/lib/order-export";

const EXPORT_MAX_ROWS = 10000;

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(["ADMIN", "OPERATIONS"]);
    const filters = parseOrderListFilters(new URL(request.url).searchParams);
    const where = buildOrderListWhere(session, filters);

    const total = await prisma.order.count({ where });
    if (total === 0) {
      return apiError("当前筛选条件下没有可导出的订单");
    }
    if (total > EXPORT_MAX_ROWS) {
      return apiError(
        `导出订单过多（${total} 条），请缩小筛选范围（最多 ${EXPORT_MAX_ROWS} 条）`
      );
    }

    const orders = await prisma.order.findMany({
      where,
      include: orderListInclude,
      orderBy: { orderedAt: "desc" },
      take: EXPORT_MAX_ROWS,
    });

    const buffer = buildOrderExportBuffer(orders, session.role);
    const fileName = orderExportFileName();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
