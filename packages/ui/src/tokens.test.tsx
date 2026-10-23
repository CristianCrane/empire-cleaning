import { afterEach, describe, expect, test } from "vitest";
import { applyThemePreference } from "./theme.tsx";

// reads the colour a token resolves to in the current theme, as the browser does
const resolve = (token: string) => {
  const probe = document.createElement("div");
  probe.style.color = `var(--ec-${token})`;
  document.body.append(probe);
  const [r, g, b] = getComputedStyle(probe)
    .color.match(/\d+(\.\d+)?/g)!
    .map(Number);
  probe.remove();
  return [r!, g!, b!] as const;
};

const luminance = ([r, g, b]: readonly [number, number, number]) => {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
};

const contrast = (fg: string, bg: string) => {
  const [a, b] = [luminance(resolve(fg)), luminance(resolve(bg))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

// WCAG AA: 4.5:1 for text, 3:1 for control outlines and focus rings
const text = 4.5;
const ui = 3;
const pairs: [fg: string, bg: string, min: number][] = [
  ["fg", "bg", text],
  ["fg", "surface", text],
  ["fg", "surface-sunken", text],
  ["fg", "overlay", text],
  ["fg-muted", "bg", text],
  ["fg-muted", "surface", text],
  ["fg-muted", "surface-sunken", text],
  ["fg-muted", "overlay", text],
  ["primary-fg", "primary", text],
  ["primary-fg", "primary-hover", text],
  ["primary", "surface", text],
  ["danger-fg", "danger", text],
  ["danger-fg", "danger-hover", text],
  ["danger-strong", "bg", text],
  ["danger-strong", "surface", text],
  ["success-strong", "success-subtle", text],
  ["warning-strong", "warning-subtle", text],
  ["danger-strong", "danger-subtle", text],
  ["info-strong", "info-subtle", text],
  ["neutral-strong", "neutral-subtle", text],
  ["border-strong", "surface", ui],
  ["focus", "bg", ui],
  ["focus", "surface", ui],
];

afterEach(() => applyThemePreference("system"));

describe.each(["light", "dark"] as const)("%s theme", (theme) => {
  test.each(pairs)("%s on %s is readable", (fg, bg, min) => {
    applyThemePreference(theme);

    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  test("the two themes really differ", () => {
    applyThemePreference(theme);
    const page = resolve("bg");

    expect(luminance(page) > 0.5).toBe(theme === "light");
  });
});
