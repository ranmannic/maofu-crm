import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/client";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "maofu-crm-dev-secret-change-in-production"
);

const publicPaths = ["/login", "/api/auth/login"];

function isPublicPath(pathname: string) {
  if (publicPaths.some((p) => pathname === p)) return true;
  if (pathname.startsWith("/share")) return true;
  if (pathname.startsWith("/api/share")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("maofu_session")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const role = payload.role as Role;

    if (
      pathname.startsWith("/products") ||
      pathname.startsWith("/users") ||
      pathname.startsWith("/channels")
    ) {
      if (role !== "ADMIN") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "无权限" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    if (pathname.startsWith("/workbench")) {
      if (role !== "OPERATIONS") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "无权限" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("maofu_session");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
