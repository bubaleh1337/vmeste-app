import "server-only";
import { headers } from "next/headers";

function normalizeOrigin(value: string): string {
  const raw = value.trim().replace(/\/+$/, "");
  if (!raw) return "";
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
}

export async function getAppUrl(): Promise<string> {
  const explicit = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL ?? "");
  if (explicit) return explicit;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (host) {
    const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
    const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const protocol = forwardedProtocol ?? (isLocal ? "http" : "https");
    return `${protocol}://${host}`;
  }

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelHost) return normalizeOrigin(vercelHost);

  return "http://localhost:3000";
}
