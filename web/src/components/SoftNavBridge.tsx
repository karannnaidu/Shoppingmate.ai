"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    __shoppingmateSoftNav?: (path: string) => Promise<void>;
  }
}

const RENDER_SETTLE_MS = 250;

export function SoftNavBridge() {
  const router = useRouter();

  useEffect(() => {
    window.__shoppingmateSoftNav = (path: string) =>
      new Promise<void>((resolve) => {
        router.push(path);
        setTimeout(resolve, RENDER_SETTLE_MS);
      });
    return () => {
      if (window.__shoppingmateSoftNav) delete window.__shoppingmateSoftNav;
    };
  }, [router]);

  return null;
}
