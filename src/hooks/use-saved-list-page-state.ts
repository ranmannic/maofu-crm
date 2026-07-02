"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  clearPageState,
  peekPageState,
  restoreScrollY,
} from "@/lib/app-navigation";

export function getListPageSnapshot<T extends { scrollY?: number }>(
  routeKey: string
): { data: Omit<T, "scrollY">; scrollY?: number } | null {
  if (typeof window === "undefined") return null;
  const saved = peekPageState<T>(routeKey);
  if (!saved) return null;
  const { scrollY, ...data } = saved;
  return { data: data as Omit<T, "scrollY">, scrollY };
}

/** 列表内容渲染完成后恢复滚动并清除缓存 */
export function useRestoreListPageScroll(
  routeKey: string,
  scrollY: number | undefined,
  contentReady: boolean
) {
  const restored = useRef(false);

  useEffect(() => {
    if (!contentReady || restored.current) return;
    restored.current = true;
    if (scrollY != null) restoreScrollY(scrollY);
    clearPageState(routeKey);
  }, [contentReady, routeKey, scrollY]);
}

export function useListPageSnapshot<T extends { scrollY?: number }>(
  routeKey: string
) {
  return useMemo(() => getListPageSnapshot<T>(routeKey), [routeKey]);
}
