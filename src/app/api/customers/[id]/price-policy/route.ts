import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import {
  getCustomerPricePolicy,
  upsertCustomerPricePolicyNote,
} from "@/lib/customer-price-policy";

async function assertCustomerAccess(customerId: string, session: { role: string; id: string }) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, salesId: true, deletedAt: true },
  });
  if (!customer || customer.deletedAt) return null;
  if (session.role === "SALES" && customer.salesId !== session.id) return null;
  return customer;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(["ADMIN", "SALES", "OPERATIONS"]);
    const { id } = await params;
    const customer = await assertCustomerAccess(id, session);
    if (!customer) return apiError("客户不存在", 404);

    const rows = await getCustomerPricePolicy(id);
    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  productSpecId: z.string().min(1),
  note: z.string().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(["ADMIN", "SALES"]);
    const { id } = await params;
    const customer = await assertCustomerAccess(id, session);
    if (!customer) return apiError("客户不存在", 404);

    const body = patchSchema.parse(await request.json());
    const lastPrices = await getCustomerPricePolicy(id);
    if (!lastPrices.some((r) => r.productSpecId === body.productSpecId)) {
      return apiError("该产品规格不在客户拿货记录中", 400);
    }

    const updated = await upsertCustomerPricePolicyNote(
      id,
      body.productSpecId,
      body.note
    );
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return handleApiError(error);
  }
}
