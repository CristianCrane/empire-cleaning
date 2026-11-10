import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "lint",
    include: ["src/**/*.test.ts"],
    // RuleTester runs each case as a test through the global describe and it
    globals: true,
  },
});
