import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { listSellableSpecs } from "@/lib/inventory";
import {
  inventoryErrorResponse,
  requirePremiumInventoryReader,
} from "@/lib/inventory-api";
import { SPEC_UNIT_LABELS } from "@/lib/constants";

export async function GET() {
  try {
    await requirePremiumInventoryReader();
    const items = await listSellableSpecs();
    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        unitLabel: SPEC_UNIT_LABELS[item.unitType],
      })),
    });
  } catch (error) {
    const inv = inventoryErrorResponse(error);
    if (inv) return apiError(inv.message, inv.status);
    return handleApiError(error);
  }
}
