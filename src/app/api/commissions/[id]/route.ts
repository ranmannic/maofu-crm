import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { getEditionState, isPremiumEdition } from "@/lib/edition";
import {
  includeRule,
  normalizeRuleInput,
  serializeRule,
  updateGlobalDefaultValue,
  updateRuleWithTargets,
  validateRuleConflict,
  validateRuleInput,
} from "@/lib/commission-rules";

async function requirePremiumAdmin() {
  await requireSession(["ADMIN"]);
  const edition = await getEditionState();
  if (!isPremiumEdition(edition)) {
    throw new Error("PREMIUM_REQUIRED");
  }
}

const ruleSchema = z.object({
  productId: z.string().min(1).optional(),
  productSpecId: z.string().nullable().optional(),
  appliesToAllSales: z.boolean().optional(),
  salesIds: z.array(z.string()).optional(),
  kind: z.enum(["PERCENT", "FIXED"]).optional(),
  value: z.number().min(0, "提成值不能为负数"),
});

const globalRuleSchema = z.object({
  value: z.number().min(0, "提成值不能为负数"),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePremiumAdmin();
    const { id } = await params;
    const existing = await prisma.salesCommissionRule.findUnique({
      where: { id },
    });
    if (!existing) return apiError("规则不存在", 404);

    if (existing.isGlobalDefault) {
      const body = globalRuleSchema.parse(await request.json());
      const relationError = await validateRuleInput(
        normalizeRuleInput({
          productId: null,
          appliesToAllSales: true,
          kind: "PERCENT",
          value: body.value,
        }),
        { isGlobalDefault: true }
      );
      if (relationError) return apiError(relationError);

      const rule = await updateGlobalDefaultValue(id, body.value);
      return NextResponse.json(serializeRule(rule));
    }

    const body = ruleSchema.parse(await request.json());
    if (
      body.productId === undefined ||
      body.appliesToAllSales === undefined ||
      body.kind === undefined
    ) {
      return apiError("参数不完整");
    }

    const data = normalizeRuleInput({
      productId: body.productId,
      productSpecId: body.productSpecId,
      appliesToAllSales: body.appliesToAllSales,
      salesIds: body.salesIds,
      kind: body.kind,
      value: body.value,
    });

    const relationError = await validateRuleInput(data);
    if (relationError) return apiError(relationError);

    const conflict = await validateRuleConflict(data, id);
    if (conflict.error) return apiError(conflict.error);

    const rule = await updateRuleWithTargets(id, data);
    const payload = serializeRule(rule);
    return NextResponse.json(
      conflict.warning ? { ...payload, warning: conflict.warning } : payload
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    if (error instanceof Error && error.message === "PREMIUM_REQUIRED") {
      return apiError("销售提成为高级版功能", 403);
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePremiumAdmin();
    const { id } = await params;
    const existing = await prisma.salesCommissionRule.findUnique({
      where: { id },
    });
    if (!existing) return apiError("规则不存在", 404);
    if (existing.isGlobalDefault) {
      return apiError("全局默认规则不可删除");
    }

    await prisma.salesCommissionRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "PREMIUM_REQUIRED") {
      return apiError("销售提成为高级版功能", 403);
    }
    return handleApiError(error);
  }
}
