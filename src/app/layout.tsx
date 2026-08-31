import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/config";
import { allowSearchIndexing } from "@/lib/supabase/config";

const indexingEnabled = allowSearchIndexing();

export const metadata: Metadata = {
  title: `${APP_NAME} — совместные накопления`,
  description: "Совместные накопления на цели и отдельная аналитика расходов.",
  robots: { index: indexingEnabled, follow: indexingEnabled },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <a className="skip-link" href="#main-content">Перейти к содержимому</a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
