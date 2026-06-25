/** 分享页手机号脱敏：138****5678 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}****${digits.slice(7)}`;
  }
  const head = digits.slice(0, Math.min(3, digits.length - 4));
  const tail = digits.slice(-4);
  return `${head}****${tail}`;
}
