"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { EditionKind, EditionState } from "@/lib/edition-types";
import type { SessionUser } from "@/lib/auth-types";

interface EditionContextValue extends EditionState {
  loading: boolean;
  isPremiumActive: boolean;
  refresh: () => Promise<void>;
  startTrial: () => Promise<boolean>;
  switchEdition: (edition: EditionKind) => Promise<boolean>;
  resetExperience: () => Promise<boolean>;
}

const EditionContext = createContext<EditionContextValue | null>(null);

function applyEditionDom(edition: EditionKind, premiumAccess: boolean) {
  const active = edition === "PREMIUM" && premiumAccess;
  document.documentElement.dataset.edition = active ? "premium" : "standard";
}

export function EditionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<EditionState>({
    edition: "STANDARD",
    premiumAccess: false,
    premiumTrialStartedAt: null,
    premiumTrialEndsAt: null,
    premiumSubscribedAt: null,
    trialDaysLeft: null,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/edition");
      if (res.ok) {
        const data = (await res.json()) as EditionState;
        setState(data);
        applyEditionDom(data.edition, data.premiumAccess);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startTrial = useCallback(async () => {
    const res = await fetch("/api/edition/trial", { method: "POST" });
    if (!res.ok) return false;
    const data = (await res.json()) as EditionState;
    setState(data);
    applyEditionDom(data.edition, data.premiumAccess);
    return true;
  }, []);

  const switchEdition = useCallback(async (edition: EditionKind) => {
    if (user.role !== "ADMIN") return false;
    const res = await fetch("/api/edition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edition }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as EditionState;
    setState(data);
    applyEditionDom(data.edition, data.premiumAccess);
    return true;
  }, [user.role]);

  const resetExperience = useCallback(async () => {
    if (user.role !== "ADMIN") return false;
    const res = await fetch("/api/edition/reset", { method: "POST" });
    if (!res.ok) return false;
    const data = (await res.json()) as EditionState;
    setState(data);
    applyEditionDom(data.edition, data.premiumAccess);
    return true;
  }, [user.role]);

  const value = useMemo(
    () => ({
      ...state,
      loading,
      isPremiumActive: state.edition === "PREMIUM" && state.premiumAccess,
      refresh,
      startTrial,
      switchEdition,
      resetExperience,
    }),
    [state, loading, refresh, startTrial, switchEdition, resetExperience]
  );

  return (
    <EditionContext.Provider value={value}>{children}</EditionContext.Provider>
  );
}

export function useEdition() {
  const ctx = useContext(EditionContext);
  if (!ctx) throw new Error("useEdition must be used within EditionProvider");
  return ctx;
}
