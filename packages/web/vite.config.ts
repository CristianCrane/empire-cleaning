import { createHash } from "node:crypto";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { themeBootScript } from "@empire-cleaning/ui/theme-boot";
import {
  monitoringBuild,
  monitoringOrigins,
} from "@empire-cleaning/browser-monitoring/vite";

// where /api requests go; the end-to-end tests point this at their own server
const apiUrl = process.env.API_URL ?? "http://localhost:3000";

// Stripe.js and its Payment Element, as Stripe's security guide lists them
// (https://docs.stripe.com/security/guide.md#content-security-policy)
const stripeScripts = ["https://js.stripe.com", "https://*.js.stripe.com"];
const stripeFrames = [...stripeScripts, "https://hooks.stripe.com"];
const stripeApi = ["https://api.stripe.com"];

const contentSecurityPolicy = (sentryDsn: string | undefined) => {
  const themeBoot = createHash("sha256")
    .update(themeBootScript)
    .digest("base64");
  return Object.entries({
    "default-src": ["'self'"],
    "script-src": ["'self'", `'sha256-${themeBoot}'`, ...stripeScripts],
    // Stripe.js adds <style> elements to the page, and a style can't run code
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "https://*.googleusercontent.com"],
    "connect-src": ["'self'", ...stripeApi, ...monitoringOrigins(sentryDsn)],
    "frame-src": stripeFrames,
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  })
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
};

// What the built app may load: its own files, Stripe and Sentry, and the
// profile photos Google sign-in gives (Avatar). Anything else, such as an
// injected script, is refused. As a <meta>, so the end-to-end tests run with
// it too; the headers a <meta> can't carry (frame-ancestors) are set by the
// host (render.yaml). Not in dev, where Vite's reloading runs inline scripts.
const contentSecurityPolicyMeta = (): Plugin => {
  let policy = "";
  return {
    name: "content-security-policy",
    apply: "build",
    configResolved: (config) => {
      policy = contentSecurityPolicy(config.env.VITE_SENTRY_DSN);
    },
    // first after the charset, which must stay in the page's first 1024
    // bytes, so the policy covers every script and stylesheet after it
    transformIndexHtml: (html) => {
      const charset = '<meta charset="UTF-8" />';
      if (!html.includes(charset)) throw new Error(`no ${charset}`);
      return html.replace(
        charset,
        `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // the release, and source maps for Sentry's web project
    monitoringBuild("web"),
    {
      // a pinned light or dark theme applies before first paint
      name: "theme-boot",
      transformIndexHtml: () => [
        { tag: "script", children: themeBootScript, injectTo: "head" },
      ],
    },
    contentSecurityPolicyMeta(),
  ],
  // the app and the API share one origin, so sign-in cookies just work; in
  // production /api is routed to the server the same way
  server: { port: 5173, strictPort: true, proxy: { "/api": apiUrl } },
  preview: { proxy: { "/api": apiUrl } },
});
