import { defineConfig, mergeConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import type { BrowserCommand } from "vitest/node";
import viteConfig from "./vite.config.ts";

// Keep headless Chromium off the WSLg display so it doesn't steal Windows focus
delete process.env.DISPLAY;
delete process.env.WAYLAND_DISPLAY;

// a device set to dark mode, for what must follow the app's own theme
// instead (feedback.test.tsx)
const darkDevice: BrowserCommand<[]> = async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
};

// feature screens are tested in a real Chromium, like the design system
// (packages/ui); Vitest's default frame is 414px wide, i.e. phone width
export default mergeConfig(
  viteConfig,
  defineConfig({
    // the dev server's strictPort (vite.config.ts) held the tests' browser
    // server to Vitest's one port, 63315, so another checkout's run at the
    // same time failed; like the design system's, it moves to the next free one
    server: { strictPort: false },
    test: {
      include: ["src/**/*.test.tsx"],
      passWithNoTests: true,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: "chromium", name: "web" }],
        commands: { darkDevice },
      },
    },
  }),
);
