export type EditionKind = "STANDARD" | "PREMIUM";

export interface EditionState {
  edition: EditionKind;
  premiumAccess: boolean;
  premiumTrialStartedAt: string | null;
  premiumTrialEndsAt: string | null;
  premiumSubscribedAt: string | null;
  trialDaysLeft: number | null;
}

export const EDITION_LABELS: Record<EditionKind, string> = {
  STANDARD: "普通版",
  PREMIUM: "高级版",
};
