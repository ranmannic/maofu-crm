/** 中国大陆手机号：1 开头 11 位 */
const CN_MOBILE_RE = /^1[3-9]\d{9}$/;

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isValidCnMobile(raw: string): boolean {
  return CN_MOBILE_RE.test(normalizePhone(raw));
}

export function formatCnMobile(raw: string): string {
  const digits = normalizePhone(raw);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}****${cleaned.slice(7)}`;
  }
  if (cleaned.length > 7) {
    const start = Math.floor((cleaned.length - 4) / 2);
    return cleaned.slice(0, start) + "****" + cleaned.slice(start + 4);
  }
  return "****";
}

export function formatPhoneForRole(
  phone: string | null | undefined,
  canViewFull: boolean
): string {
  if (!phone) return "-";
  return canViewFull ? phone : maskPhone(phone);
}
