import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "models",
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
