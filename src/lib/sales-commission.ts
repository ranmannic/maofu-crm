import type { CommissionKind } from "@/generated/prisma/client";

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
  productId: string;
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

function ruleSpecificity(rule: CommissionRuleRecord): number {
  let score = 0;
  if (rule.productSpecId) score += 10;
  if (!rule.appliesToAllSales) score += 1;
  return score;
}

export function findBestCommissionRule(
  rules: CommissionRuleRecord[],
  ctx: CommissionMatchContext
): CommissionRuleRecord | null {
  const candidates = rules.filter(
    (rule) =>
      rule.productId === ctx.productId &&
      (!rule.productSpecId || rule.productSpecId === ctx.productSpecId) &&
      ruleAppliesToSales(rule, ctx.salesId)
  );

  if (candidates.length === 0) return null;

  return candidates.reduce((best, rule) =>
    ruleSpecificity(rule) > ruleSpecificity(best) ? rule : best
  );
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

export function ruleDimensionKey(input: {
  productId: string;
  productSpecId: string | null;
  appliesToAllSales: boolean;
  salesIds: string[];
  kind: CommissionKind;
  value: number;
}) {
  const salesKey = input.appliesToAllSales
    ? "_all_sales"
    : [...input.salesIds].sort().join(",");
  return [
    input.productId,
    input.productSpecId ?? "_all_spec",
    salesKey,
    input.kind,
    String(input.value),
  ].join("|");
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
