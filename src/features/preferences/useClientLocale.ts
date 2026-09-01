"use client";

import { useSyncExternalStore } from "react";
import type { AppLocale } from "@/lib/i18n";

function subscribe() {
  return () => undefined;
}

function browserSnapshot(): AppLocale {
  if (typeof document === "undefined") return "ru";
  const match = document.cookie.match(/(?:^|;\s*)vmeste_locale=([^;]+)/);
  return match?.[1] === "en" ? "en" : "ru";
}

function serverSnapshot(): AppLocale {
  return "ru";
}

export function useClientLocale(): AppLocale {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}
