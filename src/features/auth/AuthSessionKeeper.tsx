"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function AuthSessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    let active = true;
    let recovery: Promise<void> | null = null;

    const recoverSession = () => {
      if (!active || recovery || (typeof navigator !== "undefined" && !navigator.onLine)) return;

      recovery = supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (active && !error && data.session) router.refresh();
        })
        .finally(() => {
          recovery = null;
        });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") recoverSession();
    };

    // iOS can freeze an installed web app without delivering timer ticks or a
    // normal visibility transition. These three signals cover a cold restore,
    // a background resume and reconnecting after the phone was offline.
    recoverSession();
    window.addEventListener("pageshow", recoverSession);
    window.addEventListener("online", recoverSession);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("pageshow", recoverSession);
      window.removeEventListener("online", recoverSession);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
