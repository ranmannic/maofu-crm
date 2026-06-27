"use client";

import { useCallback, useState } from "react";
import { useEdition } from "@/components/edition/edition-provider";
import { ShareLinkModal } from "@/components/share/share-link-modal";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { resolveShareUrl } from "@/lib/share-url";

interface ShareModalState {
  open: boolean;
  url: string;
  title: string;
  hint?: string;
  copied: boolean;
}

export function useShareLink() {
  const { isPremiumActive } = useEdition();
  const [sharing, setSharing] = useState(false);
  const [modal, setModal] = useState<ShareModalState>({
    open: false,
    url: "",
    title: "分享链接",
    copied: false,
  });

  const closeModal = useCallback(() => {
    setModal((m) => ({ ...m, open: false }));
  }, []);

  const openShareModal = useCallback(
    async (options: {
      apiUrl: string;
      title: string;
      hint?: string;
      kind: "order" | "product";
    }) => {
      setSharing(true);
      try {
        const res = await fetch(options.apiUrl, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "生成分享链接失败");
          return;
        }
        const url = resolveShareUrl(data, options.kind);
        const copied = await copyToClipboard(url);
        setModal({
          open: true,
          url,
          title: options.title,
          hint: options.hint,
          copied,
        });
      } catch {
        alert("分享失败");
      } finally {
        setSharing(false);
      }
    },
    []
  );

  const shareOrder = useCallback(
    (orderId: string) =>
      openShareModal({
        apiUrl: `/api/orders/${orderId}/share`,
        title: "分享订单",
        hint: "分享页不含成本、毛利；客户手机号已脱敏显示",
        kind: "order",
      }),
    [openShareModal]
  );

  const shareProduct = useCallback(
    (productId: string, productName?: string) =>
      openShareModal({
        apiUrl: `/api/products/${productId}/share`,
        title: productName ? `分享 · ${productName}` : "分享产品",
        hint: "客户分享链接不含成本与内部销售价，仅展示零售价格体系",
        kind: "product",
      }),
    [openShareModal]
  );

  const shareModal = (
    <ShareLinkModal
      open={modal.open}
      onClose={closeModal}
      url={modal.url}
      title={modal.title}
      hint={modal.hint}
      isPremium={isPremiumActive}
      initialCopied={modal.copied}
    />
  );

  return { sharing, shareOrder, shareProduct, shareModal, openShareModal };
}
