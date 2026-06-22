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
