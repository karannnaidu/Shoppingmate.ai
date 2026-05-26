'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

declare global {
  interface Window {
    __shoppingmateNavigate__?: (path: string) => void;
  }
}

// Exposes Next.js's client router to the shoppingmate widget. Without this the
// widget falls back to window.location.assign() which hard-reloads the page —
// slow, kills the active voice call, and tears down the widget state.
export function BotRouterBridge() {
  const router = useRouter();
  useEffect(() => {
    window.__shoppingmateNavigate__ = (path) => {
      router.push(path);
    };
    return () => {
      delete window.__shoppingmateNavigate__;
    };
  }, [router]);
  return null;
}
