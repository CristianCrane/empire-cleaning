import { createHash } from "node:crypto";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { themeBootScript } from "@empire-cleaning/ui/theme-boot";
import {
  monitoringBuild,
  monitoringOrigins,
} from "@empire-cleaning/browser-monitoring/vite";

const env = loadEnv(
  process.env.NODE_ENV ?? "production",
  process.cwd(),
  "PUBLIC_",
);
// where the Quote form posts (RequestQuote.astro)
const apiUrl = env.PUBLIC_API_URL ?? "http://localhost:3000";
const themeBoot = createHash("sha256").update(themeBootScript).digest("base64");

// a static site (ADR-0005): every page is prerendered to HTML at build time,
// and only interactive islands ship JavaScript
export default defineConfig({
  site: "https://www.empirecleaningandpro.com",
  output: "static",
  // What a page may load: its own files, the API the Quote form posts to and
  // Sentry. Astro writes it into each page as a <meta>, with the hashes of the
  // page's own inline scripts; the headers a <meta> can't carry
  // (frame-ancestors) are set by the host (render.yaml)
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        `connect-src 'self' ${[new URL(apiUrl).origin, ...monitoringOrigins(env.PUBLIC_SENTRY_DSN)].join(" ")}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      // the theme boot script is inline (is:inline), which Astro doesn't hash
      scriptDirective: { hashes: [`sha256-${themeBoot}`] },
      // a few elements are styled inline, and a style can't run code
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
  integrations: [react(), sitemap()],
  // the release, and source maps for Sentry's landing project
  vite: {
    plugins: [tailwindcss(), monitoringBuild("landing")],
    // `astro preview` on a port in use fails rather than moving on, as the
    // e2e tests wait for it on theirs (playwright.config.ts)
    preview: { strictPort: true },
  },
});
