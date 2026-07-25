import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { applySalesIdScope, getSalesScopeIds } from "@/lib/sales-team";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;

function parseDayStart(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

function parseDayEnd(dateStr: string) {
  return new Date(`${dateStr}T23:59:59.999`);
}

function todayLocalISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mapRecord(
  r: {
    id: string;
    userName: string;
    followedAt: Date;
    content: string;
    nextPlan: string | null;
    nextFollowUpAt: Date | null;
    customer: {
      id: string;
      name: string;
      sales: { id: string; name: string };
    };
  }
) {
  return {
    id: r.id,
    customerId: r.customer.id,
    customerName: r.customer.name,
    salesName: r.customer.sales.name,
    userName: r.userName,
    followedAt: r.followedAt.toISOString(),
    followedAtLabel: formatDate(r.followedAt),
    content: r.content,
    nextPlan: r.nextPlan,
    nextFollowUpAt: r.nextFollowUpAt ? formatDate(r.nextFollowUpAt) : null,
  };
}

const customerInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      sales: { select: { id: true, name: true } },
    },
  },
} as const;

/** 管理员 / 销售管理：按日期分页查看跟进记录与跟进计划 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(["ADMIN", "SALES_MANAGER"]);
    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("start") || todayLocalISO();
    const endStr = searchParams.get("end") || startStr;
    const type = searchParams.get("type") === "plans" ? "plans" : "records";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endStr)) {
      return apiError("日期格式无效");
    }

    const start = parseDayStart(startStr);
    const end = parseDayEnd(endStr);
    if (start > end) return apiError("开始日期不能晚于结束日期");

    const scopeIds = await getSalesScopeIds(session);
    const customerWhere: { salesId?: string | { in: string[] } } = {};
    applySalesIdScope(customerWhere, scopeIds);

    const recordsWhere = {
      followedAt: { gte: start, lte: end },
      customer: customerWhere,
    };
    const plansWhere = {
      nextFollowUpAt: { gte: start, lte: end },
      customer: customerWhere,
    };

    const [recordsTotal, plansTotal] = await Promise.all([
      prisma.customerFollowUpRecord.count({ where: recordsWhere }),
      prisma.customerFollowUpRecord.count({ where: plansWhere }),
    ]);

    const activeTotal = type === "plans" ? plansTotal : recordsTotal;
    const totalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * PAGE_SIZE;

    const rows =
      type === "plans"
        ? await prisma.customerFollowUpRecord.findMany({
            where: plansWhere,
            include: customerInclude,
            orderBy: { nextFollowUpAt: "asc" },
            skip,
            take: PAGE_SIZE,
          })
        : await prisma.customerFollowUpRecord.findMany({
            where: recordsWhere,
            include: customerInclude,
            orderBy: { followedAt: "desc" },
            skip,
            take: PAGE_SIZE,
          });

    return NextResponse.json({
      start: startStr,
      end: endStr,
      type,
      page: safePage,
      pageSize: PAGE_SIZE,
      total: activeTotal,
      totalPages,
      recordsTotal,
      plansTotal,
      items: rows.map(mapRecord),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
