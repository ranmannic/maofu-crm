import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import type { OrderVoucherCategory } from "@/generated/prisma/client";
import { saveVoucherFile } from "@/lib/vouchers";

async function assertOrderAccess(orderId: string, session: { id: string; role: string }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.deletedAt) return { error: apiError("订单不存在", 404) as NextResponse };
  if (session.role === "SALES" && order.salesId !== session.id) {
    return { error: apiError("无权限", 403) as NextResponse };
  }
  return { order };
}

const VALID_CATEGORIES = new Set<OrderVoucherCategory>([
  "CONTRACT",
  "SIGN_OFF",
  "CHAT",
  "PAYMENT",
  "OTHER",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: orderId } = await params;
    const access = await assertOrderAccess(orderId, session);
    if (access.error) return access.error;

    const vouchers = await prisma.orderVoucher.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(vouchers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(["OPERATIONS", "ADMIN"]);
    const { id: orderId } = await params;
    const access = await assertOrderAccess(orderId, session);
    if (access.error) return access.error;

    const formData = await request.formData();
    const file = formData.get("file");
    const category = String(formData.get("category") || "OTHER");

    if (!(file instanceof File) || file.size === 0) {
      return apiError("请选择要上传的文件");
    }
    if (!VALID_CATEGORIES.has(category as OrderVoucherCategory)) {
      return apiError("凭证类型无效");
    }

    const saved = await saveVoucherFile(orderId, file);
    const voucher = await prisma.orderVoucher.create({
      data: {
        orderId,
        category: category as OrderVoucherCategory,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        storageKey: saved.storageKey,
        uploadedById: session.id,
        uploadedByName: session.name,
      },
    });

    return NextResponse.json(voucher, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message) {
      return apiError(error.message);
    }
    return handleApiError(error);
  }
}
