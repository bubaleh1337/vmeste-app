import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "./config";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = requireSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          if (headers) {
            // Next.js Server Components cannot write response headers directly.
            // Proxy applies the refresh headers on navigations.
          }
        } catch {
          // Called from a Server Component. Proxy is responsible for refreshing cookies.
        }
      },
    },
  });
}
