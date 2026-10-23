import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { themeBootScript } from "@empire-cleaning/ui/theme-boot";

// where /api requests go; the end-to-end tests point this at their own server
const apiUrl = process.env.API_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // a pinned light or dark theme applies before first paint
      name: "theme-boot",
      transformIndexHtml: () => [
        { tag: "script", children: themeBootScript, injectTo: "head" },
      ],
    },
  ],
  // the app and the API share one origin, so sign-in cookies just work; in
  // production /api is routed to the server the same way
  server: { port: 5173, strictPort: true, proxy: { "/api": apiUrl } },
  preview: { proxy: { "/api": apiUrl } },
});
