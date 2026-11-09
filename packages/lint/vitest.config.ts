import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "lint", include: ["src/**/*.test.ts"] },
});
