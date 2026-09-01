import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      // Temporary ESLint 10 compatibility workaround for eslint-plugin-react.
      // Explicit version avoids the plugin's removed context.getFilename() path.
      react: { version: "19.2.8" },
    },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "eslint.config.mjs",
    "postcss.config.mjs",
    "public/pdf.worker.min.mjs",
  ]),
]);
