import type { Role } from "@/generated/prisma/client";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  UserCog,
  GitBranch,
  ClipboardList,
  Phone,
  ListTodo,
  Wine,
  Warehouse,
  BadgePercent,
  Settings,
  LayoutList,
  type LucideIcon,
} from "lucide-react";

export const navItems: {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  premiumOnly?: boolean;
  /** 高级版侧栏隐藏（功能合并到其他入口） */
  hideInPremium?: boolean;
}[] = [
  { href: "/", label: "数据概览", icon: LayoutDashboard, roles: ["ADMIN", "SALES"] },
  { href: "/workbench", label: "职能工作台", icon: ListTodo, roles: ["OPERATIONS"] },
  { href: "/customers", label: "客户管理", icon: Users, roles: ["ADMIN", "SALES"] },
  { href: "/follow-up", label: "客户跟进", icon: Phone, roles: ["ADMIN", "SALES"] },
  { href: "/orders", label: "订单管理", icon: ShoppingCart, roles: ["ADMIN", "SALES", "OPERATIONS"] },
  { href: "/credit", label: "账期核销", icon: ClipboardList, roles: ["ADMIN", "SALES", "OPERATIONS"] },
  { href: "/products", label: "产品管理", icon: Package, roles: ["ADMIN", "OPERATIONS"] },
  { href: "/inventory", label: "库存管理", icon: Warehouse, roles: ["ADMIN", "OPERATIONS"], premiumOnly: true },
  {
    href: "/stock-overview",
    label: "库存一览",
    icon: LayoutList,
    roles: ["SALES"],
    premiumOnly: true,
  },
  { href: "/commissions", label: "销售提成", icon: BadgePercent, roles: ["ADMIN"], premiumOnly: true },
  {
    href: "/catalog",
    label: "产品展示",
    icon: Wine,
    roles: ["ADMIN", "SALES"],
    hideInPremium: true,
  },
  {
    href: "/channels",
    label: "渠道管理",
    icon: GitBranch,
    roles: ["ADMIN"],
    hideInPremium: true,
  },
  {
    href: "/users",
    label: "账号管理",
    icon: UserCog,
    roles: ["ADMIN"],
    hideInPremium: true,
  },
  {
    href: "/system",
    label: "系统管理",
    icon: Settings,
    roles: ["ADMIN"],
    premiumOnly: true,
  },
];

export function getNavTitle(pathname: string) {
  if (pathname === "/") return "数据概览";
  if (pathname.startsWith("/workbench")) return "职能工作台";
  if (pathname.startsWith("/inventory")) return "库存管理";
  if (pathname.startsWith("/stock-overview")) return "库存一览";
  if (pathname.startsWith("/commissions")) return "销售提成";
  if (pathname.startsWith("/catalog")) return "产品展示";
  if (pathname.startsWith("/system")) return "系统管理";
  if (pathname.startsWith("/customers/")) return "客户详情";
  const item = navItems.find(
    (n) => n.href !== "/" && pathname.startsWith(n.href)
  );
  return item?.label ?? "毛府酒庄";
}
