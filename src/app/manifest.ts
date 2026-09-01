import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";
import { getCookieLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getCookieLocale();
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: tr(locale, "Совместные накопления и отдельная аналитика расходов", "Shared savings with separate expense analytics"),
    start_url: "/",
    display: "standalone",
    background_color: "#F7F4EE",
    theme_color: "#F7F4EE",
    lang: locale === "en" ? "en" : "ru",
  };
}
