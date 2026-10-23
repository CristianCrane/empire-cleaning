import type { Preview } from "@storybook/react-vite";
import { applyThemePreference, type ThemePreference } from "../src/theme.tsx";
import "../src/tokens.css";

declare global {
  var __EC_TEST_THEME__: ThemePreference | undefined;
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Light or dark theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      // the test run pins each project to one theme, so every story is checked
      // in both (see .storybook/test-theme-*.ts)
      const theme =
        globalThis.__EC_TEST_THEME__ ??
        (context.globals.theme as ThemePreference);
      // applied before the story renders, so its checks see the right colours
      applyThemePreference(theme);
      return <Story />;
    },
  ],
  parameters: {
    layout: "padded",
    backgrounds: { disable: true },
    controls: { expanded: true },
    // an accessibility violation fails the story's test, not just a warning
    a11y: { test: "error" },
    viewport: {
      options: {
        phone: {
          name: "Phone (iPhone SE)",
          styles: { width: "375px", height: "667px" },
          type: "mobile",
        },
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
          type: "tablet",
        },
      },
    },
  },
  tags: ["autodocs"],
};

export default preview;
