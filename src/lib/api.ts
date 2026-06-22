import { NextResponse } from "next/server";

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return apiError("请先登录", 401);
    }
    if (error.message === "FORBIDDEN") {
      return apiError("无权限执行此操作", 403);
    }
  }
  console.error(error);
  return apiError("服务器错误", 500);
}
