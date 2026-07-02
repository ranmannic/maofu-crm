"use client";

interface SellableItem {
  id: string;
  productName: string;
  specName: string;
  unitLabel: string;
  stockConfigured: boolean;
  maxSellable: number | null;
}

function SellableQty({ item }: { item: SellableItem }) {
  if (!item.stockConfigured) {
    return <span className="text-muted font-normal">尚未配置</span>;
  }
  return (
    <span className="font-semibold text-wine whitespace-nowrap">
      {item.maxSellable} {item.unitLabel}
    </span>
  );
}

export function SellableSpecsList({ items }: { items: SellableItem[] }) {
  return (
    <>
      <ul className="md:hidden divide-y divide-border/50">
        {items.map((s) => (
          <li
            key={s.id}
            className="flex items-start justify-between gap-2 py-2 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug line-clamp-2">
                {s.productName}
              </p>
              <p className="text-xs text-muted mt-0.5 line-clamp-1">{s.specName}</p>
            </div>
            <div className="shrink-0 text-sm text-right max-w-[38%]">
              <SellableQty item={s} />
            </div>
          </li>
        ))}
      </ul>

      <table className="hidden md:table w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted">
            <th className="pb-2 font-medium">产品</th>
            <th className="pb-2 font-medium">规格</th>
            <th className="pb-2 font-medium text-right">最大可售数</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-b border-border/50">
              <td className="py-2.5">{s.productName}</td>
              <td className="py-2.5">{s.specName}</td>
              <td className="py-2.5 text-right">
                <SellableQty item={s} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export type { SellableItem };
