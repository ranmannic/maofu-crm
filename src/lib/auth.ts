import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@/generated/prisma/client";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "maofu-crm-dev-secret-change-in-production"
);

const COOKIE_NAME = "maofu_session";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      id: payload.id as string,
      username: payload.username as string,
      name: payload.name as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
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
  OPERATIONS: "职能",
  ADMIN: "管理员",
};

/** 可维护产品档案（产品管理页）的角色 */
export const PRODUCT_MANAGER_ROLES: Role[] = ["ADMIN", "OPERATIONS"];

export function canManageProducts(role: Role) {
  return PRODUCT_MANAGER_ROLES.includes(role);
}
