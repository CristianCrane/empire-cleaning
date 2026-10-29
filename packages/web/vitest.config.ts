import { defineConfig, mergeConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import viteConfig from "./vite.config.ts";

// Keep headless Chromium off the WSLg display so it doesn't steal Windows focus
delete process.env.DISPLAY;
delete process.env.WAYLAND_DISPLAY;

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
