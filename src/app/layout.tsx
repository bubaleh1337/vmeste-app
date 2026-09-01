import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/config";
import { tr } from "@/lib/i18n";
import { getCookiePreferences } from "@/lib/i18n/server";
import { allowSearchIndexing } from "@/lib/supabase/config";

const indexingEnabled = allowSearchIndexing();

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getCookiePreferences();
  return {
    title: tr(locale, `${APP_NAME} — совместные накопления`, `${APP_NAME} — shared savings`),
    description: tr(locale, "Совместные накопления на цели и отдельная аналитика расходов.", "Shared savings goals with separate expense analytics."),
    robots: { index: indexingEnabled, follow: indexingEnabled },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, theme, font } = await getCookiePreferences();
  return (
    <html lang={locale} data-theme={theme} data-font={font}>
      <body>
        <a className="skip-link" href="#main-content">{tr(locale, "Перейти к содержимому", "Skip to content")}</a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
