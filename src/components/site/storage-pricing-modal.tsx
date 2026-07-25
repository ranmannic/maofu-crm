"use client";

import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";

export function StoragePricingModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="购买更多服务器空间">
      <div className="space-y-3 text-sm">
        <p>当前高级版基础空间上限为 1GB，可按需追加服务器空间。</p>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">额外空间</span>
            <span className="text-wine font-semibold">¥20 / GB / 年</span>
          </div>
          <p className="mt-2 text-muted">
            适合产品图片、订单凭证、网站图标等上传文件持续增长的场景。
          </p>
        </div>
        <p className="text-muted">
          如需扩容，请联系商务或实施人员登记购买。
        </p>
      </div>
      <ModalFooter>
        <Button onClick={onClose}>我知道了</Button>
      </ModalFooter>
    </Modal>
  );
}
