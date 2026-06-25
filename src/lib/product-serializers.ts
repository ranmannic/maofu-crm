import type { Product, ProductImage, ProductSpec } from "@/generated/prisma/client";
import {
  productMediaUrl,
  shareProductMediaUrl,
  shareSpecMediaUrl,
} from "@/lib/product-media";

type SpecWithProduct = ProductSpec;
type ProductWithRelations = Product & {
  specs: ProductSpec[];
  images?: ProductImage[];
};

function specThumbnailUrl(productId: string, spec: SpecWithProduct) {
  return spec.thumbnailKey
    ? productMediaUrl(productId, spec.thumbnailKey)
    : null;
}

export function serializeSpecForSales(productId: string, spec: SpecWithProduct) {
  return {
    id: spec.id,
    name: spec.name,
    unitType: spec.unitType,
    bottlesPerUnit: spec.bottlesPerUnit,
    price: spec.price,
    description: spec.description,
    thumbnailUrl: specThumbnailUrl(productId, spec),
    retailGuidePrice: spec.retailGuidePrice,
    retailFloorPrice: spec.retailFloorPrice,
    groupGuidePrice: spec.groupGuidePrice,
    groupFloorPrice: spec.groupFloorPrice,
    wholesaleGuidePrice: spec.wholesaleGuidePrice,
    wholesaleFloorPrice: spec.wholesaleFloorPrice,
  };
}

export function serializeSpecForAdmin(productId: string, spec: SpecWithProduct) {
  return {
    ...serializeSpecForSales(productId, spec),
    thumbnailKey: spec.thumbnailKey,
    cost: spec.cost,
  };
}

export function serializeProductForSales(
  product: ProductWithRelations,
  includeShareToken = false
) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    alcoholContent: product.alcoholContent,
    aromaType: product.aromaType,
    origin: product.origin,
    thumbnailKey: product.thumbnailKey,
    thumbnailUrl: product.thumbnailKey
      ? productMediaUrl(product.id, product.thumbnailKey)
      : null,
    shareToken: includeShareToken ? product.shareToken : undefined,
    specs: product.specs.map((s) => serializeSpecForSales(product.id, s)),
    images: (product.images ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({
        id: img.id,
        url: productMediaUrl(product.id, img.storageKey),
        sortOrder: img.sortOrder,
      })),
  };
}

export function serializeProductForAdmin(product: ProductWithRelations) {
  return {
    ...serializeProductForSales(product, true),
    shareToken: product.shareToken,
    specs: product.specs.map((s) => serializeSpecForAdmin(product.id, s)),
    images: (product.images ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({
        id: img.id,
        storageKey: img.storageKey,
        url: productMediaUrl(product.id, img.storageKey),
        sortOrder: img.sortOrder,
      })),
  };
}

export function serializeProductForPublicShare(
  product: ProductWithRelations,
  token: string
) {
  const images = (product.images ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((img) => ({
      id: img.id,
      url: shareProductMediaUrl(token, img.id),
    }));

  const thumbFromKey = product.thumbnailKey
    ? shareProductMediaUrl(token, "thumb")
    : images[0]?.url ?? null;

  return {
    name: product.name,
    description: product.description,
    alcoholContent: product.alcoholContent,
    aromaType: product.aromaType,
    origin: product.origin,
    thumbnailUrl: thumbFromKey,
    images,
    specs: product.specs.map((s) => ({
      id: s.id,
      name: s.name,
      unitType: s.unitType,
      bottlesPerUnit: s.bottlesPerUnit,
      description: s.description,
      thumbnailUrl: s.thumbnailKey
        ? shareSpecMediaUrl(token, s.id)
        : null,
      retailGuidePrice: s.retailGuidePrice,
      retailFloorPrice: s.retailFloorPrice,
    })),
  };
}
