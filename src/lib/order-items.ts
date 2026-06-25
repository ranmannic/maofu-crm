/** 非赠品同一规格不可重复；赠品允许重复 */
export function validateNonGiftDuplicateItems(
  items: { productSpecId: string; isGift?: boolean }[]
): string | null {
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.productSpecId || item.isGift) continue;
    if (seen.has(item.productSpecId)) {
      return "重复产品：同一规格的非赠品不能重复添加，赠品可重复";
    }
    seen.add(item.productSpecId);
  }
  return null;
}
