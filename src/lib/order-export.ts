import * as XLSX from "xlsx";
import type { Role, ShippingMethod } from "@/generated/prisma/client";
import { SHIPPING_METHOD_LABELS, SPEC_UNIT_LABELS } from "@/lib/constants";
import {
  calcOrderProfit,
  calcPerformanceAmount,
  calcProfitMargin,
  formatItemsSummary,
} from "@/lib/order-math";
import { formatDate } from "@/lib/utils";
import type { orderListInclude } from "@/lib/orders-query";
import type { Prisma } from "@/generated/prisma/client";

type ExportOrder = Prisma.OrderGetPayload<{ include: typeof orderListInclude }>;

const PAYMENT_LABELS = {
  UNPAID: "未收",
  PARTIAL: "部分收",
  PAID: "已收",
} as const;

const REFUND_LABELS = {
  NONE: "无退款",
  PARTIAL: "部分退款",
  FULL: "全额退款",
} as const;

const CREDIT_LABELS = {
  ACTIVE: "账期中",
  SETTLED: "已结清",
  BAD_DEBT: "坏账",
} as const;

function channelLabel(
  channel: ExportOrder["customer"]["channel"] | null | undefined
) {
  if (!channel) return "";
  return channel.parent
    ? `${channel.parent.name} / ${channel.name}`
    : channel.name;
}

function shippingMethodLabel(method: ShippingMethod | null | undefined) {
  if (!method) return "";
  return SHIPPING_METHOD_LABELS[method] ?? method;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function buildOrderExportRow(order: ExportOrder, role: Role) {
  const shippingFee = order.shippingFee ?? 0;
  const otherFee = order.otherFee ?? 0;
  const productAmount = order.productAmount ?? 0;
  const performanceAmount =
    productAmount > 0
      ? productAmount
      : calcPerformanceAmount(order.totalAmount, shippingFee, otherFee);
  const profit = calcOrderProfit(
    order.totalAmount,
    order.productCostTotal,
    shippingFee,
    otherFee
  );
  const profitMargin = calcProfitMargin(performanceAmount, profit);
  const itemsSummary = formatItemsSummary(order.items, SPEC_UNIT_LABELS);
  const shipping = order.shipping;

  const base: Record<string, string | number> = {
    订单号: order.orderNo,
    客户: order.customerName,
    渠道: channelLabel(order.customer.channel),
    销售: order.sales.name,
    经手人: order.handler?.name ?? "",
    产品明细: itemsSummary,
    产品金额: round2(productAmount),
    运费: round2(shippingFee),
    其它费用: round2(otherFee),
    系统总金额: round2(order.calculatedAmount),
    订单总金额: round2(order.totalAmount),
    调整理由: order.amountAdjustReason ?? "",
    收款状态: PAYMENT_LABELS[order.paymentStatus],
    已收金额: round2(order.paidAmount),
    收款时间: formatDate(order.paidAt),
    发货方式: shippingMethodLabel(shipping?.method ?? null),
    发货状态: order.isShipped ? "已发货" : "未发货",
    发货时间: formatDate(shipping?.shippedAt),
    承运商: shipping?.carrier ?? "",
    运单号: shipping?.trackingNo ?? "",
    收货人: shipping?.recipientName ?? "",
    联系电话: shipping?.recipientPhone ?? "",
    收货地址: shipping?.address ?? "",
    退款状态: REFUND_LABELS[order.refundStatus],
    退款金额: round2(order.refundAmount),
    退款时间: formatDate(order.refundedAt),
    账期状态: order.creditStatus
      ? CREDIT_LABELS[order.creditStatus]
      : "",
    备注: order.notes ?? "",
    下单时间: formatDate(order.orderedAt),
    已删除: order.deletedAt ? "是" : "否",
  };

  if (role === "ADMIN") {
    return {
      ...base,
      产品成本: round2(order.productCostTotal),
      毛利: round2(profit),
      "毛利率(%)": round2(profitMargin),
    };
  }

  return base;
}

export function buildOrderExportSheet(orders: ExportOrder[], role: Role) {
  const rows = orders.map((o) => buildOrderExportRow(o, role));
  if (rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([["暂无符合条件的订单"]]);
  }
  return XLSX.utils.json_to_sheet(rows);
}

export function buildOrderExportBuffer(orders: ExportOrder[], role: Role) {
  const sheet = buildOrderExportSheet(orders, role);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "订单");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function orderExportFileName() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `订单导出_${stamp}.xlsx`;
}
