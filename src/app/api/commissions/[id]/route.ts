import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api";
import { getEditionState, isPremiumEdition } from "@/lib/edition";
import {
  hasDuplicateRule,
  includeRule,
  normalizeRuleInput,
  serializeRule,
  updateRuleWithTargets,
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
  productId: z.string().min(1),
  productSpecId: z.string().nullable().optional(),
  appliesToAllSales: z.boolean(),
  salesIds: z.array(z.string()).optional(),
  kind: z.enum(["PERCENT", "FIXED"]),
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

    const body = ruleSchema.parse(await request.json());
    const data = normalizeRuleInput(body);

    const relationError = await validateRuleInput(data);
    if (relationError) return apiError(relationError);

    if (await hasDuplicateRule(data, id)) {
      return apiError("相同维度的提成规则已存在");
    }

    const rule = await updateRuleWithTargets(id, data);
    return NextResponse.json(serializeRule(rule));
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

    await prisma.salesCommissionRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "PREMIUM_REQUIRED") {
      return apiError("销售提成为高级版功能", 403);
    }
    return handleApiError(error);
  }
}
