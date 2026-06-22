import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { enrichOrderForList } from "@/lib/serializers";
import { logOrderChange } from "@/lib/order-audit";
import {
  calcOrderProfit,
  calcProfitMargin,
} from "@/lib/order-math";

const paymentSchema = z.object({
  isPaid: z.boolean(),
  paidAmount: z.number().min(0),
  paidAt: z.string().optional(),
});

const shippingSchema = z.object({
  isShipped: z.boolean(),
  carrier: z.string().optional(),
  trackingNo: z.string().optional(),
  address: z.string().optional(),
  shippedAt: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  notes: z.string().optional(),
  handlerId: z.string().nullable().optional(),
  totalAmount: z.number().min(0).optional(),
  amountAdjustReason: z.string().optional(),
  payment: paymentSchema.optional(),
  shipping: shippingSchema.optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: { include: { channel: true } },
        sales: { select: { id: true, name: true } },
        handler: { select: { id: true, name: true } },
        items: true,
        shipping: true,
        auditLogs: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) return apiError("订单不存在", 404);
    if (session.role === "SALES" && order.salesId !== session.id) {
      return apiError("无权限", 403);
    }

    const isAdmin = session.role === "ADMIN";
    const profit = calcOrderProfit(order.totalAmount, order.productCostTotal);
    return NextResponse.json({
      ...enrichOrderForList(order, isAdmin),
      profit: isAdmin ? profit : undefined,
      profitMargin: isAdmin ? calcProfitMargin(order.totalAmount, profit) : undefined,
      auditLogs: order.auditLogs,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { shipping: true },
    });
    if (!existing) return apiError("订单不存在", 404);

    if (session.role === "SALES" && existing.salesId !== session.id) {
      return apiError("无权限", 403);
    }

    if (body.payment && !["OPERATIONS", "ADMIN"].includes(session.role)) {
      return apiError("只有职能或管理员可设置收款", 403);
    }
    if (body.shipping && !["OPERATIONS", "ADMIN"].includes(session.role)) {
      return apiError("只有职能或管理员可设置发货", 403);
    }
    if (body.handlerId !== undefined && session.role === "SALES") {
      return apiError("销售无法修改处理人员", 403);
    }

    const orderData: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};

    if (body.notes !== undefined && body.notes !== existing.notes) {
      orderData.notes = body.notes;
      changes.notes = { from: existing.notes, to: body.notes };
    }
    if (body.handlerId !== undefined && body.handlerId !== existing.handlerId) {
      orderData.handlerId = body.handlerId;
      changes.handlerId = { from: existing.handlerId, to: body.handlerId };
    }

    if (body.totalAmount !== undefined && body.totalAmount !== existing.totalAmount) {
      if (!body.amountAdjustReason?.trim()) {
        return apiError("修改总金额需填写理由");
      }
      orderData.totalAmount = body.totalAmount;
      orderData.amountAdjustReason = body.amountAdjustReason;
      changes.totalAmount = {
        from: existing.totalAmount,
        to: body.totalAmount,
        reason: body.amountAdjustReason,
      };
    }

    if (body.payment) {
      orderData.isPaid = body.payment.isPaid;
      orderData.paidAmount = body.payment.paidAmount;
      orderData.paidAt = body.payment.paidAt
        ? new Date(body.payment.paidAt)
        : body.payment.isPaid
          ? new Date()
          : null;
      changes.payment = body.payment;
    }

    if (body.shipping) {
      orderData.isShipped = body.shipping.isShipped;
      changes.shipping = body.shipping;
    }

    const order = await prisma.$transaction(async (tx) => {
      if (Object.keys(orderData).length > 0) {
        await tx.order.update({ where: { id }, data: orderData });
      }

      if (body.shipping) {
        const shippingData = {
          carrier: body.shipping.carrier,
          trackingNo: body.shipping.trackingNo,
          address: body.shipping.address,
          notes: body.shipping.notes,
          shippedAt: body.shipping.shippedAt
            ? new Date(body.shipping.shippedAt)
            : body.shipping.isShipped
              ? new Date()
              : null,
        };

        if (existing.shipping) {
          await tx.shippingInfo.update({
            where: { orderId: id },
            data: shippingData,
          });
        } else if (body.shipping.isShipped || body.shipping.trackingNo) {
          await tx.shippingInfo.create({
            data: { orderId: id, ...shippingData },
          });
        }
      }

      return tx.order.findUnique({
        where: { id },
        include: {
          customer: true,
          sales: { select: { id: true, name: true } },
          handler: { select: { id: true, name: true } },
          items: true,
          shipping: true,
          auditLogs: { orderBy: { createdAt: "desc" } },
        },
      });
    });

    if (Object.keys(changes).length > 0) {
      await logOrderChange(
        id,
        session.id,
        session.name,
        "更新订单",
        changes
      );
    }

    const isAdmin = session.role === "ADMIN";
    const profit =
      order && isAdmin
        ? calcOrderProfit(order.totalAmount, order.productCostTotal)
        : undefined;

    return NextResponse.json({
      ...(order ? enrichOrderForList(order, isAdmin) : {}),
      profit,
      profitMargin:
        order && isAdmin && profit !== undefined
          ? calcProfitMargin(order.totalAmount, profit)
          : undefined,
      auditLogs: order?.auditLogs,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
