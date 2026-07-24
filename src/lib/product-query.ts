import type { Prisma } from "@/generated/prisma/client";

/** 未软删除的产品 */
export const activeProductWhere: Prisma.ProductWhereInput = {
  deletedAt: null,
};

/** 未软删除的规格 */
export const activeProductSpecWhere: Prisma.ProductSpecWhereInput = {
  deletedAt: null,
};

export const activeSpecsOrderBy = { createdAt: "asc" as const };

/** 产品列表/详情中只加载有效规格（无额外 include 时使用） */
export function activeSpecsInclude() {
  return {
    where: activeProductSpecWhere,
    orderBy: activeSpecsOrderBy,
  };
}

export function isProductActive(product: { deletedAt: Date | null }): boolean {
  return product.deletedAt == null;
}

export function isSpecActive(spec: { deletedAt: Date | null }): boolean {
  return spec.deletedAt == null;
}
