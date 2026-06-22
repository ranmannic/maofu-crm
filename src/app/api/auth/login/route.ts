import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateUser, createSession } from "@/lib/auth";
import { apiError } from "@/lib/api";

const loginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    const user = await authenticateUser(username, password);
    if (!user) {
      return apiError("用户名或密码错误", 401);
    }

    await createSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.issues[0]?.message || "参数错误");
    }
    return apiError("登录失败", 500);
  }
}
