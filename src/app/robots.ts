import type { MetadataRoute } from "next";
import { allowSearchIndexing } from "@/lib/supabase/config";

export default function robots(): MetadataRoute.Robots {
  if (allowSearchIndexing()) {
    return { rules: { userAgent: "*", allow: "/" } };
  }

  return { rules: { userAgent: "*", disallow: "/" } };
}
