import type { CommissionKind } from "@/generated/prisma/client";

export const GLOBAL_COMMISSION_RULE_ID = "global-commission-default";
export const DEFAULT_GLOBAL_COMMISSION_PERCENT = 3;
export const RULES_COLLAPSED_COUNT = 5;

export interface CommissionRuleInput {
  productId: string;
  productSpecId?: string | null;
  appliesToAllSales: boolean;
  salesIds?: string[];
  kind: CommissionKind;
  value: number;
}

export interface CommissionMatchContext {
  productId: string;
  productSpecId: string;
  salesId: string;
}

export type CommissionRuleRecord = {
  id: string;
  isGlobalDefault: boolean;
  productId: string | null;
  productSpecId: string | null;
  appliesToAllSales: boolean;
  kind: CommissionKind;
  value: number;
  salesTargetIds: string[];
};

function ruleAppliesToSales(
  rule: CommissionRuleRecord,
  salesId: string
): boolean {
  if (rule.appliesToAllSales) return true;
  return rule.salesTargetIds.includes(salesId);
}

export function ruleSpecificityLevel(input: {
  productSpecId: string | null;
  appliesToAllSales: boolean;
}): number {
  let score = 0;
  if (input.productSpecId) score += 10;
  if (!input.appliesToAllSales) score += 1;
  return score;
}

function ruleSpecificity(rule: CommissionRuleRecord): number {
  return ruleSpecificityLevel(rule);
}

function productRulesForContext(
  rules: CommissionRuleRecord[],
  ctx: CommissionMatchContext
): CommissionRuleRecord[] {
  return rules.filter(
    (rule) =>
      !rule.isGlobalDefault &&
      rule.productId === ctx.productId &&
      (!rule.productSpecId || rule.productSpecId === ctx.productSpecId) &&
      ruleAppliesToSales(rule, ctx.salesId)
  );
}

export function findBestCommissionRule(
  rules: CommissionRuleRecord[],
  ctx: CommissionMatchContext
): CommissionRuleRecord | null {
  const candidates = productRulesForContext(rules, ctx);

  if (candidates.length > 0) {
    return candidates.reduce((best, rule) =>
      ruleSpecificity(rule) > ruleSpecificity(best) ? rule : best
    );
  }

  return rules.find((r) => r.isGlobalDefault) ?? null;
}

export function calcCommissionAmount(
  kind: CommissionKind,
  value: number,
  lineAmount: number,
  quantity: number
): number {
  if (kind === "PERCENT") {
    return Math.round(lineAmount * (value / 100) * 100) / 100;
  }
  return Math.round(value * quantity * 100) / 100;
}

export function formatCommissionValue(kind: CommissionKind, value: number): string {
  if (kind === "PERCENT") return `${value}%`;
  return `¥${value}/单位`;
}

export function buildScopeLabel(rule: {
  specName: string | null;
  appliesToAllSales: boolean;
  salesNames: string[];
}): string {
  const specPart = rule.specName ?? "全部规格";
  const salesPart = rule.appliesToAllSales
    ? "全部销售"
    : rule.salesNames.length > 0
      ? rule.salesNames.join("、")
      : "指定销售";
  return `${specPart} · ${salesPart}`;
}

export function ruleScopeKey(input: {
  productId: string | null;
  productSpecId: string | null;
  appliesToAllSales: boolean;
  salesIds: string[];
}) {
  const salesKey = input.appliesToAllSales
    ? "_all_sales"
    : [...input.salesIds].sort().join(",");
  return [
    input.productId ?? "_all_products",
    input.productSpecId ?? "_all_spec",
    salesKey,
  ].join("|");
}

export function ruleDimensionKey(input: {
  productId: string | null;
  productSpecId: string | null;
  appliesToAllSales: boolean;
  salesIds: string[];
  kind: CommissionKind;
  value: number;
}) {
  return [
    ruleScopeKey(input),
    input.kind,
    String(input.value),
  ].join("|");
}

export function scopesOverlap(
  a: {
    productId: string | null;
    productSpecId: string | null;
    appliesToAllSales: boolean;
    salesIds: string[];
  },
  b: {
    productId: string | null;
    productSpecId: string | null;
    appliesToAllSales: boolean;
    salesIds: string[];
  }
): boolean {
  if (a.productId !== b.productId) return false;

  const specOverlap =
    !a.productSpecId ||
    !b.productSpecId ||
    a.productSpecId === b.productSpecId;
  if (!specOverlap) return false;

  if (a.appliesToAllSales || b.appliesToAllSales) return true;
  return a.salesIds.some((id) => b.salesIds.includes(id));
}

export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
