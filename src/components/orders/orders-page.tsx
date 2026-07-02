"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, History, Search, Trash2, RotateCcw, Wallet, Truck, Paperclip, Share2, MessageSquare, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input, Label, Select, Textarea, QtyInput } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { FilterField } from "@/components/ui/filter-field";
import { DEFAULT_PAGE_SIZE, SPEC_UNIT_LABELS, SHIPPING_METHOD_OPTIONS, SHIPPING_METHOD_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { formatShippingAddress } from "@/lib/address-parse";
import { calcReconcilePaidAmount, calcCreateReconcilePaidAmount, allProductsFullyReconciled } from "@/lib/reconcile-ui";
import { validateNonGiftDuplicateItems } from "@/lib/order-items";
import { OrderVouchersPanel } from "@/components/orders/order-vouchers-panel";
import { useShareLink } from "@/hooks/use-share-link";
import { useAppNavigation } from "@/hooks/use-app-navigation";
import {
  useListPageSnapshot,
  useRestoreListPageScroll,
} from "@/hooks/use-saved-list-page-state";
import type { SessionUser } from "@/lib/auth-types";
import type { SpecUnit } from "@/generated/prisma/client";

interface AuditLog {
  id: string;
  userName: string;
  action: string;
  changes: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  productAmount?: number;
  shippingFee?: number;
  otherFee?: number;
  calculatedAmount: number;
  totalAmount: number;
  amountAdjustReason: string | null;
  productCostTotal?: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  isPaid: boolean;
  paidAmount: number;
  isShipped: boolean;
  orderedAt: string;
  paidAt: string | null;
  notes: string | null;
  profit?: number;
  profitMargin?: number;
  performanceAmount?: number;
  itemsSummary?: string;
  sales: { id: string; name: string };
  handler: { id: string; name: string } | null;
  items: {
    id: string;
    productName: string;
    specName: string;
    unitType: SpecUnit;
    quantity: number;
    unitPrice: number;
    isGift?: boolean;
  }[];
  shipping: {
    method?: "PICKUP" | "SELF_DELIVERY" | "EXPRESS" | "LOGISTICS" | null;
    recipientName?: string | null;
    recipientPhone?: string | null;
    province?: string | null;
    city?: string | null;
    county?: string | null;
    carrier: string | null;
    trackingNo: string | null;
    address: string | null;
    shippedAt: string | null;
    notes: string | null;
  } | null;
  auditLogs?: AuditLog[];
  isDeleted?: boolean;
  deletedAt?: string | null;
  refundStatus?: "NONE" | "PARTIAL" | "FULL";
  refundAmount?: number;
  refundedAt?: string | null;
  creditLines?: {
    orderItemId: string;
    unreconciledQty: number;
    reconciledQty: number;
  }[];
}

interface Customer { id: string; name: string }

interface CustomerShippingAddress {
  id: string;
  name: string;
  phone: string;
  province: string | null;
  city: string | null;
  county: string | null;
  address: string;
  isDefault: boolean;
}
interface Product {
  id: string;
  name: string;
  specs: { id: string; name: string; price: number; unitType: SpecUnit }[];
}
interface OpsUser { id: string; name: string }

function paymentNeedsReconcile(
  order: Pick<Order, "paymentStatus" | "paidAmount">,
  newStatus: "UNPAID" | "PARTIAL" | "PAID"
) {
  if (newStatus === "PARTIAL") return true;
  if (newStatus === "PAID" && order.paymentStatus === "PARTIAL") return true;
  return false;
}

function getPaymentBadge(order: Order) {
  if (order.paymentStatus === "PAID" || order.isPaid) {
    return { variant: "success" as const, label: "已收" };
  }
  if (order.paymentStatus === "PARTIAL" || order.paidAmount > 0) {
    return { variant: "wine" as const, label: "部分收" };
  }
  return { variant: "warning" as const, label: "未收" };
}

const ORDERS_ROUTE_KEY = "/orders";

interface OrdersPageState {
  page: number;
  appliedFilters: typeof emptyOrderFilters;
  appliedShowDeleted: boolean;
  filterDraft: typeof emptyOrderFilters;
  draftShowDeleted: boolean;
  orders?: Order[];
  total?: number;
  totalPages?: number;
  scrollY?: number;
}

const emptyOrderFilters = {
  customer: "",
  sales: "",
  orderNo: "",
  orderedStart: "",
  orderedEnd: "",
  paidStart: "",
  paidEnd: "",
  isPaid: "",
  paymentStatus: "",
  isShipped: "",
  showDeleted: "",
};

export function OrdersPage({
  user,
  variant = "default",
  initialCustomerId,
  returnTo,
}: {
  user: SessionUser;
  variant?: "default" | "create";
  initialCustomerId?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const { goBack } = useAppNavigation();
  const { shareOrder, shareModal } = useShareLink();
  const isCreateOnly = variant === "create";
  const createBackTarget = returnTo || "/orders";
  const createSuccessTarget =
    returnTo || `/customers/${initialCustomerId || ""}`;
  const createInitialized = useRef(false);
  const canCreate = ["SALES", "ADMIN"].includes(user.role);
  const canDelete = ["SALES", "ADMIN"].includes(user.role);
  const canManageOps = ["OPERATIONS", "ADMIN"].includes(user.role);
  const isAdmin = user.role === "ADMIN";
  const canExportOrders = isAdmin || canManageOps;

  const snapshot = useListPageSnapshot<OrdersPageState>(
    isCreateOnly ? "__skip__" : ORDERS_ROUTE_KEY
  );
  const saved = isCreateOnly ? undefined : snapshot?.data;
  const restoreOnMount = useRef(!isCreateOnly && saved?.orders !== undefined);

  const [orders, setOrders] = useState<Order[]>(() => saved?.orders ?? []);
  const [loading, setLoading] = useState(
    () => !isCreateOnly && saved?.orders === undefined
  );
  const [page, setPage] = useState(() => saved?.page ?? 1);
  const [total, setTotal] = useState(() => saved?.total ?? 0);
  const [totalPages, setTotalPages] = useState(() => saved?.totalPages ?? 1);

  const [appliedFilters, setAppliedFilters] = useState(
    () => saved?.appliedFilters ?? emptyOrderFilters
  );
  const [filterDraft, setFilterDraft] = useState(
    () => saved?.filterDraft ?? { ...emptyOrderFilters }
  );
  const [draftShowDeleted, setDraftShowDeleted] = useState(
    () => saved?.draftShowDeleted ?? false
  );
  const [appliedShowDeleted, setAppliedShowDeleted] = useState(
    () => saved?.appliedShowDeleted ?? false
  );

  useRestoreListPageScroll(
    ORDERS_ROUTE_KEY,
    isCreateOnly ? undefined : snapshot?.scrollY,
    !isCreateOnly && !loading
  );

  const isSales = user.role === "SALES";

  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [voucherOrder, setVoucherOrder] = useState<Order | null>(null);
  const [notesPreview, setNotesPreview] = useState<{
    orderNo: string;
    notes: string;
  } | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [opsUsers, setOpsUsers] = useState<OpsUser[]>([]);

  const [createForm, setCreateForm] = useState({
    customerId: "",
    handlerId: "",
    notes: "",
    shippingFee: 0,
    otherFee: 0,
    totalAmount: 0,
    amountAdjustReason: "",
    shippingMethod: "PICKUP" as "PICKUP" | "SELF_DELIVERY" | "EXPRESS" | "LOGISTICS" | "ON_SITE_STOCKING",
    shippingAddressId: "",
    items: [{ productSpecId: "", quantity: 1, isGift: false, unitPrice: 0, priceFromLastPurchase: false }],
  });
  const [customerAddresses, setCustomerAddresses] = useState<CustomerShippingAddress[]>([]);
  const [customerLastPrices, setCustomerLastPrices] = useState<Record<string, number>>({});
  const [productAmountPreview, setProductAmountPreview] = useState(0);
  const [calculatedPreview, setCalculatedPreview] = useState(0);

  const [createReconcileQty, setCreateReconcileQty] = useState<Record<number, number>>({});
  const [createPaymentForm, setCreatePaymentForm] = useState({
    paymentStatus: "UNPAID" as "UNPAID" | "PARTIAL" | "PAID",
    paidAmount: 0,
    paidAt: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    paymentStatus: "UNPAID" as "UNPAID" | "PARTIAL" | "PAID",
    paidAmount: 0,
    paidAt: "",
  });
  const [reconcileQty, setReconcileQty] = useState<Record<string, number>>({});
  const [shippingForm, setShippingForm] = useState({
    isShipped: false, carrier: "", trackingNo: "", address: "", shippedAt: "", notes: "",
  });
  const [editTotalAmount, setEditTotalAmount] = useState(0);
  const [editAmountReason, setEditAmountReason] = useState("");
  const [refundForm, setRefundForm] = useState({
    refundStatus: "NONE" as "NONE" | "PARTIAL" | "FULL",
    refundAmount: 0,
    refundedAt: "",
  });

  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [shippingError, setShippingError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadOrders = useCallback(async () => {
    const silent = restoreOnMount.current;
    if (restoreOnMount.current) restoreOnMount.current = false;
    if (!silent) setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    Object.entries(appliedFilters).forEach(([k, v]) => { if (v) params.set(k, v); });
    if (appliedShowDeleted) params.set("showDeleted", "true");

    const res = await fetch(`/api/orders?${params}`);
    if (res.ok) {
      const json = await res.json();
      setOrders(json.data);
      setTotal(json.pagination.total);
      setTotalPages(json.pagination.totalPages);
    }
    setLoading(false);
  }, [page, appliedFilters, appliedShowDeleted]);

  useEffect(() => { if (!isCreateOnly) loadOrders(); }, [loadOrders, isCreateOnly]);

  function openNotesPreview(order: Order) {
    if (!order.notes?.trim()) return;
    setNotesPreview({ orderNo: order.orderNo, notes: order.notes.trim() });
  }

  function renderNotesBadge(order: Order) {
    if (!order.notes?.trim()) return null;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openNotesPreview(order);
        }}
        className="inline-flex items-center gap-0.5 text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-[10px] font-sans font-medium active:bg-amber-100"
      >
        <MessageSquare className="h-3 w-3 shrink-0" />
        有备注
      </button>
    );
  }

  function handleSearch() {
    setAppliedFilters({ ...filterDraft });
    setAppliedShowDeleted(draftShowDeleted);
    setPage(1);
  }

  function handleResetFilters() {
    setFilterDraft({ ...emptyOrderFilters });
    setAppliedFilters({ ...emptyOrderFilters });
    setDraftShowDeleted(false);
    setAppliedShowDeleted(false);
    setPage(1);
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      Object.entries(appliedFilters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      if (appliedShowDeleted) params.set("showDeleted", "true");

      const res = await fetch(`/api/orders/export?${params}`);
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "导出失败");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const fileName = match
        ? decodeURIComponent(match[1])
        : `订单导出_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function getAllSpecs() {
    return products.flatMap((p) =>
      p.specs.map((s) => ({
        id: s.id,
        label: `${p.name} - ${s.name} (${formatCurrency(s.price)}/${SPEC_UNIT_LABELS[s.unitType]})`,
        productId: p.id,
        price: s.price,
        unitType: s.unitType,
      }))
    );
  }

  function calcFromItems(items: typeof createForm.items) {
    return items.reduce((sum, item) => {
      if (item.isGift) return sum;
      if (!item.productSpecId) return sum;
      return sum + item.unitPrice * item.quantity;
    }, 0);
  }

  function resolveItemUnitPrice(
    specId: string,
    isGift: boolean,
    lastPrices: Record<string, number>
  ) {
    if (isGift || !specId) {
      return { unitPrice: 0, priceFromLastPurchase: false };
    }
    const spec = getAllSpecs().find((s) => s.id === specId);
    if (!spec) return { unitPrice: 0, priceFromLastPurchase: false };
    const last = lastPrices[specId];
    if (last != null && last !== spec.price) {
      return { unitPrice: last, priceFromLastPurchase: true };
    }
    return { unitPrice: spec.price, priceFromLastPurchase: false };
  }

  function buildCreateSpecPrices() {
    const map = new Map(getAllSpecs().map((s) => [s.id, s.price]));
    createForm.items.forEach((item) => {
      if (item.productSpecId) map.set(item.productSpecId, item.unitPrice);
    });
    return map;
  }

  useEffect(() => {
    if (createOpen && products.length > 0) {
      const productAmount = calcFromItems(createForm.items);
      const calc = productAmount + (createForm.shippingFee || 0) + (createForm.otherFee || 0);
      setProductAmountPreview(productAmount);
      setCalculatedPreview(calc);
      if (!createForm.amountAdjustReason) {
        setCreateForm((f) => ({ ...f, totalAmount: calc }));
      }
    }
  }, [createForm.items, createForm.shippingFee, createForm.otherFee, products, createOpen]);

  async function loadCustomerLastPrices(customerId: string) {
    if (!customerId) {
      setCustomerLastPrices({});
      return;
    }
    const res = await fetch(`/api/customers/${customerId}/last-prices`);
    const prices = res.ok ? ((await res.json()) as Record<string, number>) : {};
    setCustomerLastPrices(prices);
    setCreateForm((f) => ({
      ...f,
      items: f.items.map((item) => {
        const resolved = resolveItemUnitPrice(
          item.productSpecId,
          item.isGift,
          prices
        );
        return { ...item, ...resolved };
      }),
    }));
  }

  async function loadCustomerAddresses(customerId: string) {
    if (!customerId) {
      setCustomerAddresses([]);
      return;
    }
    const res = await fetch(`/api/customers/${customerId}/shipping-addresses`);
    if (res.ok) {
      const addrs: CustomerShippingAddress[] = await res.json();
      setCustomerAddresses(addrs);
      const defaultAddr = addrs.find((a) => a.isDefault) ?? addrs[0];
      setCreateForm((f) => ({
        ...f,
        shippingAddressId: defaultAddr?.id || "",
      }));
    } else {
      setCustomerAddresses([]);
      setCreateForm((f) => ({ ...f, shippingAddressId: "" }));
    }
  }

  useEffect(() => {
    if (createOpen && createForm.customerId) {
      loadCustomerAddresses(createForm.customerId);
      loadCustomerLastPrices(createForm.customerId);
    } else if (createOpen) {
      setCustomerLastPrices({});
    }
  }, [createOpen, createForm.customerId]);

  async function loadCreateData() {
    const [cRes, pRes, uRes] = await Promise.all([
      fetch("/api/customers?pageSize=100"),
      fetch("/api/products"),
      canCreate ? fetch("/api/users?role=OPERATIONS") : Promise.resolve(null),
    ]);
    if (cRes.ok) {
      const j = await cRes.json();
      setCustomers(j.data || j);
    }
    if (pRes.ok) setProducts(await pRes.json());
    if (uRes?.ok) setOpsUsers(await uRes.json());
  }

  function openCreateWithCustomer(customerId: string) {
    setCreateForm({
      customerId,
      handlerId: "",
      notes: "",
      shippingFee: 0,
      otherFee: 0,
      totalAmount: 0,
      amountAdjustReason: "",
      shippingMethod: "PICKUP",
      shippingAddressId: "",
      items: [
        {
          productSpecId: "",
          quantity: 1,
          isGift: false,
          unitPrice: 0,
          priceFromLastPurchase: false,
        },
      ],
    });
    setCustomerAddresses([]);
    setCustomerLastPrices({});
    setCreatePaymentForm({ paymentStatus: "UNPAID", paidAmount: 0, paidAt: "" });
    setCreateReconcileQty({});
    setError("");
    loadCreateData();
    setCreateOpen(true);
  }

  function openCreate() {
    setCreateForm({
      customerId: "", handlerId: "", notes: "",
      shippingFee: 0, otherFee: 0,
      totalAmount: 0, amountAdjustReason: "",
      shippingMethod: "PICKUP",
      shippingAddressId: "",
      items: [{ productSpecId: "", quantity: 1, isGift: false, unitPrice: 0, priceFromLastPurchase: false }],
    });
    setCustomerAddresses([]);
    setCustomerLastPrices({});
    setCreatePaymentForm({ paymentStatus: "UNPAID", paidAmount: 0, paidAt: "" });
    setCreateReconcileQty({});
    setError("");
    loadCreateData();
    setCreateOpen(true);
  }

  useEffect(() => {
    if (isCreateOnly && initialCustomerId && !createInitialized.current) {
      createInitialized.current = true;
      openCreateWithCustomer(initialCustomerId);
    }
  }, [isCreateOnly, initialCustomerId]);

  async function openDetail(order: Order) {
    setError("");
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      const full = await res.json();
      if (!res.ok) {
        alert(full.error || "无法加载订单详情");
        return;
      }
      setSelected(full);
      setEditTotalAmount(full.totalAmount);
      setEditAmountReason("");
      setRefundForm({
        refundStatus: full.refundStatus || "NONE",
        refundAmount: full.refundAmount ?? 0,
        refundedAt: full.refundedAt ? String(full.refundedAt).slice(0, 16) : "",
      });
      setDetailOpen(true);
    } catch {
      alert("无法加载订单详情，请稍后重试");
    }
  }

  function fillShippingForm(full: Order) {
    setShippingForm({
      isShipped: full.isShipped,
      carrier: full.shipping?.carrier || "",
      trackingNo: full.shipping?.trackingNo || "",
      address: full.shipping?.address || "",
      shippedAt: full.shipping?.shippedAt ? String(full.shipping.shippedAt).slice(0, 16) : "",
      notes: full.shipping?.notes || "",
    });
  }

  async function openShipping(order: Order) {
    setShippingError("");
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      const full = await res.json();
      if (!res.ok) {
        alert(full.error || "无法加载订单");
        return;
      }
      setShippingOrder(full);
      fillShippingForm(full);
      setShipModalOpen(true);
    } catch {
      alert("无法加载订单，请稍后重试");
    }
  }

  function openVouchers(order: Order) {
    setVoucherOrder(order);
    setVoucherModalOpen(true);
  }

  function updatePaymentReconcileQty(orderItemId: string, quantity: number) {
    if (!paymentOrder) return;
    const nextQty = { ...reconcileQty, [orderItemId]: quantity };
    setReconcileQty(nextQty);
    if (paymentForm.paymentStatus === "PARTIAL") {
      setPaymentForm((prev) => ({
        ...prev,
        paidAmount: calcReconcilePaidAmount(
          paymentOrder.items,
          paymentOrder.paidAmount,
          nextQty
        ),
      }));
    }
  }

  function updateCreateReconcileQty(itemIndex: number, quantity: number) {
    const nextQty = { ...createReconcileQty, [itemIndex]: quantity };
    setCreateReconcileQty(nextQty);
    if (createPaymentForm.paymentStatus === "PARTIAL") {
      const specPrices = buildCreateSpecPrices();
      setCreatePaymentForm((prev) => ({
        ...prev,
        paidAmount: calcCreateReconcilePaidAmount(
          createForm.items,
          specPrices,
          nextQty
        ),
      }));
    }
  }

  async function handleShippingSave() {
    if (!shippingOrder) return;
    setSaving(true);
    setShippingError("");
    const res = await fetch(`/api/orders/${shippingOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shipping: {
          ...shippingForm,
          shippedAt: shippingForm.shippedAt || undefined,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setShippingError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setShipModalOpen(false);
    setShippingOrder(null);
    if (detailOpen && selected?.id === shippingOrder.id) {
      setSelected(data);
    }
    await loadOrders();
    setSaving(false);
  }

  async function openPayment(order: Order) {
    setPaymentError("");
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      const full = await res.json();
      if (!res.ok) {
        alert(full.error || "无法加载订单");
        return;
      }
      setPaymentOrder(full);
      setPaymentForm({
        paymentStatus:
          full.paymentStatus ||
          (full.isPaid ? "PAID" : full.paidAmount > 0 ? "PARTIAL" : "UNPAID"),
        paidAmount: full.paidAmount,
        paidAt: full.paidAt ? String(full.paidAt).slice(0, 16) : "",
      });
      const rq: Record<string, number> = {};
      (full.items || []).forEach((item: { id: string }) => {
        rq[item.id] = 0;
      });
      setReconcileQty(rq);
      setPayModalOpen(true);
    } catch {
      alert("无法加载订单，请稍后重试");
    }
  }

  async function handlePaymentSave() {
    if (!paymentOrder) return;
    setSaving(true);
    setPaymentError("");

    const body: Record<string, unknown> = {
      payment: {
        ...paymentForm,
        paidAt: paymentForm.paidAt || undefined,
      },
    };

    const needsReconcile = paymentNeedsReconcile(
      paymentOrder,
      paymentForm.paymentStatus
    );
    if (needsReconcile && paymentForm.paymentStatus !== "UNPAID") {
      body.reconcileItems = Object.entries(reconcileQty)
        .filter(([, q]) => q > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    }

    if (paymentForm.paidAmount <= 0 && Array.isArray(body.reconcileItems) && body.reconcileItems.length > 0) {
      setPaymentError("未付款时不可核销产品数量");
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/orders/${paymentOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setPaymentError(data.error || "保存失败");
      setSaving(false);
      return;
    }
    setPayModalOpen(false);
    setPaymentOrder(null);
    if (detailOpen && selected?.id === paymentOrder.id) {
      setSelected(data);
    }
    await loadOrders();
    setSaving(false);
  }

  async function handleCreate() {
    setSaving(true);
    setError("");

    if (
      createForm.shippingMethod !== "PICKUP" &&
      createForm.shippingMethod !== "ON_SITE_STOCKING" &&
      !createForm.shippingAddressId
    ) {
      setError("请选择客户收货地址，或先在客户管理中维护收货信息");
      setSaving(false);
      return;
    }

    const specs = getAllSpecs();
    const items = createForm.items
      .filter((i) => i.productSpecId)
      .map((i) => ({
        productId: specs.find((s) => s.id === i.productSpecId)!.productId,
        productSpecId: i.productSpecId,
        quantity: i.quantity,
        isGift: i.isGift,
        unitPrice: i.isGift ? 0 : i.unitPrice,
      }));

    const duplicateError = validateNonGiftDuplicateItems(items);
    if (duplicateError) {
      setError(duplicateError);
      setSaving(false);
      return;
    }

    const body: Record<string, unknown> = {
      customerId: createForm.customerId,
      handlerId: createForm.handlerId || undefined,
      notes: createForm.notes || undefined,
      shippingFee: createForm.shippingFee || 0,
      otherFee: createForm.otherFee || 0,
      delivery: {
        method: createForm.shippingMethod,
        addressId:
          createForm.shippingMethod !== "PICKUP" &&
          createForm.shippingMethod !== "ON_SITE_STOCKING"
            ? createForm.shippingAddressId
            : undefined,
      },
      items,
    };

    if (createForm.totalAmount !== calculatedPreview) {
      body.totalAmount = createForm.totalAmount;
      body.amountAdjustReason = createForm.amountAdjustReason;
    }

    if (canManageOps && createPaymentForm.paymentStatus !== "UNPAID") {
      body.payment = {
        ...createPaymentForm,
        paidAt: createPaymentForm.paidAt || undefined,
      };
      if (createPaymentForm.paymentStatus === "PARTIAL") {
        body.reconcileItems = createForm.items
          .map((i, idx) => ({
            itemIndex: idx,
            quantity: createReconcileQty[idx] ?? 0,
          }))
          .filter((i) => i.quantity > 0);
      }
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "创建失败");
      setSaving(false);
      return;
    }
    setCreateOpen(false);
    if (isCreateOnly) {
      goBack(createSuccessTarget || "/orders");
      setSaving(false);
      return;
    }
    await loadOrders();
    setSaving(false);
  }

  async function handleUpdateOps() {
    if (!selected) return;
    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {};
    const selectedRefundedAt = selected.refundedAt
      ? String(selected.refundedAt).slice(0, 16)
      : "";
    const refundChanged =
      refundForm.refundStatus !== (selected.refundStatus || "NONE") ||
      refundForm.refundAmount !== (selected.refundAmount ?? 0) ||
      refundForm.refundedAt !== selectedRefundedAt;
    if (canManageOps && refundChanged) {
      body.refund = {
        ...refundForm,
        refundedAt: refundForm.refundedAt || undefined,
      };
    }
    if (editTotalAmount !== selected.totalAmount) {
      body.totalAmount = editTotalAmount;
      body.amountAdjustReason = editAmountReason;
    }

    if (Object.keys(body).length === 0) {
      setError("没有需要保存的修改");
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/orders/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "更新失败");
      setSaving(false);
      return;
    }
    setSelected(data);
    await loadOrders();
    setDetailOpen(false);
    setSaving(false);
  }

  async function handleDelete(order: Order) {
    if (!confirm(`确定删除订单「${order.orderNo}」？`)) return;
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "删除失败");
      return;
    }
    if (detailOpen && selected?.id === order.id) setDetailOpen(false);
    await loadOrders();
  }

  async function handleRestore(order: Order) {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "恢复失败");
      return;
    }
    await loadOrders();
  }

  const specs = getAllSpecs();

  function getUnitForItem(productSpecId: string) {
    const spec = specs.find((s) => s.id === productSpecId);
    return spec ? SPEC_UNIT_LABELS[spec.unitType] : "";
  }

  function renderOrderActions(o: Order) {
    return (
      <>
        <button onClick={() => openDetail(o)} className="text-wine hover:underline text-xs inline-flex items-center gap-0.5">
          <Eye className="h-3 w-3" />详情
        </button>
        {canManageOps && !o.isDeleted && (
          <button onClick={() => openShipping(o)} className="text-wine hover:underline text-xs inline-flex items-center gap-0.5">
            <Truck className="h-3 w-3" />设置发货
          </button>
        )}
        {canManageOps && !o.isDeleted && (
          <button onClick={() => openPayment(o)} className="text-wine hover:underline text-xs inline-flex items-center gap-0.5">
            <Wallet className="h-3 w-3" />设置收款
          </button>
        )}
        {!o.isDeleted && (
          <button onClick={() => openVouchers(o)} className="text-muted hover:text-wine text-xs inline-flex items-center gap-0.5">
            <Paperclip className="h-3 w-3" />凭证
          </button>
        )}
        {canDelete && !o.isDeleted && (
          <button onClick={() => handleDelete(o)} className="text-red-700 hover:underline text-xs inline-flex items-center gap-0.5">
            <Trash2 className="h-3 w-3" />删除
          </button>
        )}
        {isAdmin && o.isDeleted && (
          <button onClick={() => handleRestore(o)} className="text-wine hover:underline text-xs inline-flex items-center gap-0.5">
            <RotateCcw className="h-3 w-3" />恢复
          </button>
        )}
      </>
    );
  }

  function renderOrderMobileCard(o: Order) {
    const badge = getPaymentBadge(o);
    return (
      <div
        key={o.id}
        className={cn(
          "rounded-lg border border-border bg-white p-3",
          o.isDeleted && "opacity-60"
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="font-mono text-xs font-semibold break-all inline-flex items-center gap-1.5 flex-wrap">
            {o.orderNo}
            {renderNotesBadge(o)}
          </span>
          {o.isDeleted && <Badge variant="warning">已删除</Badge>}
        </div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted w-14">客户</dt>
            <dd className="min-w-0 flex-1">{o.customerName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted w-14">产品</dt>
            <dd className="min-w-0 flex-1 text-xs leading-relaxed">{o.itemsSummary || "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted w-14">销售</dt>
            <dd className="min-w-0 flex-1">{o.sales.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted w-14">总金额</dt>
            <dd className="min-w-0 flex-1 font-medium">{formatCurrency(o.totalAmount)}</dd>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted w-14">毛利</dt>
              <dd className="min-w-0 flex-1 text-wine">
                {o.profit !== undefined ? formatCurrency(o.profit) : "-"}
                {typeof o.profitMargin === "number" ? ` (${o.profitMargin.toFixed(1)}%)` : ""}
              </dd>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <dt className="shrink-0 text-muted w-14">收款</dt>
            <dd>
              <Badge variant={badge.variant}>
                {badge.label}
                {o.paymentStatus === "PARTIAL" && o.paidAmount > 0
                  ? ` ${formatCurrency(o.paidAmount)}`
                  : ""}
              </Badge>
            </dd>
          </div>
          <div className="flex gap-2 items-center">
            <dt className="shrink-0 text-muted w-14">发货</dt>
            <dd>
              <Badge variant={o.isShipped ? "success" : "default"}>
                {o.isShipped ? "已发" : "未发"}
              </Badge>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted w-14">下单</dt>
            <dd className="min-w-0 flex-1">{formatDate(o.orderedAt)}</dd>
          </div>
        </dl>
        <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-x-3 gap-y-2">
          {renderOrderActions(o)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {isCreateOnly ? (
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goBack(createBackTarget)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold">新建订单</h1>
            <p className="text-sm text-muted mt-0.5 font-serif">为客户创建新订单</p>
          </div>
        </div>
      ) : (
      <div className="page-header">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-serif font-bold">订单管理</h1>
          <p className="text-muted text-sm mt-1 font-serif">订单全流程跟踪与处理</p>
        </div>
        {canCreate && (
          <div className="page-header-actions">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            新建订单
          </Button>
          </div>
        )}
        {canExportOrders && (
          <div className={canCreate ? "" : "page-header-actions"}>
            <Button
              variant="secondary"
              onClick={handleExportExcel}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-1" />
              {exporting ? "导出中..." : "导出 Excel"}
            </Button>
          </div>
        )}
      </div>
      )}

      {!isCreateOnly && (
      <Card>
        <CardContent className="pt-5">
          <div className="filter-grid">
            {isSales ? (
              <>
                <FilterField label="订单号">
                  <Input
                    placeholder="输入订单号"
                    value={filterDraft.orderNo}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderNo: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="创建开始日期" className="filter-field-date">
                  <Input
                    type="date"
                    value={filterDraft.orderedStart}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderedStart: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="创建结束日期" className="filter-field-date">
                  <Input
                    type="date"
                    value={filterDraft.orderedEnd}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderedEnd: e.target.value })
                    }
                  />
                </FilterField>
                <label className="filter-field-checkbox flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={draftShowDeleted}
                    onChange={(e) => setDraftShowDeleted(e.target.checked)}
                  />
                  仅显示已删除
                </label>
              </>
            ) : (
              <>
                <FilterField label="订单号">
                  <Input
                    placeholder="订单号"
                    value={filterDraft.orderNo}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderNo: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="客户">
                  <Input
                    placeholder="客户名/ID"
                    value={filterDraft.customer}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, customer: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="销售">
                  <Input
                    placeholder="销售名"
                    value={filterDraft.sales}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, sales: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="创建开始日期" className="filter-field-date">
                  <Input
                    type="date"
                    value={filterDraft.orderedStart}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderedStart: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="创建结束日期" className="filter-field-date">
                  <Input
                    type="date"
                    value={filterDraft.orderedEnd}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, orderedEnd: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="付款开始日期" className="filter-field-date">
                  <Input
                    type="date"
                    value={filterDraft.paidStart}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, paidStart: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="付款结束日期" className="filter-field-date">
                  <Input
                    type="date"
                    value={filterDraft.paidEnd}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, paidEnd: e.target.value })
                    }
                  />
                </FilterField>
                <FilterField label="付款状态">
                  <Select
                    value={filterDraft.paymentStatus || filterDraft.isPaid}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "true" || v === "false") {
                        setFilterDraft({ ...filterDraft, isPaid: v, paymentStatus: "" });
                      } else {
                        setFilterDraft({ ...filterDraft, paymentStatus: v, isPaid: "" });
                      }
                    }}
                  >
                    <option value="">全部</option>
                    <option value="false">未付款</option>
                    <option value="PARTIAL">部分付款</option>
                    <option value="true">已付款</option>
                  </Select>
                </FilterField>
                <FilterField label="发货状态">
                  <Select
                    value={filterDraft.isShipped}
                    onChange={(e) =>
                      setFilterDraft({ ...filterDraft, isShipped: e.target.value })
                    }
                  >
                    <option value="">全部</option>
                    <option value="true">已发货</option>
                    <option value="false">未发货</option>
                  </Select>
                </FilterField>
                <label className="filter-field-checkbox flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={draftShowDeleted}
                    onChange={(e) => setDraftShowDeleted(e.target.checked)}
                  />
                  仅显示已删除
                </label>
              </>
            )}
            <div className="filter-actions">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              查询
            </Button>
            <Button variant="secondary" onClick={handleResetFilters}>
              重置
            </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted">加载中...</div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {orders.map((o) => renderOrderMobileCard(o))}
              </div>
              <div className="hidden md:block table-scroll">
                <table className="w-full text-sm ink-table">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-3">订单号</th>
                      <th className="pb-3">客户</th>
                      <th className="pb-3">产品</th>
                      <th className="pb-3">销售</th>
                      <th className="pb-3">总金额</th>
                      {isAdmin && <th className="pb-3">毛利</th>}
                      {isAdmin && <th className="pb-3">毛利率</th>}
                      <th className="pb-3">收款</th>
                      <th className="pb-3">发货</th>
                      <th className="pb-3">下单时间</th>
                      <th className="pb-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className={`border-b border-border/40 ${o.isDeleted ? "opacity-60" : ""}`}>
                        <td className="py-3 font-mono text-xs">
                          <span className="inline-flex items-center gap-1.5 flex-wrap">
                            {o.orderNo}
                            {renderNotesBadge(o)}
                          </span>
                          {o.isDeleted && (
                            <Badge variant="warning" className="ml-1">已删除</Badge>
                          )}
                        </td>
                        <td className="py-3">{o.customerName}</td>
                        <td className="py-3 text-xs max-w-[180px] truncate" title={o.itemsSummary}>{o.itemsSummary}</td>
                        <td className="py-3">{o.sales.name}</td>
                        <td className="py-3 font-medium">{formatCurrency(o.totalAmount)}</td>
                        {isAdmin && (
                          <td className="py-3 text-wine">{o.profit !== undefined ? formatCurrency(o.profit) : "-"}</td>
                        )}
                        {isAdmin && (
                          <td className="py-3 text-wine">{typeof o.profitMargin === "number" ? `${o.profitMargin.toFixed(1)}%` : "-"}</td>
                        )}
                        <td className="py-3">
                          {(() => {
                            const badge = getPaymentBadge(o);
                            return (
                              <Badge variant={badge.variant}>
                                {badge.label}
                                {o.paymentStatus === "PARTIAL" && o.paidAmount > 0
                                  ? ` ${formatCurrency(o.paidAmount)}`
                                  : ""}
                              </Badge>
                            );
                          })()}
                        </td>
                        <td className="py-3">
                          <Badge variant={o.isShipped ? "success" : "default"}>
                            {o.isShipped ? "已发" : "未发"}
                          </Badge>
                        </td>
                        <td className="py-3">{formatDate(o.orderedAt)}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {renderOrderActions(o)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Create Modal */}
      <Modal
        open={isCreateOnly ? true : createOpen}
        onClose={() => {
          if (isCreateOnly) {
            goBack(createBackTarget);
            return;
          }
          setCreateOpen(false);
        }}
        title="新建订单"
        className="sm:max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <Label>客户 *</Label>
            {isCreateOnly && createForm.customerId ? (
              <Input
                readOnly
                className="bg-paper"
                value={
                  (Array.isArray(customers) ? customers : []).find(
                    (c) => c.id === createForm.customerId
                  )?.name || "加载中..."
                }
              />
            ) : (
            <Select
              value={createForm.customerId}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  customerId: e.target.value,
                  shippingAddressId: "",
                })
              }
            >
              <option value="">请选择</option>
              {(Array.isArray(customers) ? customers : []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            )}
          </div>
          <div>
            <Label>发货方式 *</Label>
            <Select
              value={createForm.shippingMethod}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  shippingMethod: e.target.value as typeof createForm.shippingMethod,
                })
              }
            >
              {SHIPPING_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          {createForm.shippingMethod !== "PICKUP" &&
            createForm.shippingMethod !== "ON_SITE_STOCKING" && (
            <div>
              <Label>收货地址 *</Label>
              {createForm.customerId ? (
                customerAddresses.length > 0 ? (
                  <>
                    <Select
                      value={createForm.shippingAddressId}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          shippingAddressId: e.target.value,
                        })
                      }
                    >
                      <option value="">请选择收货地址</option>
                      {customerAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.isDefault ? "【默认】" : ""}
                          {a.name} {a.phone} — {formatShippingAddress(a)}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted mt-1">
                      默认地址已自动选中；可在客户列表「收货信息」中维护
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-sm p-2">
                    该客户暂无收货地址，请先在客户列表中为该客户添加收货信息
                  </p>
                )
              ) : (
                <p className="text-sm text-muted">请先选择客户</p>
              )}
            </div>
          )}
          <div>
            <Label>订单处理人员</Label>
            <Select value={createForm.handlerId} onChange={(e) => setCreateForm({ ...createForm, handlerId: e.target.value })}>
              <option value="">可选</option>
              {opsUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>订单产品 *</Label>
            {createForm.items.map((item, idx) => (
              <div key={idx} className="mt-2 space-y-2 border-b border-border/40 pb-3 last:border-0">
                <div className="flex gap-2 items-center flex-wrap">
                  <Select
                    value={item.productSpecId}
                    onChange={(e) => {
                      const specId = e.target.value;
                      const items = [...createForm.items];
                      items[idx].productSpecId = specId;
                      const resolved = resolveItemUnitPrice(
                        specId,
                        items[idx].isGift,
                        customerLastPrices
                      );
                      items[idx].unitPrice = resolved.unitPrice;
                      items[idx].priceFromLastPurchase = resolved.priceFromLastPurchase;
                      setCreateForm({ ...createForm, items });
                    }}
                    className="flex-1 min-w-[140px]"
                  >
                    <option value="">选择规格</option>
                    {specs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </Select>
                  <QtyInput
                    min={1}
                    value={item.quantity}
                    onChange={(n) => {
                      const items = [...createForm.items];
                      items[idx].quantity = n || 1;
                      setCreateForm({ ...createForm, items });
                    }}
                    className="input-compact"
                  />
                  <span className="text-sm text-muted w-8">{getUnitForItem(item.productSpecId)}</span>
                  <label className="flex items-center gap-1 text-sm text-muted whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={item.isGift}
                      onChange={(e) => {
                        const items = [...createForm.items];
                        items[idx].isGift = e.target.checked;
                        const resolved = resolveItemUnitPrice(
                          items[idx].productSpecId,
                          items[idx].isGift,
                          customerLastPrices
                        );
                        items[idx].unitPrice = resolved.unitPrice;
                        items[idx].priceFromLastPurchase = resolved.priceFromLastPurchase;
                        setCreateForm({ ...createForm, items });
                      }}
                    />
                    赠品
                  </label>
                </div>
                {item.productSpecId && !item.isGift && (
                  <div className="max-w-[220px]">
                    <Label className="text-xs text-muted">单价</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice}
                      onChange={(e) => {
                        const price = parseFloat(e.target.value) || 0;
                        const spec = specs.find((s) => s.id === item.productSpecId);
                        const items = [...createForm.items];
                        items[idx].unitPrice = price;
                        items[idx].priceFromLastPurchase =
                          spec != null &&
                          price !== spec.price &&
                          price === customerLastPrices[item.productSpecId];
                        setCreateForm({ ...createForm, items });
                      }}
                    />
                    {item.priceFromLastPurchase && (
                      <p className="text-xs text-muted mt-1">
                        根据上次客户拿货价自动调整
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setCreateForm({ ...createForm, items: [...createForm.items, { productSpecId: "", quantity: 1, isGift: false, unitPrice: 0, priceFromLastPurchase: false }] })}>
              添加产品
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>产品金额</Label>
              <Input value={formatCurrency(productAmountPreview)} readOnly className="bg-paper" />
            </div>
            <div>
              <Label>运费</Label>
              <Input
                type="number" step={0.01} min={0}
                value={createForm.shippingFee}
                onChange={(e) => setCreateForm({ ...createForm, shippingFee: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>其它费用</Label>
              <Input
                type="number" step={0.01} min={0}
                value={createForm.otherFee}
                onChange={(e) => setCreateForm({ ...createForm, otherFee: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>系统计算总金额</Label>
              <Input value={formatCurrency(calculatedPreview)} readOnly className="bg-paper" />
            </div>
            <div className="col-span-2">
              <Label>订单总金额</Label>
              <Input
                type="number" step={0.01} min={0}
                value={createForm.totalAmount}
                onChange={(e) => setCreateForm({ ...createForm, totalAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          {createForm.totalAmount !== calculatedPreview && (
            <div>
              <Label>金额调整理由 *</Label>
              <Textarea
                value={createForm.amountAdjustReason}
                onChange={(e) => setCreateForm({ ...createForm, amountAdjustReason: e.target.value })}
                placeholder="请说明修改总金额的原因"
              />
            </div>
          )}
          <div>
            <Label>备注</Label>
            <Textarea value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
          </div>
          {canManageOps && (
            <>
              <h4 className="font-serif font-medium pt-2 border-t border-border">收款（可选）</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={createPaymentForm.paymentStatus}
                  onChange={(e) => {
                    const status = e.target.value as "UNPAID" | "PARTIAL" | "PAID";
                    setCreatePaymentForm({
                      ...createPaymentForm,
                      paymentStatus: status,
                      paidAmount:
                        status === "PAID"
                          ? createForm.totalAmount
                          : status === "UNPAID"
                            ? 0
                            : calcCreateReconcilePaidAmount(
                                createForm.items,
                                buildCreateSpecPrices(),
                                createReconcileQty
                              ),
                    });
                  }}
                >
                  <option value="UNPAID">未收款</option>
                  <option value="PARTIAL">部分付款</option>
                  <option value="PAID">已收款</option>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={createPaymentForm.paidAmount}
                  disabled={createPaymentForm.paymentStatus !== "PARTIAL"}
                  onChange={(e) =>
                    setCreatePaymentForm({
                      ...createPaymentForm,
                      paidAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="部分付款金额"
                />
                {createPaymentForm.paymentStatus === "PARTIAL" && (
                  <p className="text-xs text-muted col-span-2">
                    根据本次核销数量自动计算已收金额
                  </p>
                )}
                <Input
                  type="datetime-local"
                  className="col-span-2"
                  value={createPaymentForm.paidAt}
                  onChange={(e) =>
                    setCreatePaymentForm({ ...createPaymentForm, paidAt: e.target.value })
                  }
                />
              </div>
              {(createPaymentForm.paymentStatus === "PARTIAL") && (
                <div>
                  <Label>核销产品数量 *</Label>
                  <div className="space-y-2 border border-border rounded-sm p-3 mt-1">
                    {createForm.items.map((item, idx) => {
                      if (!item.productSpecId) return null;
                      const spec = specs.find((s) => s.id === item.productSpecId);
                      return (
                        <div
                          key={idx}
                          className="flex flex-col gap-2 border-b border-border/40 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3"
                        >
                          <span className="min-w-0 flex-1 text-sm leading-snug">
                            {spec?.label ?? item.productSpecId}
                            {item.isGift && (
                              <Badge variant="wine" className="ml-1 text-[10px] px-1 py-0">
                                赠品
                              </Badge>
                            )}
                            <span className="block text-xs text-muted mt-0.5 sm:inline sm:mt-0 sm:ml-1">
                              可核销 {item.quantity}
                              {spec ? getUnitForItem(item.productSpecId) : ""}
                            </span>
                          </span>
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <span className="text-xs text-muted whitespace-nowrap">数量</span>
                            <QtyInput
                              min={0}
                              max={item.quantity}
                              className="input-compact"
                              value={createReconcileQty[idx] ?? 0}
                              onChange={(n) => updateCreateReconcileQty(idx, n)}
                            />
                            <span className="text-xs text-muted">
                              {spec ? getUnitForItem(item.productSpecId) : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {createForm.items.every((i) => !i.productSpecId) && (
                      <p className="text-sm text-muted">请先选择订单产品</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              if (isCreateOnly) {
                goBack(createBackTarget);
                return;
              }
              setCreateOpen(false);
            }}
          >
            取消
          </Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? "提交中..." : "创建"}</Button>
        </ModalFooter>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`订单 ${selected?.orderNo || ""}`} className="sm:max-w-2xl">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted">客户：</span>{selected.customerName}</div>
              <div><span className="text-muted">销售：</span>{selected.sales.name}</div>
              <div><span className="text-muted">产品金额：</span>{formatCurrency(selected.productAmount ?? 0)}</div>
              <div><span className="text-muted">运费：</span>{formatCurrency(selected.shippingFee ?? 0)}</div>
              <div><span className="text-muted">其它费用：</span>{formatCurrency(selected.otherFee ?? 0)}</div>
              <div><span className="text-muted">系统总金额：</span>{formatCurrency(selected.calculatedAmount)}</div>
              <div><span className="text-muted">订单总金额：</span>{formatCurrency(selected.totalAmount)}</div>
              {selected.amountAdjustReason && (
                <div className="col-span-2"><span className="text-muted">调整理由：</span>{selected.amountAdjustReason}</div>
              )}
              {isAdmin && selected.productCostTotal !== undefined && (
                <div><span className="text-muted">产品成本：</span>{formatCurrency(selected.productCostTotal)}</div>
              )}
              {isAdmin && selected.profit !== undefined && (
                <>
                  <div><span className="text-muted">毛利：</span><span className="text-wine font-medium">{formatCurrency(selected.profit)}</span></div>
                  <div><span className="text-muted">毛利率：</span><span className="text-wine">{selected.profitMargin?.toFixed(1)}%</span></div>
                </>
              )}
              <div>
                <span className="text-muted">收款状态：</span>
                {getPaymentBadge(selected).label}
                {selected.paymentStatus === "PARTIAL" && selected.paidAmount > 0
                  ? ` ${formatCurrency(selected.paidAmount)}`
                  : ""}
              </div>
              {selected.paidAt && (
                <div><span className="text-muted">收款时间：</span>{formatDate(selected.paidAt)}</div>
              )}
            </div>

            {selected.notes?.trim() && (
              <div className="rounded-sm border border-amber-200 bg-amber-50 p-3">
                <h4 className="font-serif font-medium text-amber-900 mb-1">订单备注</h4>
                <p className="text-sm whitespace-pre-wrap text-amber-950">
                  {selected.notes}
                </p>
              </div>
            )}

            {selected.items.length > 0 && (
              <div>
                <h4 className="font-serif font-medium mb-2">订单产品</h4>
                <table className="w-full text-sm ink-table">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="pb-2">产品</th>
                      <th className="pb-2">数量</th>
                      <th className="pb-2">单价</th>
                      <th className="pb-2">小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr key={item.id} className="border-b border-border/40">
                        <td className="py-2">
                          {item.productName} · {item.specName}
                          {item.isGift && (
                            <Badge variant="wine" className="ml-1 text-[10px] px-1 py-0">
                              赠品
                            </Badge>
                          )}
                        </td>
                        <td className="py-2">
                          {item.quantity}{SPEC_UNIT_LABELS[item.unitType]}
                        </td>
                        <td className="py-2">
                          {item.isGift ? "¥0" : formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-2">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canManageOps && !selected.isDeleted && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>修改总金额</Label>
                  <Input type="number" value={editTotalAmount} onChange={(e) => setEditTotalAmount(parseFloat(e.target.value) || 0)} />
                </div>
                {editTotalAmount !== selected.totalAmount && (
                  <div className="col-span-2">
                    <Label>调整理由 *</Label>
                    <Input value={editAmountReason} onChange={(e) => setEditAmountReason(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {(canManageOps || selected.shipping?.method || selected.isShipped) && (
              <>
                <h4 className="font-serif font-medium">发货信息</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {selected.shipping?.method && (
                    <div>
                      <span className="text-muted">发货方式：</span>
                      {SHIPPING_METHOD_LABELS[selected.shipping.method]}
                    </div>
                  )}
                  <div>
                    <span className="text-muted">发货状态：</span>
                    {selected.isShipped ? "已发货" : "未发货"}
                  </div>
                  {selected.shipping?.recipientName && (
                    <div>
                      <span className="text-muted">收货人：</span>
                      {selected.shipping.recipientName}
                      {selected.shipping.recipientPhone
                        ? ` ${selected.shipping.recipientPhone}`
                        : ""}
                    </div>
                  )}
                  {selected.shipping?.address && (
                    <div className="col-span-2">
                      <span className="text-muted">收货地址：</span>
                      {selected.shipping.address}
                    </div>
                  )}
                  {selected.shipping?.carrier && (
                    <div>
                      <span className="text-muted">快递公司：</span>
                      {selected.shipping.carrier}
                    </div>
                  )}
                  {selected.shipping?.trackingNo && (
                    <div>
                      <span className="text-muted">运单号：</span>
                      {selected.shipping.trackingNo}
                    </div>
                  )}
                  {selected.shipping?.shippedAt && (
                    <div>
                      <span className="text-muted">发货时间：</span>
                      {formatDate(selected.shipping.shippedAt)}
                    </div>
                  )}
                </div>
              </>
            )}

            <OrderVouchersPanel
              orderId={selected.id}
              canEdit={canManageOps && !selected.isDeleted}
            />

            {canManageOps && !selected.isDeleted && (
              <>
                <h4 className="font-serif font-medium">退款</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    value={refundForm.refundStatus}
                    onChange={(e) => {
                      const status = e.target.value as "NONE" | "PARTIAL" | "FULL";
                      setRefundForm({
                        ...refundForm,
                        refundStatus: status,
                        refundAmount:
                          status === "FULL"
                            ? selected.paidAmount
                            : status === "NONE"
                              ? 0
                              : refundForm.refundAmount,
                      });
                    }}
                  >
                    <option value="NONE">无退款</option>
                    <option value="PARTIAL">部分退款</option>
                    <option value="FULL">全额退款</option>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    max={selected.paidAmount}
                    step={0.01}
                    value={refundForm.refundAmount}
                    disabled={refundForm.refundStatus !== "PARTIAL"}
                    onChange={(e) =>
                      setRefundForm({
                        ...refundForm,
                        refundAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="退款金额"
                  />
                  {refundForm.refundStatus !== "NONE" && (
                    <Input
                      type="datetime-local"
                      className="col-span-2"
                      value={refundForm.refundedAt}
                      onChange={(e) =>
                        setRefundForm({ ...refundForm, refundedAt: e.target.value })
                      }
                    />
                  )}
                </div>
              </>
            )}

            {selected.auditLogs && selected.auditLogs.length > 0 && (
              <div>
                <h4 className="font-serif font-medium flex items-center gap-1 mb-2">
                  <History className="h-4 w-4" />修改记录
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-2 text-xs border border-border rounded-sm p-3 bg-paper">
                  {selected.auditLogs.map((log) => (
                    <div key={log.id} className="border-b border-border/40 pb-2 last:border-0">
                      <div className="flex justify-between text-muted">
                        <span>{log.userName} · {log.action}</span>
                        <span>{formatDate(log.createdAt)}</span>
                      </div>
                      {log.changes && (
                        <pre className="mt-1 text-foreground/80 whitespace-pre-wrap">{log.changes}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="pt-2 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => selected && shareOrder(selected.id)}
              >
                <Share2 className="h-3.5 w-3.5 mr-1" />
                分享给客户
              </Button>
              <p className="text-xs text-muted mt-1">
                分享页不含成本、毛利；客户手机号脱敏显示
              </p>
            </div>
          </div>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDetailOpen(false)}>关闭</Button>
          {canManageOps && !selected?.isDeleted && (
            <Button onClick={handleUpdateOps} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          )}
        </ModalFooter>
      </Modal>

      <Modal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={`设置收款 · ${paymentOrder?.orderNo || ""}`}
        className="sm:max-w-2xl"
      >
        {paymentOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted">客户：</span>{paymentOrder.customerName}</div>
              <div><span className="text-muted">订单总额：</span>{formatCurrency(paymentOrder.totalAmount)}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label>付款状态</Label>
                <Select
                  value={paymentForm.paymentStatus}
                  onChange={(e) => {
                    const status = e.target.value as "UNPAID" | "PARTIAL" | "PAID";
                    const productsDone = allProductsFullyReconciled(paymentOrder.creditLines);
                    setPaymentForm({
                      ...paymentForm,
                      paymentStatus: status,
                      paidAmount:
                        status === "PAID"
                          ? paymentOrder.totalAmount
                          : status === "UNPAID"
                            ? 0
                            : productsDone
                              ? paymentOrder.paidAmount
                              : calcReconcilePaidAmount(
                                  paymentOrder.items,
                                  paymentOrder.paidAmount,
                                  reconcileQty
                                ),
                    });
                  }}
                >
                  <option value="UNPAID">未收款</option>
                  <option value="PARTIAL">部分付款</option>
                  <option value="PAID">已收款</option>
                </Select>
              </div>
              <div>
                <Label>已收金额</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={paymentForm.paidAmount}
                  disabled={paymentForm.paymentStatus !== "PARTIAL"}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paidAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                {paymentForm.paymentStatus === "PARTIAL" && (
                  <p className="text-xs text-muted mt-1">
                    根据本次核销数量自动累加（含历史已收{" "}
                    {formatCurrency(paymentOrder.paidAmount)}）
                  </p>
                )}
              </div>
              {paymentForm.paymentStatus !== "UNPAID" && (
                <div className="col-span-2">
                  <Label>收款时间</Label>
                  <Input
                    type="datetime-local"
                    value={paymentForm.paidAt}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, paidAt: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
            {paymentNeedsReconcile(paymentOrder, paymentForm.paymentStatus) &&
              paymentForm.paymentStatus !== "UNPAID" &&
              !allProductsFullyReconciled(paymentOrder.creditLines) && (
                <div>
                  <Label>核销产品数量 *</Label>
                  <p className="text-xs text-muted mb-2">
                    部分付款或账期补款结清需填写本次核销数量
                  </p>
                  <div className="space-y-3 border border-border rounded-sm p-3">
                    {(paymentOrder.items ?? []).map((item) => {
                      const line = paymentOrder.creditLines?.find(
                        (l) => l.orderItemId === item.id
                      );
                      const maxQty = line?.unreconciledQty ?? item.quantity;
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col gap-2 border-b border-border/40 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3"
                        >
                          <div className="min-w-0 flex-1 text-sm leading-snug">
                            {item.productName} · {item.specName}
                            {item.isGift && (
                              <Badge variant="wine" className="ml-1 text-[10px] px-1 py-0">
                                赠品
                              </Badge>
                            )}
                            <span className="block text-xs text-muted mt-0.5 sm:inline sm:mt-0 sm:ml-1">
                              可核销 {maxQty}
                              {SPEC_UNIT_LABELS[item.unitType]}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <span className="text-xs text-muted whitespace-nowrap">数量</span>
                            <QtyInput
                              min={0}
                              max={maxQty}
                              className="input-compact"
                              disabled={maxQty <= 0}
                              value={reconcileQty[item.id] ?? 0}
                              onChange={(n) => updatePaymentReconcileQty(item.id, n)}
                            />
                            <span className="text-xs text-muted">
                              {SPEC_UNIT_LABELS[item.unitType]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            {allProductsFullyReconciled(paymentOrder.creditLines) &&
              paymentForm.paymentStatus !== "UNPAID" && (
                <p className="text-xs text-muted bg-paper border border-border rounded-sm p-3">
                  产品已全部核销，可直接设置收款金额（含运费及其它费用），无需再填核销数量。
                </p>
              )}
            {paymentForm.paymentStatus === "PAID" &&
              !paymentNeedsReconcile(paymentOrder, "PAID") &&
              !allProductsFullyReconciled(paymentOrder.creditLines) && (
                <p className="text-xs text-muted bg-paper border border-border rounded-sm p-3">
                  一次性全额收款，无需填写核销产品数量。
                </p>
              )}
            {paymentError && <p className="text-sm text-red-700">{paymentError}</p>}
            <OrderVouchersPanel
              orderId={paymentOrder.id}
              canEdit={canManageOps}
              compact
            />
          </div>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setPayModalOpen(false)}>
            取消
          </Button>
          <Button onClick={handlePaymentSave} disabled={saving}>
            {saving ? "保存中..." : "确认收款"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={shipModalOpen}
        onClose={() => setShipModalOpen(false)}
        title={`设置发货 · ${shippingOrder?.orderNo || ""}`}
        className="sm:max-w-2xl"
      >
        {shippingOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted">客户：</span>{shippingOrder.customerName}</div>
              <div>
                <span className="text-muted">发货方式：</span>
                {shippingOrder.shipping?.method
                  ? SHIPPING_METHOD_LABELS[shippingOrder.shipping.method]
                  : "—"}
              </div>
            </div>
            {shippingOrder.shipping?.method &&
              shippingOrder.shipping.method !== "PICKUP" &&
              shippingOrder.shipping.address && (
                <div className="text-sm p-3 bg-paper border border-border rounded-sm space-y-1">
                  <div>
                    <span className="text-muted">收货人：</span>
                    {shippingOrder.shipping.recipientName}
                    {shippingOrder.shipping.recipientPhone
                      ? ` ${shippingOrder.shipping.recipientPhone}`
                      : ""}
                  </div>
                  <div>
                    <span className="text-muted">收货地址：</span>
                    {shippingOrder.shipping.address}
                  </div>
                </div>
              )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label>发货状态</Label>
                <Select
                  value={shippingForm.isShipped ? "1" : "0"}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, isShipped: e.target.value === "1" })
                  }
                >
                  <option value="0">未发货</option>
                  <option value="1">已发货</option>
                </Select>
              </div>
              <div>
                <Label>发货时间</Label>
                <Input
                  type="datetime-local"
                  value={shippingForm.shippedAt}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, shippedAt: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>快递公司</Label>
                <Input
                  placeholder="快递公司"
                  value={shippingForm.carrier}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, carrier: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>运单号</Label>
                <Input
                  placeholder="运单号"
                  value={shippingForm.trackingNo}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, trackingNo: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label>备注</Label>
                <Textarea
                  value={shippingForm.notes}
                  onChange={(e) =>
                    setShippingForm({ ...shippingForm, notes: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </div>
            {shippingError && <p className="text-sm text-red-700">{shippingError}</p>}
          </div>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShipModalOpen(false)}>
            取消
          </Button>
          <Button onClick={handleShippingSave} disabled={saving}>
            {saving ? "保存中..." : "确认发货"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        title={`订单凭证 · ${voucherOrder?.orderNo || ""}`}
        className="sm:max-w-2xl"
      >
        <OrderVouchersPanel
          orderId={voucherOrder?.id ?? null}
          canEdit={canManageOps}
        />
        <ModalFooter>
          <Button variant="secondary" onClick={() => setVoucherModalOpen(false)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!notesPreview}
        onClose={() => setNotesPreview(null)}
        title={`订单备注 · ${notesPreview?.orderNo || ""}`}
      >
        <p className="text-sm whitespace-pre-wrap">{notesPreview?.notes}</p>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setNotesPreview(null)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>
      {shareModal}
    </div>
  );
}
