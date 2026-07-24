import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth-types";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
} from "@/lib/session-config";

export type { SessionUser } from "@/lib/auth-types";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await signSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
}

export async function requireSession(roles?: Role[]) {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  if (roles && !roles.includes(session.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function authenticateUser(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return null;

  const valid = await verifyPassword(password, user.password);
  if (!valid) return null;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  } satisfies SessionUser;
}

export const ROLE_LABELS: Record<Role, string> = {
  SALES: "销售",
  SALES_MANAGER: "销售管理",
  OPERATIONS: "职能",
  ADMIN: "管理员",
};

/** 可维护产品档案（产品管理页）的角色 */
export const PRODUCT_MANAGER_ROLES: Role[] = ["ADMIN", "OPERATIONS"];

/** 与 SALES 相同 API 读权限时一并放行销售管理 */
export function withSalesManagerAccess(roles: Role[]): Role[] {
  const set = new Set(roles);
  if (set.has("SALES")) set.add("SALES_MANAGER");
  return [...set];
}

export function canManageProducts(role: Role) {
  return PRODUCT_MANAGER_ROLES.includes(role);
}
