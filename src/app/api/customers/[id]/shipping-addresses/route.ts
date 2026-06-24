import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";

const addressSchema = z.object({
  name: z.string().min(1, "姓名不能为空"),
  phone: z
    .string()
    .min(1, "联系电话不能为空")
    .regex(/^1[3-9]\d{9}$/, "联系电话格式不正确，应为 11 位手机号"),
  province: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  address: z.string().min(1, "收货地址不能为空"),
  isDefault: z.boolean().optional(),
}).refine(
  (data) => !!(data.province?.trim() || data.city?.trim() || data.county?.trim()),
  { message: "请至少填写省、市或区/县中的一项", path: ["province"] }
);

async function assertCustomerAccess(customerId: string, session: { id: string; role: string }) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.deletedAt) return { error: apiError("客户不存在", 404) as NextResponse };
  if (session.role === "SALES" && customer.salesId !== session.id) {
    return { error: apiError("无权限", 403) as NextResponse };
  }
  return { customer };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: customerId } = await params;
    const access = await assertCustomerAccess(customerId, session);
    if (access.error) return access.error;

    const addresses = await prisma.customerShippingAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json(addresses);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(["SALES", "ADMIN"]);
    const { id: customerId } = await params;
    const access = await assertCustomerAccess(customerId, session);
    if (access.error) return access.error;

    const body = addressSchema.parse(await request.json());

    const existingCount = await prisma.customerShippingAddress.count({
      where: { customerId },
    });
    const setDefault = body.isDefault ?? existingCount === 0;

    const address = await prisma.$transaction(async (tx) => {
      if (setDefault) {
        await tx.customerShippingAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }
      return tx.customerShippingAddress.create({
        data: {
          customerId,
          name: body.name,
          phone: body.phone,
          province: body.province || null,
          city: body.city || null,
          county: body.county || null,
          address: body.address,
          isDefault: setDefault,
        },
      });
    });

    return NextResponse.json(address, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
