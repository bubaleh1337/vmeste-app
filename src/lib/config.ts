import type { AppLocale } from "@/lib/i18n";

function configuredName(value: string | undefined, legacyName: string, nextName: string): string {
  const configured = value?.trim();
  return !configured || configured === legacyName ? nextName : configured;
}

export const APP_NAME_RU = configuredName(process.env.NEXT_PUBLIC_APP_NAME, "Вместе", "Копим вместе");
export const APP_NAME_EN = configuredName(process.env.NEXT_PUBLIC_APP_NAME_EN, "Together", "Saving Together");

export function localizedAppName(locale: AppLocale): string {
  return locale === "en" ? APP_NAME_EN : APP_NAME_RU;
}
export const DEMO_GOAL_ID = "goal-demo-apartment";
export const SUPPORT_EMAIL = "ekaterina.pyshkova@gmail.com";
export const SUPPORT_TELEGRAM_URL = "https://t.me/kemisayega";
export const SUPPORT_TELEGRAM_LABEL = "@kemisayega";
export const SUPPORT_DONATION_URL = "https://buymeacoffee.com/kate.asmdef";
