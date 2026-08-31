import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Совместные накопления и отдельная аналитика расходов",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F4EE",
    theme_color: "#F7F4EE",
    lang: "ru",
  };
}
