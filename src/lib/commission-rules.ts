import { prisma } from "@/lib/prisma";
import {
  buildScopeLabel,
  DEFAULT_GLOBAL_COMMISSION_PERCENT,
  GLOBAL_COMMISSION_RULE_ID,
  ruleDimensionKey,
  ruleSpecificityLevel,
  scopesOverlap,
} from "@/lib/sales-commission";

export const includeRule = {
  product: { select: { name: true } },
  productSpec: { select: { name: true } },
  salesTargets: {
    include: { sales: { select: { id: true, name: true } } },
  },
} as const;

export type RuleWithRelations = NonNullable<
  Awaited<ReturnType<typeof prisma.salesCommissionRule.findFirst>>
> & {
  product: { name: string } | null;
  productSpec: { name: string } | null;
  salesTargets: { salesId: string; sales: { id: string; name: string } }[];
};

export function serializeRule(rule: RuleWithRelations) {
  const specName = rule.productSpec?.name ?? null;
  const salesNames = rule.salesTargets.map((t) => t.sales.name);
  const salesIds = rule.salesTargets.map((t) => t.salesId);

  return {
    id: rule.id,
    isGlobalDefault: rule.isGlobalDefault,
    productId: rule.productId,
    productName: rule.isGlobalDefault ? "所有产品" : (rule.product?.name ?? "—"),
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
  productId: string | null;
  productSpecId: string | null;
  appliesToAllSales: boolean;
  salesIds: string[];
  kind: "PERCENT" | "FIXED";
  value: number;
}

export function normalizeRuleInput(body: {
  productId?: string | null;
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
    productId: body.productId || null,
    productSpecId: body.productSpecId || null,
    appliesToAllSales: body.appliesToAllSales,
    salesIds,
    kind: body.kind,
    value: body.value,
  };
}

/** 确保全局默认规则存在（所有产品 · 全部规格 · 全部销售 · 3%） */
export async function ensureGlobalDefaultRule() {
  const existing = await prisma.salesCommissionRule.findFirst({
    where: { isGlobalDefault: true },
  });
  if (existing) return existing;

  return prisma.salesCommissionRule.create({
    data: {
      id: GLOBAL_COMMISSION_RULE_ID,
      isGlobalDefault: true,
      productId: null,
      productSpecId: null,
      appliesToAllSales: true,
      kind: "PERCENT",
      value: DEFAULT_GLOBAL_COMMISSION_PERCENT,
    },
  });
}

export async function validateRuleInput(
  data: NormalizedRuleInput,
  options?: { isGlobalDefault?: boolean }
): Promise<string | null> {
  if (options?.isGlobalDefault) {
    if (data.kind === "PERCENT" && data.value > 100) {
      return "百分比提成不能超过 100%";
    }
    return null;
  }

  if (!data.productId) return "请选择产品";

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

export interface RuleConflictResult {
  error?: string;
  warning?: string;
}

export async function validateRuleConflict(
  data: NormalizedRuleInput,
  excludeId?: string
): Promise<RuleConflictResult> {
  const existing = await prisma.salesCommissionRule.findMany({
    where: excludeId ? { NOT: { id: excludeId } } : undefined,
    include: { salesTargets: { select: { salesId: true } } },
  });

  const incoming = {
    productId: data.productId,
    productSpecId: data.productSpecId,
    appliesToAllSales: data.appliesToAllSales,
    salesIds: data.salesIds,
    kind: data.kind,
    value: data.value,
  };

  const warnings: string[] = [];

  for (const rule of existing) {
    if (rule.isGlobalDefault) continue;

    const existingScope = {
      productId: rule.productId,
      productSpecId: rule.productSpecId,
      appliesToAllSales: rule.appliesToAllSales,
      salesIds: rule.salesTargets.map((t) => t.salesId),
      kind: rule.kind,
      value: rule.value,
    };

    const incomingFull = {
      productId: incoming.productId,
      productSpecId: incoming.productSpecId,
      appliesToAllSales: incoming.appliesToAllSales,
      salesIds: incoming.salesIds,
      kind: incoming.kind,
      value: incoming.value,
    };

    if (ruleDimensionKey(incomingFull) === ruleDimensionKey(existingScope)) {
      return { error: "已存在相同维度的提成规则，请勿重复创建" };
    }

    if (!scopesOverlap(incomingFull, existingScope)) {
      continue;
    }

    const incomingSpec = ruleSpecificityLevel(incomingFull);
    const existingSpec = ruleSpecificityLevel(existingScope);

    if (incomingSpec !== existingSpec) {
      warnings.push(
        "与已有规则范围重叠（规格/销售粒度不同）：匹配时更细规则优先，可继续保存"
      );
      continue;
    }

    const sameTerms =
      rule.kind === incoming.kind && rule.value === incoming.value;
    if (sameTerms) {
      return { error: "适用范围与已有规则重叠，且提成方式相同，属于重复规则" };
    }

    return {
      error: "适用范围与已有规则重叠且提成设置不同，请调整范围或统一提成后再保存",
    };
  }

  const warning = [...new Set(warnings)].join("；") || undefined;
  return warning ? { warning } : {};
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

export async function updateGlobalDefaultValue(id: string, value: number) {
  return prisma.salesCommissionRule.update({
    where: { id },
    data: { value },
    include: includeRule,
  });
}

export function sortSerializedRules<
  T extends { isGlobalDefault: boolean; productName: string; scopeLabel: string }
>(rules: T[]): T[] {
  const global = rules.filter((r) => r.isGlobalDefault);
  const others = rules
    .filter((r) => !r.isGlobalDefault)
    .sort((a, b) => {
      const byProduct = a.productName.localeCompare(b.productName, "zh-CN");
      if (byProduct !== 0) return byProduct;
      return a.scopeLabel.localeCompare(b.scopeLabel, "zh-CN");
    });
  return [...global, ...others];
}
