import type { SpecUnit } from "@/generated/prisma/client";

/** 将规格数量换算为瓶数 */
export function toBottleCount(
  quantity: number,
  bottlesPerUnit = 1
): number {
  return Math.max(0, quantity) * Math.max(1, bottlesPerUnit);
}

export function formatBottleCount(bottles: number): string {
  return `${bottles}瓶`;
}

/** 从规格名称推断瓶数（无 bottlesPerUnit 时的兜底） */
export function inferBottlesPerUnit(specName: string, unitType: SpecUnit): number {
  if (unitType === "BOTTLE") return 1;
  const boxMatch = specName.match(/(\d+)\s*瓶/);
  if (boxMatch) return parseInt(boxMatch[1], 10) || 1;
  if (unitType === "BOX") return 6;
  return 1;
}

export function resolveBottlesPerUnit(
  specName: string,
  unitType: SpecUnit,
  bottlesPerUnit?: number | null
): number {
  if (bottlesPerUnit != null && bottlesPerUnit > 0) return bottlesPerUnit;
  return inferBottlesPerUnit(specName, unitType);
}
