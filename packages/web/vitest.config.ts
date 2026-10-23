import { defineConfig, mergeConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import viteConfig from "./vite.config.ts";

// feature screens are tested in a real Chromium, like the design system
// (packages/ui); Vitest's default frame is 414px wide, i.e. phone width
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ["src/**/*.test.tsx"],
      passWithNoTests: true,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: "chromium", name: "web" }],
      },
    },
  }),
);
