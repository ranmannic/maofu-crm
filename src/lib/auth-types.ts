import type { Role } from "@/generated/prisma/client";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}

export const ROLE_LABELS: Record<Role, string> = {
  SALES: "销售",
  SALES_MANAGER: "销售管理",
  OPERATIONS: "职能",
  ADMIN: "管理员",
};
