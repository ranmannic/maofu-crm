"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentHref,
  popNavStack,
  pushNavStack,
  savePageState,
} from "@/lib/app-navigation";

export function useAppNavigation() {
  const router = useRouter();

  const navigate = useCallback(
    (
      href: string,
      options?: {
        pageStateKey?: string;
        pageState?: object;
      }
    ) => {
      if (options?.pageStateKey && options.pageState) {
        savePageState(options.pageStateKey, options.pageState);
      }
      pushNavStack(getCurrentHref());
      router.push(href);
    },
    [router]
  );

  const goBack = useCallback(
    (fallback: string) => {
      const target = popNavStack() ?? fallback;
      router.push(target);
    },
    [router]
  );

  return { navigate, goBack };
}
