import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z
      .string()
      .min(1)
      .regex(/^1[3-9]\d{9}$/, "联系电话格式不正确，应为 11 位手机号")
      .optional(),
    province: z.string().optional(),
    city: z.string().optional(),
    county: z.string().optional(),
    address: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.province === undefined && data.city === undefined && data.county === undefined) {
        return true;
      }
      return !!(data.province?.trim() || data.city?.trim() || data.county?.trim());
    },
    { message: "请至少填写省、市或区/县中的一项", path: ["province"] }
  );

async function assertAddressAccess(
  customerId: string,
  addressId: string,
  session: { id: string; role: string }
) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.deletedAt) return { error: apiError("客户不存在", 404) as NextResponse };
  if (session.role === "SALES" && customer.salesId !== session.id) {
    return { error: apiError("无权限", 403) as NextResponse };
  }
  const address = await prisma.customerShippingAddress.findFirst({
    where: { id: addressId, customerId },
  });
  if (!address) return { error: apiError("收货地址不存在", 404) as NextResponse };
  return { address };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const session = await requireSession(["SALES", "ADMIN"]);
    const { id: customerId, addressId } = await params;
    const access = await assertAddressAccess(customerId, addressId, session);
    if (access.error) return access.error;

    const body = updateSchema.parse(await request.json());

    const updated = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.customerShippingAddress.updateMany({
          where: { customerId, id: { not: addressId } },
          data: { isDefault: false },
        });
      }
      return tx.customerShippingAddress.update({
        where: { id: addressId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.province !== undefined && { province: body.province || null }),
          ...(body.city !== undefined && { city: body.city || null }),
          ...(body.county !== undefined && { county: body.county || null }),
          ...(body.address !== undefined && { address: body.address }),
          ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const session = await requireSession(["SALES", "ADMIN"]);
    const { id: customerId, addressId } = await params;
    const access = await assertAddressAccess(customerId, addressId, session);
    if (access.error) return access.error;

    const wasDefault = access.address!.isDefault;

    await prisma.customerShippingAddress.delete({ where: { id: addressId } });

    if (wasDefault) {
      const next = await prisma.customerShippingAddress.findFirst({
        where: { customerId },
        orderBy: { updatedAt: "desc" },
      });
      if (next) {
        await prisma.customerShippingAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
