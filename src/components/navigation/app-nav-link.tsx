"use client";

import { type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useAppNavigation } from "@/hooks/use-app-navigation";

export function AppNavLink({
  href,
  children,
  className,
  pageStateKey,
  pageState,
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  pageStateKey?: string;
  pageState?: object;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { navigate } = useAppNavigation();

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(
          href,
          pageStateKey && pageState
            ? { pageStateKey, pageState }
            : undefined
        );
      }}
    >
      {children}
    </Link>
  );
}
