import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { themeBootScript } from "@empire-cleaning/ui/theme-boot";

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
  server: { port: 5173, strictPort: true },
});
