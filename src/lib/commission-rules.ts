import { prisma } from "@/lib/prisma";
import { buildScopeLabel, ruleDimensionKey } from "@/lib/sales-commission";

export const includeRule = {
  product: { select: { name: true } },
  productSpec: { select: { name: true } },
  salesTargets: {
    include: { sales: { select: { id: true, name: true } } },
  },
} as const;

export type RuleWithRelations = Awaited<
  ReturnType<typeof prisma.salesCommissionRule.findFirst>
> & {
  product: { name: string };
  productSpec: { name: string } | null;
  salesTargets: { salesId: string; sales: { id: string; name: string } }[];
};

export function serializeRule(rule: NonNullable<RuleWithRelations>) {
  const specName = rule.productSpec?.name ?? null;
  const salesNames = rule.salesTargets.map((t) => t.sales.name);
  const salesIds = rule.salesTargets.map((t) => t.salesId);

  return {
    id: rule.id,
    productId: rule.productId,
    productName: rule.product.name,
    productSpecId: rule.productSpecId,
    specName,
    appliesToAllSales: rule.appliesToAllSales,
    salesIds,
    salesNames,
    kind: rule.kind,
    value: rule.value,
    scopeLabel: buildScopeLabel({
      specName,
      appliesToAllSales: rule.appliesToAllSales,
      salesNames,
    }),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export interface NormalizedRuleInput {
  productId: string;
  productSpecId: string | null;
  appliesToAllSales: boolean;
  salesIds: string[];
  kind: "PERCENT" | "FIXED";
  value: number;
}

export function normalizeRuleInput(body: {
  productId: string;
  productSpecId?: string | null;
  appliesToAllSales: boolean;
  salesIds?: string[];
  kind: "PERCENT" | "FIXED";
  value: number;
}): NormalizedRuleInput {
  const salesIds = body.appliesToAllSales
    ? []
    : [...new Set(body.salesIds ?? [])];

  return {
    productId: body.productId,
    productSpecId: body.productSpecId || null,
    appliesToAllSales: body.appliesToAllSales,
    salesIds,
    kind: body.kind,
    value: body.value,
  };
}

export async function validateRuleInput(
  data: NormalizedRuleInput
): Promise<string | null> {
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    select: { id: true },
  });
  if (!product) return "产品不存在";

  if (data.productSpecId) {
    const spec = await prisma.productSpec.findFirst({
      where: { id: data.productSpecId, productId: data.productId },
    });
    if (!spec) return "规格不属于所选产品";
  }

  if (!data.appliesToAllSales) {
    if (data.salesIds.length === 0) return "请至少指定一名销售";
    const count = await prisma.user.count({
      where: { id: { in: data.salesIds }, role: "SALES" },
    });
    if (count !== data.salesIds.length) return "部分销售不存在";
  }

  if (data.kind === "PERCENT" && data.value > 100) {
    return "百分比提成不能超过 100%";
  }

  return null;
}

export async function hasDuplicateRule(
  data: NormalizedRuleInput,
  excludeId?: string
): Promise<boolean> {
  const existing = await prisma.salesCommissionRule.findMany({
    where: {
      productId: data.productId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    include: { salesTargets: { select: { salesId: true } } },
  });

  const key = ruleDimensionKey({
    productId: data.productId,
    productSpecId: data.productSpecId,
    appliesToAllSales: data.appliesToAllSales,
    salesIds: data.salesIds,
    kind: data.kind,
    value: data.value,
  });

  return existing.some((r) =>
    ruleDimensionKey({
      productId: r.productId,
      productSpecId: r.productSpecId,
      appliesToAllSales: r.appliesToAllSales,
      salesIds: r.salesTargets.map((t) => t.salesId),
      kind: r.kind,
      value: r.value,
    }) === key
  );
}

export function ruleCreateData(data: NormalizedRuleInput) {
  return {
    productId: data.productId,
    productSpecId: data.productSpecId,
    appliesToAllSales: data.appliesToAllSales,
    kind: data.kind,
    value: data.value,
    salesTargets: data.appliesToAllSales
      ? undefined
      : {
          create: data.salesIds.map((salesId) => ({ salesId })),
        },
  };
}

export async function updateRuleWithTargets(
  id: string,
  data: NormalizedRuleInput
) {
  await prisma.$transaction([
    prisma.salesCommissionRuleSales.deleteMany({ where: { ruleId: id } }),
    prisma.salesCommissionRule.update({
      where: { id },
      data: {
        productId: data.productId,
        productSpecId: data.productSpecId,
        appliesToAllSales: data.appliesToAllSales,
        kind: data.kind,
        value: data.value,
        salesTargets: data.appliesToAllSales
          ? undefined
          : {
              create: data.salesIds.map((salesId) => ({ salesId })),
            },
      },
    }),
  ]);

  return prisma.salesCommissionRule.findUniqueOrThrow({
    where: { id },
    include: includeRule,
  });
}
