import type { MetadataRoute } from "next";
import { localizedAppName } from "@/lib/config";
import { getCookieLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getCookieLocale();
  const appName = localizedAppName(locale);
  return {
    name: appName,
    short_name: appName,
    description: tr(locale, "Совместные накопления и отдельная аналитика расходов", "Shared savings with separate expense analytics"),
    start_url: "/",
    display: "standalone",
    background_color: "#F7F4EE",
    theme_color: "#F7F4EE",
    lang: locale === "en" ? "en" : "ru",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
