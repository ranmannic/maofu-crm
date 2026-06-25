import { randomBytes } from "crypto";

export function generateShareToken() {
  return randomBytes(16).toString("hex");
}
