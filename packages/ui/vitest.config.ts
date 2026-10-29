import path from "node:path";
import {
  defineConfig,
  mergeConfig,
  type TestProjectInlineConfiguration,
} from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteConfig from "./vite.config.ts";

// Keep headless Chromium off the WSLg display so it doesn't steal Windows focus
delete process.env.DISPLAY;
delete process.env.WAYLAND_DISPLAY;

// every test runs in a real Chromium, never a simulated DOM. Vitest's default
// frame is 414px wide, so everything is also exercised at phone width.
const browser = (name: string) => ({
  enabled: true,
  headless: true,
  provider: playwright(),
  instances: [{ browser: "chromium" as const, name }],
});

// Three projects each open many browser pages at once. A few at a time
// measured faster than all at once (about 45 s against 66 s) and steadier, and
// the longer timeouts leave room for a slow machine.
const limits = { maxWorkers: 3, testTimeout: 30_000, hookTimeout: 30_000 };

// renders every story and runs its interactions and accessibility checks
// (including colour contrast), once per theme
const storybookProject = (
  theme: "light" | "dark",
): TestProjectInlineConfiguration => ({
  extends: true,
  plugins: [
    storybookTest({ configDir: path.join(import.meta.dirname, ".storybook") }),
  ],
  test: {
    ...limits,
    setupFiles: [`./.storybook/test-theme-${theme}.ts`],
    browser: browser(`ui-storybook-${theme}`),
  },
});

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            ...limits,
            include: ["src/**/*.test.tsx"],
            setupFiles: ["./src/test-setup.ts"],
            browser: browser("ui"),
          },
        },
        storybookProject("light"),
        storybookProject("dark"),
      ],
    },
  }),
);
