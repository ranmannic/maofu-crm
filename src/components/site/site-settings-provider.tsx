"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type PublicSiteSettingsState = {
  siteName: string;
  siteIconUrl: string | null;
  refresh: () => Promise<void>;
};

const SiteSettingsContext = createContext<PublicSiteSettingsState>({
  siteName: "毛府酒庄",
  siteIconUrl: null,
  refresh: async () => {},
});

export function SiteSettingsProvider({
  initialSettings,
  children,
}: {
  initialSettings: Omit<PublicSiteSettingsState, "refresh">;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);

  const refresh = useCallback(async () => {
    fetch("/api/site/public")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.siteName) setSettings(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SiteSettingsContext.Provider value={{ ...settings, refresh }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
