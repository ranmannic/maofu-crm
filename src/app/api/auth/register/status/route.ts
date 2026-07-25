import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { isRegisterAvailable } from "@/lib/register";

export async function GET() {
  try {
    return NextResponse.json({ available: await isRegisterAvailable() });
  } catch (error) {
    return handleApiError(error);
  }
}
