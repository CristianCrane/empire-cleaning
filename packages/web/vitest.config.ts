import path from "node:path";
import {
  defineConfig,
  mergeConfig,
  type TestProjectInlineConfiguration,
} from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteConfig from "./vite.config.ts";

// every test runs in a real Chromium, never a simulated DOM. Vitest's default
// frame is 414px wide, so everything is also exercised at phone width.
const browser = (name: string) => ({
  enabled: true,
  headless: true,
  provider: playwright(),
  instances: [{ browser: "chromium" as const, name }],
});

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
    setupFiles: [`./.storybook/test-theme-${theme}.ts`],
    browser: browser(`web-storybook-${theme}`),
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
            include: ["src/**/*.test.tsx"],
            setupFiles: ["./src/test-setup.ts"],
            browser: browser("web"),
          },
        },
        storybookProject("light"),
        storybookProject("dark"),
      ],
    },
  }),
);
