import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  calcCalculatedAmount,
  calcOrderTotalAmount,
  calcProductCostTotal,
  syncPaymentFields,
} from "@/lib/order-math";
import { generateOrderNo } from "@/lib/utils";
import { apiError, handleApiError } from "@/lib/api";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { enrichOrderForList } from "@/lib/serializers";
import { logOrderChange } from "@/lib/order-audit";
import { processPaymentWithReconciliation, requiresPaymentReconciliation } from "@/lib/credit";
import type { Prisma } from "@/generated/prisma/client";

const orderItemSchema = z.object({
  productId: z.string(),
  productSpecId: z.string(),
  quantity: z.number().int().min(1),
  isGift: z.boolean().optional(),
});

const createOrderSchema = z.object({
  customerId: z.string(),
  items: z.array(orderItemSchema).min(1, "至少添加一个产品"),
  shippingFee: z.number().min(0).optional(),
  otherFee: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  amountAdjustReason: z.string().optional(),
  notes: z.string().optional(),
  handlerId: z.string().optional(),
  payment: z
    .object({
      paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]),
      paidAmount: z.number().min(0),
      paidAt: z.string().optional(),
    })
    .optional(),
  reconcileItems: z
    .array(
      z
        .object({
          orderItemId: z.string().optional(),
          productSpecId: z.string().optional(),
          quantity: z.number().int().min(0),
        })
        .refine((i) => i.orderItemId || i.productSpecId, {
          message: "核销项需指定 orderItemId 或 productSpecId",
        })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = parsePagination(searchParams);

    const customerQ = searchParams.get("customer")?.trim();
    const salesQ = searchParams.get("sales")?.trim();
    const orderNoQ = searchParams.get("orderNo")?.trim();
    const orderedStart = searchParams.get("orderedStart");
    const orderedEnd = searchParams.get("orderedEnd");
    const paidStart = searchParams.get("paidStart");
    const paidEnd = searchParams.get("paidEnd");
    const isPaid = searchParams.get("isPaid");
    const paymentStatus = searchParams.get("paymentStatus");
    const isShipped = searchParams.get("isShipped");
    const showDeleted = searchParams.get("showDeleted") === "true";

    const where: Prisma.OrderWhereInput = {};

    if (session.role === "SALES") {
      where.salesId = session.id;
    }

    if (showDeleted) {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    if (orderNoQ) {
      where.orderNo = { contains: orderNoQ };
    }

    if (customerQ) {
      where.OR = [
        { customerName: { contains: customerQ } },
        { customerId: { contains: customerQ } },
      ];
    }

    if (salesQ && session.role !== "SALES") {
      where.sales = {
        OR: [{ name: { contains: salesQ } }, { id: { contains: salesQ } }],
      };
    }

    if (orderedStart || orderedEnd) {
      where.orderedAt = {};
      if (orderedStart) where.orderedAt.gte = new Date(orderedStart + "T00:00:00");
      if (orderedEnd) where.orderedAt.lte = new Date(orderedEnd + "T23:59:59");
    }

    if (paidStart || paidEnd) {
      where.paidAt = {};
      if (paidStart) where.paidAt.gte = new Date(paidStart + "T00:00:00");
      if (paidEnd) where.paidAt.lte = new Date(paidEnd + "T23:59:59");
    }

    if (isPaid === "true") where.isPaid = true;
    if (isPaid === "false") where.isPaid = false;
    if (paymentStatus === "UNPAID" || paymentStatus === "PARTIAL" || paymentStatus === "PAID") {
      where.paymentStatus = paymentStatus;
    }
    if (isShipped === "true") where.isShipped = true;
    if (isShipped === "false") where.isShipped = false;

    const isAdmin = session.role === "ADMIN";

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, channel: { select: { name: true } } },
          },
          sales: { select: { id: true, name: true } },
          handler: { select: { id: true, name: true } },
          items: true,
          shipping: true,
        },
        orderBy: { orderedAt: "desc" },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    const data = orders.map((o) => enrichOrderForList(o, isAdmin));
    return NextResponse.json(paginatedResponse(data, total, page, pageSize));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(["SALES", "ADMIN"]);
    const body = createOrderSchema.parse(await request.json());

    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId },
    });
    if (!customer || customer.deletedAt) return apiError("客户不存在", 404);
    if (session.role === "SALES" && customer.salesId !== session.id) {
      return apiError("只能为自己的客户下单", 403);
    }

    const specIds = body.items.map((i) => i.productSpecId);
    const specs = await prisma.productSpec.findMany({
      where: { id: { in: specIds } },
      include: { product: true },
    });

    if (specs.length !== body.items.length) {
      return apiError("部分产品规格不存在");
    }

    const specMap = new Map(specs.map((s) => [s.id, s]));

    const orderItems = body.items.map((item) => {
      const spec = specMap.get(item.productSpecId)!;
      const isGift = item.isGift ?? false;
      return {
        productId: spec.productId,
        productSpecId: spec.id,
        productName: spec.product.name,
        specName: spec.name,
        unitType: spec.unitType,
        quantity: item.quantity,
        unitPrice: isGift ? 0 : spec.price,
        unitCost: spec.cost,
        isGift,
      };
    });

    const productAmount = calcCalculatedAmount(orderItems);
    const shippingFee = body.shippingFee ?? 0;
    const otherFee = body.otherFee ?? 0;
    const calculatedAmount = calcOrderTotalAmount(
      productAmount,
      shippingFee,
      otherFee
    );
    const productCostTotal = calcProductCostTotal(orderItems);
    const totalAmount = body.totalAmount ?? calculatedAmount;

    if (totalAmount !== calculatedAmount) {
      if (!body.amountAdjustReason?.trim()) {
        return apiError("修改总金额需填写理由");
      }
    }

    const order = await prisma.order.create({
      data: {
        orderNo: generateOrderNo(),
        customerId: customer.id,
        customerName: customer.name,
        salesId: customer.salesId,
        handlerId: body.handlerId,
        productAmount,
        shippingFee,
        otherFee,
        calculatedAmount,
        totalAmount,
        amountAdjustReason:
          totalAmount !== calculatedAmount ? body.amountAdjustReason : null,
        productCostTotal,
        notes: body.notes,
        items: { create: orderItems },
      },
      include: {
        items: true,
        customer: true,
        sales: { select: { id: true, name: true } },
        handler: { select: { id: true, name: true } },
        shipping: true,
      },
    });

    await logOrderChange(order.id, session.id, session.name, "创建订单", {
      orderNo: order.orderNo,
      totalAmount,
      calculatedAmount,
    });

    if (
      body.payment &&
      body.payment.paymentStatus !== "UNPAID"
    ) {
      if (!["OPERATIONS", "ADMIN"].includes(session.role)) {
        return apiError("仅职能或管理员可在创建时设置收款", 403);
      }
      const needsReconcile = requiresPaymentReconciliation(
        { paymentStatus: "UNPAID", paidAmount: 0, creditStatus: null },
        body.payment.paymentStatus
      );
      let reconcileItems: { orderItemId: string; quantity: number }[] = [];
      if (needsReconcile) {
        if (!body.reconcileItems?.length) {
          return apiError("创建部分付款订单需填写核销产品及数量", 400);
        }
        reconcileItems = body.reconcileItems
          .filter((i) => i.quantity > 0)
          .map((item) => {
            if (item.orderItemId) {
              return { orderItemId: item.orderItemId, quantity: item.quantity };
            }
            const orderItem = order.items.find(
              (i) => i.productSpecId === item.productSpecId
            );
            if (!orderItem) {
              throw new Error("核销产品与订单明细不匹配");
            }
            return { orderItemId: orderItem.id, quantity: item.quantity };
          });
        if (reconcileItems.length === 0) {
          return apiError("创建部分付款订单需填写核销产品及数量", 400);
        }
      }
      try {
        await processPaymentWithReconciliation(
          order.id,
          body.payment,
          reconcileItems,
          session.id,
          session.name
        );
      } catch (err) {
        await prisma.order.delete({ where: { id: order.id } });
        if (err instanceof Error) return apiError(err.message);
        throw err;
      }
    }

    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: true,
        customer: true,
        sales: { select: { id: true, name: true } },
        handler: { select: { id: true, name: true } },
        shipping: true,
        creditLines: true,
      },
    });

    return NextResponse.json(
      enrichOrderForList(finalOrder!, session.role === "ADMIN"),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
