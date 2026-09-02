import type { Metadata } from "next";
import "./globals.css";
import { localizedAppName } from "@/lib/config";
import { tr } from "@/lib/i18n";
import { getCookiePreferences } from "@/lib/i18n/server";
import { allowSearchIndexing } from "@/lib/supabase/config";
import { AuthSessionKeeper } from "@/features/auth/AuthSessionKeeper";

const indexingEnabled = allowSearchIndexing();

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getCookiePreferences();
  const appName = localizedAppName(locale);
  return {
    title: tr(locale, `${appName} — совместные накопления`, `${appName} — shared savings`),
    description: tr(locale, "Совместные накопления на цели и отдельная аналитика расходов.", "Shared savings goals with separate expense analytics."),
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
        { url: "/icons/favicon.svg", type: "image/svg+xml" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    robots: { index: indexingEnabled, follow: indexingEnabled },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, theme, font } = await getCookiePreferences();
  return (
    <html lang={locale} data-theme={theme} data-font={font}>
      <body>
        <AuthSessionKeeper />
        <a className="skip-link" href="#main-content">{tr(locale, "Перейти к содержимому", "Skip to content")}</a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
