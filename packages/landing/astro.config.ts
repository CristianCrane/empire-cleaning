import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// a static site (ADR-0005): every page is prerendered to HTML at build time,
// and only interactive islands ship JavaScript
export default defineConfig({
  site: "https://www.empirecleaningandpro.com",
  output: "static",
  integrations: [react(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
