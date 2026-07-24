import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth-types";

export const SESSION_COOKIE_NAME = "maofu_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/** 与 middleware、Route Handler、Server Component 共用，避免密钥或 Cookie 选项不一致 */
export function getJwtSecretKey() {
  const raw = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !raw) {
    console.warn("[session] 生产环境未设置 JWT_SECRET，会话不安全且多实例可能互相验签失败");
  }
  return new TextEncoder().encode(
    raw || "maofu-crm-dev-secret-change-in-production"
  );
}

/**
 * 生产默认 Secure=true。内网仅用 HTTP 访问时请在 .env 设置 COOKIE_SECURE=false，
 * 否则浏览器不会保存会话 Cookie，表现为「登录成功一点菜单就退出」。
 */
export function sessionCookieSecure(): boolean {
  const v = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  if (v === "true" || v === "1" || v === "yes") return true;
  return process.env.NODE_ENV === "production";
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getJwtSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    const id = payload.id;
    const username = payload.username;
    const name = payload.name;
    const role = payload.role;
    if (
      typeof id !== "string" ||
      typeof username !== "string" ||
      typeof name !== "string" ||
      typeof role !== "string"
    ) {
      return null;
    }
    return {
      id,
      username,
      name,
      role: role as Role,
    };
  } catch {
    return null;
  }
}
