import type { SessionUser } from "@/lib/auth-types";
import { SPEC_UNIT_LABELS } from "@/lib/constants";
import {
  calcOrderProfit,
  calcPerformanceAmount,
  calcProfitMargin,
  formatItemsSummary,
} from "@/lib/order-math";
import { formatPhoneForRole } from "@/lib/phone";

type OrderWithItems = {
  totalAmount: number;
  productCostTotal: number;
  shippingFee?: number;
  otherFee?: number;
  deletedAt?: Date | null;
  items: {
    productName: string;
    quantity: number;
    unitType: string;
  }[];
};

export function enrichOrderForList<T extends OrderWithItems>(
  order: T,
  isAdmin: boolean
) {
  const shippingFee = order.shippingFee ?? 0;
  const otherFee = order.otherFee ?? 0;
  const performanceAmount = calcPerformanceAmount(
    order.totalAmount,
    shippingFee,
    otherFee
  );
  const profit = calcOrderProfit(
    order.totalAmount,
    order.productCostTotal,
    shippingFee,
    otherFee
  );
  const profitMargin = calcProfitMargin(performanceAmount, profit);

  const { productCostTotal, ...rest } = order;

  return {
    ...rest,
    itemsSummary: formatItemsSummary(order.items, SPEC_UNIT_LABELS),
    performanceAmount,
    isDeleted: !!order.deletedAt,
    productCostTotal: isAdmin ? productCostTotal : undefined,
    profit: isAdmin ? profit : undefined,
    profitMargin: isAdmin ? profitMargin : undefined,
  };
}

export function serializeCustomer<
  T extends {
    id: string;
    phone: string | null;
    salesId: string;
    deletedAt: Date | null;
    channel?: {
      id: string;
      name: string;
      parent?: { id: string; name: string } | null;
    } | null;
  },
>(customer: T, session: SessionUser) {
  const canViewFullPhone =
    session.role === "ADMIN" ||
    (session.role === "SALES" && customer.salesId === session.id);

  const channelLabel = customer.channel
    ? customer.channel.parent
      ? `${customer.channel.parent.name} / ${customer.channel.name}`
      : customer.channel.name
    : null;

  return {
    ...customer,
    phone: formatPhoneForRole(customer.phone, canViewFullPhone),
    phoneFull: canViewFullPhone ? customer.phone : undefined,
    channelName: channelLabel,
    isDeleted: !!customer.deletedAt,
  };
}
