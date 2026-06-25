"use client";

import { useEffect, useState } from "react";
import { Wine, Package, Truck } from "lucide-react";

interface ShareOrder {
  orderNo: string;
  customerName: string;
  customerPhone: string;
  salesName: string;
  orderedAt: string;
  totalAmount: string;
  productAmount: string;
  shippingFee: string;
  otherFee: string;
  paidAmount: string;
  paymentLabel: string;
  shipLabel: string;
  notes: string | null;
  items: {
    productName: string;
    specName: string;
    quantity: number;
    unitLabel: string;
    unitPrice: string;
    isGift: boolean;
  }[];
  shipping: {
    method: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    address: string | null;
    carrier: string | null;
    trackingNo: string | null;
    shippedAt: string | null;
  } | null;
}

export default function ShareOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [order, setOrder] = useState<ShareOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/order/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setOrder(data);
      })
      .catch(() => setError("加载失败"));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-[#8b2e2e]">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#8b7355]">
        加载中…
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-12">
      <header className="text-center pt-8 pb-6 px-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#c9a962]/50 bg-[#2b2620]/5 mb-3">
          <Wine className="h-6 w-6 text-[#8b2e2e]" />
        </div>
        <h1 className="text-sm tracking-[0.3em] text-[#8b7355]">毛府酒庄</h1>
        <p className="text-2xl font-bold mt-4">订单确认单</p>
        <p className="font-mono text-sm text-[#8b7355] mt-1">{order.orderNo}</p>
      </header>

      <div className="mx-4 rounded-2xl bg-white border border-[#e8dfd0] shadow-sm overflow-hidden">
        <div className="bg-[#8b2e2e] text-[#f7f3eb] px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span>{order.customerName}</span>
            <span>{order.customerPhone}</span>
          </div>
          <div className="text-xs opacity-80 mt-1">
            下单 {order.orderedAt} · 销售 {order.salesName}
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[#8b2e2e]">
            <Package className="h-4 w-4" />
            产品明细
          </div>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm border-b border-[#e8dfd0]/80 pb-2 last:border-0">
              <div className="min-w-0 flex-1 pr-2">
                <div className="font-medium">
                  {item.productName} · {item.specName}
                  {item.isGift && (
                    <span className="ml-1 text-xs text-[#8b2e2e]">赠品</span>
                  )}
                </div>
                <div className="text-xs text-[#8b7355]">
                  {item.quantity}{item.unitLabel} × {item.unitPrice}
                </div>
              </div>
            </div>
          ))}

          <div className="pt-2 space-y-1 text-sm">
            <div className="flex justify-between text-[#8b7355]">
              <span>产品金额</span>
              <span>{order.productAmount}</span>
            </div>
            {order.shippingFee !== "¥0.00" && (
              <div className="flex justify-between text-[#8b7355]">
                <span>运费</span>
                <span>{order.shippingFee}</span>
              </div>
            )}
            {order.otherFee !== "¥0.00" && (
              <div className="flex justify-between text-[#8b7355]">
                <span>其它费用</span>
                <span>{order.otherFee}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-[#e8dfd0]">
              <span>订单总额</span>
              <span className="text-[#8b2e2e]">{order.totalAmount}</span>
            </div>
            <div className="flex justify-between text-xs text-[#8b7355]">
              <span>收款状态 · {order.paymentLabel}</span>
              <span>已收 {order.paidAmount}</span>
            </div>
          </div>
        </div>
      </div>

      {order.shipping && (
        <div className="mx-4 mt-4 rounded-2xl bg-white border border-[#e8dfd0] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[#8b2e2e] mb-2">
            <Truck className="h-4 w-4" />
            发货信息 · {order.shipLabel}
          </div>
          {order.shipping.method && (
            <p className="text-sm">方式：{order.shipping.method}</p>
          )}
          {order.shipping.recipientName && (
            <p className="text-sm mt-1">
              收件：{order.shipping.recipientName} {order.shipping.recipientPhone}
            </p>
          )}
          {order.shipping.address && (
            <p className="text-sm text-[#5c5348] mt-1">{order.shipping.address}</p>
          )}
          {order.shipping.trackingNo && (
            <p className="text-sm mt-2 font-mono">
              {order.shipping.carrier} {order.shipping.trackingNo}
            </p>
          )}
        </div>
      )}

      {order.notes && (
        <p className="mx-4 mt-4 text-sm text-[#5c5348] bg-[#e8dfd0]/40 rounded-xl p-3">
          备注：{order.notes}
        </p>
      )}

      <footer className="text-center text-xs text-[#8b7355] mt-10">
        毛府酒庄 · 感谢您的信任
      </footer>
    </div>
  );
}
