import { useEffect, useState } from "react";
import { ToggleButton } from "react-aria-components";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "./theme-boot.ts";
import { focusRing } from "./utils.ts";

// light unless someone chooses dark; the device's own setting isn't followed
export type ThemePreference = "light" | "dark";

// remembered per device; storage can be unavailable (private browsing), in
// which case it's light
export const readThemePreference = (): ThemePreference => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

export const applyThemePreference = (preference: ThemePreference) => {
  const root = document.documentElement;
  if (preference === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }

  try {
    if (preference === "dark") {
      localStorage.setItem(STORAGE_KEY, "dark");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // not remembered, still applied
  }
};

// one quiet button: a moon to switch to dark, a sun to switch back
export function ThemeToggle() {
  // read after mounting, not during render: a page prerendered at build time
  // (the landing site) can't know this device's choice
  const [preference, setPreference] = useState<ThemePreference>("light");
  useEffect(() => setPreference(readThemePreference()), []);
  const isDark = preference === "dark";

  return (
    <ToggleButton
      aria-label="Dark theme"
      isSelected={isDark}
      onChange={(dark) => {
        const next = dark ? "dark" : "light";
        setPreference(next);
        applyThemePreference(next);
      }}
      className={(renderProps) =>
        `${focusRing(renderProps)} flex size-touch shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunken hover:text-fg pressed:bg-surface-sunken`
      }
    >
      {isDark ? <Sun aria-hidden size={20} /> : <Moon aria-hidden size={20} />}
    </ToggleButton>
  );
}
