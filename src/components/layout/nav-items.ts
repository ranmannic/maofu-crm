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
  type LucideIcon,
} from "lucide-react";

export const navItems: {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}[] = [
  { href: "/", label: "数据概览", icon: LayoutDashboard, roles: ["ADMIN", "SALES"] },
  { href: "/customers", label: "客户管理", icon: Users, roles: ["ADMIN", "SALES"] },
  { href: "/follow-up", label: "客户跟进", icon: Phone, roles: ["ADMIN", "SALES"] },
  { href: "/orders", label: "订单管理", icon: ShoppingCart, roles: ["ADMIN", "SALES", "OPERATIONS"] },
  { href: "/credit", label: "账期核销", icon: ClipboardList, roles: ["ADMIN", "SALES", "OPERATIONS"] },
  { href: "/products", label: "产品管理", icon: Package, roles: ["ADMIN"] },
  { href: "/channels", label: "渠道管理", icon: GitBranch, roles: ["ADMIN"] },
  { href: "/users", label: "账号管理", icon: UserCog, roles: ["ADMIN"] },
];

export function getNavTitle(pathname: string) {
  if (pathname === "/") return "数据概览";
  const item = navItems.find(
    (n) => n.href !== "/" && pathname.startsWith(n.href)
  );
  return item?.label ?? "毛府酒庄";
}
