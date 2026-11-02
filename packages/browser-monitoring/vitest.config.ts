import { defineConfig } from "vitest/config";

export default defineConfig({
  // set at build (src/vite.ts)
  define: { __RELEASE__: "null" },
  test: {
    name: "browser-monitoring",
    include: ["src/**/*.test.ts"],
  },
});
