import { prisma } from "@/lib/prisma";
import { getCustomerLastPrices } from "@/lib/customer-last-prices";

export interface CustomerPricePolicyRow {
  productSpecId: string;
  productName: string;
  specName: string;
  standardPrice: number;
  lastPrice: number;
  differsFromStandard: boolean;
  note: string;
}

export async function getCustomerPricePolicy(
  customerId: string
): Promise<CustomerPricePolicyRow[]> {
  const lastPrices = await getCustomerLastPrices(customerId);
  const specIds = Object.keys(lastPrices);
  if (specIds.length === 0) return [];

  const [specs, notes] = await Promise.all([
    prisma.productSpec.findMany({
      where: { id: { in: specIds } },
      include: { product: { select: { name: true } } },
    }),
    prisma.customerPricePolicyNote.findMany({
      where: { customerId, productSpecId: { in: specIds } },
    }),
  ]);

  const noteMap = Object.fromEntries(
    notes.map((n) => [n.productSpecId, n.note ?? ""])
  );

  return specs
    .map((spec) => {
      const lastPrice = lastPrices[spec.id] ?? spec.price;
      return {
        productSpecId: spec.id,
        productName: spec.product.name,
        specName: spec.name,
        standardPrice: spec.price,
        lastPrice,
        differsFromStandard: lastPrice !== spec.price,
        note: noteMap[spec.id] ?? "",
      };
    })
    .sort((a, b) => {
      const byProduct = a.productName.localeCompare(b.productName, "zh-CN");
      if (byProduct !== 0) return byProduct;
      return a.specName.localeCompare(b.specName, "zh-CN");
    });
}

export async function upsertCustomerPricePolicyNote(
  customerId: string,
  productSpecId: string,
  note: string | null
) {
  const trimmed = note?.trim() ?? "";
  if (!trimmed) {
    await prisma.customerPricePolicyNote.deleteMany({
      where: { customerId, productSpecId },
    });
    return { productSpecId, note: "" };
  }

  const row = await prisma.customerPricePolicyNote.upsert({
    where: {
      customerId_productSpecId: { customerId, productSpecId },
    },
    create: { customerId, productSpecId, note: trimmed },
    update: { note: trimmed },
  });

  return { productSpecId: row.productSpecId, note: row.note ?? "" };
}
