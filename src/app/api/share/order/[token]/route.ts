import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";
import { maskPhone } from "@/lib/phone-mask";
import { SPEC_UNIT_LABELS, SHIPPING_METHOD_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const order = await prisma.order.findUnique({
      where: { shareToken: token, deletedAt: null },
      include: {
        items: true,
        shipping: true,
        customer: { select: { phone: true } },
        sales: { select: { name: true } },
      },
    });
    if (!order) return apiError("分享链接无效或已失效", 404);

    const paymentLabel =
      order.paymentStatus === "PAID" || order.isPaid
        ? "已收款"
        : order.paymentStatus === "PARTIAL" || order.paidAmount > 0
          ? "部分收款"
          : "未收款";

    const shipLabel = order.isShipped ? "已发货" : "未发货";

    return NextResponse.json({
      orderNo: order.orderNo,
      customerName: order.customerName,
      customerPhone: maskPhone(order.customer.phone),
      salesName: order.sales.name,
      orderedAt: formatDate(order.orderedAt),
      totalAmount: formatCurrency(order.totalAmount),
      productAmount: formatCurrency(order.productAmount),
      shippingFee: formatCurrency(order.shippingFee ?? 0),
      otherFee: formatCurrency(order.otherFee ?? 0),
      paidAmount: formatCurrency(order.paidAmount),
      paymentLabel,
      shipLabel,
      notes: order.notes,
      items: order.items.map((i) => ({
        productName: i.productName,
        specName: i.specName,
        quantity: i.quantity,
        unitLabel: SPEC_UNIT_LABELS[i.unitType],
        unitPrice: i.isGift ? "赠品" : formatCurrency(i.unitPrice),
        isGift: i.isGift,
      })),
      shipping: order.shipping
        ? {
            method: order.shipping.method
              ? SHIPPING_METHOD_LABELS[order.shipping.method]
              : null,
            recipientName: order.shipping.recipientName,
            recipientPhone: maskPhone(order.shipping.recipientPhone),
            address: order.shipping.address,
            carrier: order.shipping.carrier,
            trackingNo: order.shipping.trackingNo,
            shippedAt: order.shipping.shippedAt
              ? formatDate(order.shipping.shippedAt)
              : null,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
