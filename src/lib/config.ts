import type { AppLocale } from "@/lib/i18n";

export const APP_NAME_RU = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Вместе";
export const APP_NAME_EN = process.env.NEXT_PUBLIC_APP_NAME_EN?.trim() || "Together";

export function localizedAppName(locale: AppLocale): string {
  return locale === "en" ? APP_NAME_EN : APP_NAME_RU;
}
export const DEMO_GOAL_ID = "goal-demo-apartment";
export const SUPPORT_EMAIL = "ekaterina.pyshkova@gmail.com";
export const SUPPORT_TELEGRAM_URL = "https://t.me/kemisayega";
export const SUPPORT_TELEGRAM_LABEL = "@kemisayega";
export const SUPPORT_DONATION_URL = "https://buymeacoffee.com/kate.asmdef";
