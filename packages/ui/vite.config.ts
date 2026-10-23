import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// used by Storybook and the tests; apps that use the design system bring their own
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
