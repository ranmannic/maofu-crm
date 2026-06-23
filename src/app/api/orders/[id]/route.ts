import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { enrichOrderForList } from "@/lib/serializers";
import { logOrderChange } from "@/lib/order-audit";
import {
  calcOrderProfit,
  calcPerformanceAmount,
  calcProfitMargin,
  syncPaymentFields,
} from "@/lib/order-math";
import { processPaymentWithReconciliation, ensureCreditOrderActive, requiresPaymentReconciliation } from "@/lib/credit";
import {
  calcRefundPerformanceAmount,
  recordRefundPerformance,
} from "@/lib/performance";

const refundSchema = z.object({
  refundStatus: z.enum(["NONE", "PARTIAL", "FULL"]),
  refundAmount: z.number().min(0),
  refundedAt: z.string().optional(),
});

const paymentSchema = z.object({
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]),
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
  restore: z.boolean().optional(),
  payment: paymentSchema.optional(),
  reconcileItems: z
    .array(
      z.object({
        orderItemId: z.string(),
        quantity: z.number().int().min(0),
      })
    )
    .optional(),
  shipping: shippingSchema.optional(),
  refund: refundSchema.optional(),
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
        creditLines: true,
        auditLogs: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) return apiError("订单不存在", 404);
    if (session.role === "SALES" && order.salesId !== session.id) {
      return apiError("无权限", 403);
    }
    if (order.deletedAt && session.role === "SALES") {
      return apiError("订单已删除", 404);
    }

    const isAdmin = session.role === "ADMIN";
    const shippingFee = order.shippingFee ?? 0;
    const otherFee = order.otherFee ?? 0;
    const performanceAmount = calcPerformanceAmount(
      order.totalAmount,
      shippingFee,
      otherFee
    );
    const profit = calcOrderProfit(
      order.totalAmount,
      order.productCostTotal,
      shippingFee,
      otherFee
    );
    return NextResponse.json({
      ...enrichOrderForList(order, isAdmin),
      profit: isAdmin ? profit : undefined,
      profitMargin: isAdmin
        ? calcProfitMargin(performanceAmount, profit)
        : undefined,
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

    if (existing.deletedAt && !body.restore) {
      return apiError("订单已删除，无法修改", 400);
    }

    if (body.restore) {
      if (session.role !== "ADMIN") {
        return apiError("只有管理员可恢复订单", 403);
      }
    }

    if (body.payment && !["OPERATIONS", "ADMIN"].includes(session.role)) {
      return apiError("只有职能或管理员可设置收款", 403);
    }
    if (body.shipping && !["OPERATIONS", "ADMIN"].includes(session.role)) {
      return apiError("只有职能或管理员可设置发货", 403);
    }
    if (body.refund && !["OPERATIONS", "ADMIN"].includes(session.role)) {
      return apiError("只有职能或管理员可设置退款", 403);
    }
    if (body.handlerId !== undefined && session.role === "SALES") {
      return apiError("销售无法修改处理人员", 403);
    }

    const orderData: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};

    if (body.restore) {
      orderData.deletedAt = null;
      changes.restore = true;
    }

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
      const total = (body.totalAmount ?? existing.totalAmount) as number;
      const positiveReconcileItems =
        body.reconcileItems?.filter((i) => i.quantity > 0) ?? [];

      if (
        positiveReconcileItems.length > 0 &&
        (body.payment.paymentStatus === "UNPAID" || body.payment.paidAmount <= 0)
      ) {
        return apiError("未付款时不可核销产品数量");
      }

      const needsReconcile = requiresPaymentReconciliation(
        existing,
        body.payment.paymentStatus
      );
      if (
        needsReconcile &&
        positiveReconcileItems.length === 0
      ) {
        return apiError(
          body.payment.paymentStatus === "PAID"
            ? "账期订单结清需填写核销产品及数量"
            : "部分付款需填写核销产品及数量"
        );
      }

      if (body.payment.paymentStatus === "UNPAID") {
        const synced = syncPaymentFields(
          body.payment.paymentStatus,
          body.payment.paidAmount,
          total
        );
        orderData.paymentStatus = synced.paymentStatus;
        orderData.paidAmount = synced.paidAmount;
        orderData.isPaid = synced.isPaid;
        orderData.paidAt = null;
        orderData.creditStatus =
          existing.creditStatus === "BAD_DEBT"
            ? "BAD_DEBT"
            : existing.isShipped || body.shipping?.isShipped
              ? "ACTIVE"
              : null;
        changes.payment = synced;
      } else {
        try {
          const synced = await processPaymentWithReconciliation(
            id,
            body.payment,
            positiveReconcileItems,
            session.id,
            session.name
          );
          changes.payment = { ...synced, reconcileItems: body.reconcileItems };
        } catch (err) {
          if (err instanceof Error) return apiError(err.message);
          throw err;
        }
      }
    }

    if (body.shipping) {
      orderData.isShipped = body.shipping.isShipped;
      changes.shipping = body.shipping;
    }

    let refundPerformanceAmount = 0;
    if (body.refund) {
      let refundAmount = body.refund.refundAmount;
      if (body.refund.refundStatus === "NONE") refundAmount = 0;
      else if (body.refund.refundStatus === "FULL") {
        refundAmount = existing.paidAmount;
      }
      if (refundAmount > existing.paidAmount) {
        return apiError("退款金额不能超过已收金额");
      }
      const refundedAt =
        body.refund.refundStatus === "NONE"
          ? null
          : body.refund.refundedAt
            ? new Date(body.refund.refundedAt)
            : new Date();
      orderData.refundStatus = body.refund.refundStatus;
      orderData.refundAmount = refundAmount;
      orderData.refundedAt = refundedAt;
      refundPerformanceAmount = calcRefundPerformanceAmount({
        totalAmount: existing.totalAmount,
        productAmount: existing.productAmount,
        shippingFee: existing.shippingFee,
        otherFee: existing.otherFee,
        refundAmount,
      });
      changes.refund = {
        refundStatus: body.refund.refundStatus,
        refundAmount,
        refundPerformanceAmount,
      };
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

      if (body.refund) {
        const updated = await tx.order.findUnique({ where: { id } });
        if (updated && updated.refundAmount > 0 && updated.refundedAt) {
          await recordRefundPerformance(tx, {
            orderId: id,
            salesId: updated.salesId,
            amount: refundPerformanceAmount,
            eventAt: updated.refundedAt,
            detail: JSON.stringify({
              refundStatus: updated.refundStatus,
              refundAmount: updated.refundAmount,
            }),
          });
        } else if (updated?.refundAmount === 0) {
          await tx.performanceRecord.deleteMany({
            where: { orderId: id, type: "REFUND" },
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
          creditLines: true,
          auditLogs: { orderBy: { createdAt: "desc" } },
        },
      });
    });

    if (body.shipping?.isShipped) {
      await ensureCreditOrderActive(id);
    }

    if (Object.keys(changes).length > 0) {
      await logOrderChange(
        id,
        session.id,
        session.name,
        "更新订单",
        changes
      );
    }

    const finalOrder =
      body.shipping?.isShipped
        ? await prisma.order.findUnique({
            where: { id },
            include: {
              customer: true,
              sales: { select: { id: true, name: true } },
              handler: { select: { id: true, name: true } },
              items: true,
              shipping: true,
              creditLines: true,
              auditLogs: { orderBy: { createdAt: "desc" } },
            },
          })
        : order;

    const isAdmin = session.role === "ADMIN";
    const profit =
      finalOrder && isAdmin
        ? calcOrderProfit(
            finalOrder.totalAmount,
            finalOrder.productCostTotal,
            finalOrder.shippingFee ?? 0,
            finalOrder.otherFee ?? 0
          )
        : undefined;
    const performanceAmount =
      finalOrder &&
      calcPerformanceAmount(
        finalOrder.totalAmount,
        finalOrder.shippingFee ?? 0,
        finalOrder.otherFee ?? 0
      );

    return NextResponse.json({
      ...(finalOrder ? enrichOrderForList(finalOrder, isAdmin) : {}),
      profit,
      profitMargin:
        finalOrder && isAdmin && profit !== undefined && performanceAmount
          ? calcProfitMargin(performanceAmount, profit)
          : undefined,
      auditLogs: finalOrder?.auditLogs,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(["SALES", "ADMIN"]);
    const { id } = await params;

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return apiError("订单不存在", 404);
    if (existing.deletedAt) return apiError("订单已删除", 400);

    if (session.role === "SALES" && existing.salesId !== session.id) {
      return apiError("无权限", 403);
    }

    await prisma.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logOrderChange(id, session.id, session.name, "删除订单", {
      orderNo: existing.orderNo,
    });

    return NextResponse.json({ success: true, softDeleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
