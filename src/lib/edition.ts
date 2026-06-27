import { prisma } from "@/lib/prisma";
import type { AppEdition } from "@/generated/prisma/client";
import type { EditionKind, EditionState } from "@/lib/edition-types";

const GLOBAL_ID = "global";
const TRIAL_DAYS = 30;

async function ensureSettings() {
  return prisma.appSetting.upsert({
    where: { id: GLOBAL_ID },
    create: { id: GLOBAL_ID, edition: "STANDARD" },
    update: {},
  });
}

function hasPremiumAccess(settings: {
  premiumTrialEndsAt: Date | null;
  premiumSubscribedAt: Date | null;
}) {
  const now = new Date();
  if (settings.premiumSubscribedAt) return true;
  if (settings.premiumTrialEndsAt && settings.premiumTrialEndsAt > now) return true;
  return false;
}

function trialDaysLeft(endsAt: Date | null) {
  if (!endsAt) return null;
  const diff = endsAt.getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function serializeEdition(settings: {
  edition: AppEdition;
  premiumTrialStartedAt: Date | null;
  premiumTrialEndsAt: Date | null;
  premiumSubscribedAt: Date | null;
}): EditionState {
  const premiumAccess = hasPremiumAccess(settings);
  return {
    edition: settings.edition,
    premiumAccess,
    premiumTrialStartedAt: settings.premiumTrialStartedAt?.toISOString() ?? null,
    premiumTrialEndsAt: settings.premiumTrialEndsAt?.toISOString() ?? null,
    premiumSubscribedAt: settings.premiumSubscribedAt?.toISOString() ?? null,
    trialDaysLeft: trialDaysLeft(settings.premiumTrialEndsAt),
  };
}

export async function getEditionState(): Promise<EditionState> {
  const settings = await ensureSettings();
  return serializeEdition(settings);
}

export async function startPremiumTrial(userId: string) {
  await ensureSettings();
  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setDate(endsAt.getDate() + TRIAL_DAYS);

  const updated = await prisma.appSetting.update({
    where: { id: GLOBAL_ID },
    data: {
      edition: "PREMIUM",
      premiumTrialStartedAt: now,
      premiumTrialEndsAt: endsAt,
      updatedById: userId,
    },
  });
  return serializeEdition(updated);
}

export async function resetPremiumExperience(userId: string) {
  await ensureSettings();
  const updated = await prisma.appSetting.update({
    where: { id: GLOBAL_ID },
    data: {
      edition: "STANDARD",
      premiumTrialStartedAt: null,
      premiumTrialEndsAt: null,
      premiumSubscribedAt: null,
      updatedById: userId,
    },
  });
  return serializeEdition(updated);
}

export async function setEdition(edition: EditionKind, userId: string) {
  const settings = await ensureSettings();
  if (edition === "PREMIUM" && !hasPremiumAccess(settings)) {
    throw new Error("PREMIUM_ACCESS_REQUIRED");
  }

  const updated = await prisma.appSetting.update({
    where: { id: GLOBAL_ID },
    data: { edition, updatedById: userId },
  });
  return serializeEdition(updated);
}

export function isPremiumEdition(state: EditionState) {
  return state.edition === "PREMIUM" && state.premiumAccess;
}
