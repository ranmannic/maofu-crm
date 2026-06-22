import type { SessionUser } from "@/lib/auth-types";
import { SPEC_UNIT_LABELS } from "@/lib/constants";
import {
  calcOrderProfit,
  calcProfitMargin,
  formatItemsSummary,
} from "@/lib/order-math";
import { formatPhoneForRole } from "@/lib/phone";

type OrderWithItems = {
  totalAmount: number;
  productCostTotal: number;
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
  const profit = calcOrderProfit(order.totalAmount, order.productCostTotal);
  const profitMargin = calcProfitMargin(order.totalAmount, profit);
  return {
    ...order,
    itemsSummary: formatItemsSummary(order.items, SPEC_UNIT_LABELS),
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
    channel?: { id: string; name: string } | null;
  },
>(customer: T, session: SessionUser) {
  const canViewFullPhone =
    session.role === "ADMIN" ||
    (session.role === "SALES" && customer.salesId === session.id);

  return {
    ...customer,
    phone: formatPhoneForRole(customer.phone, canViewFullPhone),
    phoneFull: canViewFullPhone ? customer.phone : undefined,
    channelName: customer.channel?.name ?? null,
    isDeleted: !!customer.deletedAt,
  };
}
