import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { deleteVoucherFile, resolveVoucherPath } from "@/lib/vouchers";

async function assertOrderAccess(orderId: string, session: { id: string; role: string }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.deletedAt) return { error: apiError("订单不存在", 404) as NextResponse };
  if (session.role === "SALES" && order.salesId !== session.id) {
    return { error: apiError("无权限", 403) as NextResponse };
  }
  return { order };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; voucherId: string }> }
) {
  try {
    const session = await requireSession();
    const { id: orderId, voucherId } = await params;
    const access = await assertOrderAccess(orderId, session);
    if (access.error) return access.error;

    const voucher = await prisma.orderVoucher.findFirst({
      where: { id: voucherId, orderId },
    });
    if (!voucher) return apiError("凭证不存在", 404);

    const filePath = resolveVoucherPath(voucher.storageKey);
    const buffer = await fs.readFile(filePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": voucher.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(voucher.fileName)}`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; voucherId: string }> }
) {
  try {
    const session = await requireSession(["OPERATIONS", "ADMIN"]);
    const { id: orderId, voucherId } = await params;
    const access = await assertOrderAccess(orderId, session);
    if (access.error) return access.error;

    const voucher = await prisma.orderVoucher.findFirst({
      where: { id: voucherId, orderId },
    });
    if (!voucher) return apiError("凭证不存在", 404);

    await deleteVoucherFile(voucher.storageKey);
    await prisma.orderVoucher.delete({ where: { id: voucherId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
