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
import { analytics } from "./src/analytics.ts";

const env = loadEnv(
  process.env.NODE_ENV ?? "production",
  process.cwd(),
  "PUBLIC_",
);
// where the Quote form posts (RequestQuote.astro)
const apiUrl = env.PUBLIC_API_URL ?? "http://localhost:3000";
const themeBoot = createHash("sha256").update(themeBootScript).digest("base64");
const beacon = analytics(env.PUBLIC_CF_ANALYTICS_TOKEN);

// a static site (ADR-0005): every page is prerendered to HTML at build time,
// and carries only the few scripts landing.spec.ts names ("the only
// JavaScript is …")
export default defineConfig({
  site: "https://www.empirecleaningandpro.com",
  output: "static",
  // What a page may load: its own files, the API the Quote form posts to,
  // Sentry, and Cloudflare's analytics beacon in a build with its token
  // (src/analytics.ts). Astro writes it into each page as a <meta>, with the
  // hashes of the page's own inline scripts; the headers a <meta> can't carry
  // (frame-ancestors) are set by the host (render.yaml,
  // render-production.yaml)
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        `connect-src 'self' ${[new URL(apiUrl).origin, ...monitoringOrigins(env.PUBLIC_SENTRY_DSN), ...(beacon?.connectSrc ?? [])].join(" ")}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        // these replace Astro's own 'self', so it's named too
        resources: ["'self'", ...(beacon?.scriptSrc ?? [])],
        // the theme boot script is inline (is:inline), which Astro doesn't hash
        hashes: [`sha256-${themeBoot}`],
      },
      // a few elements are styled inline, and a style can't run code
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
  // every page in English at its address, and in Spanish under /es/
  // (ADR-0025): its language is Astro.currentLocale (src/routes.ts)
  i18n: {
    locales: ["en", "es"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  integrations: [react(), sitemap()],
  // `astro dev`'s own toolbar sits over the page's foot and a prototype's
  // bar (src/pages/[...prototype].astro), and nothing here uses it
  devToolbar: { enabled: false },
  // the release, and source maps for Sentry's landing project
  vite: {
    plugins: [tailwindcss(), monitoringBuild("landing")],
    // `astro preview` on a port in use fails rather than moving on, as the
    // e2e tests wait for it on theirs (playwright.config.ts)
    preview: { strictPort: true },
  },
});
