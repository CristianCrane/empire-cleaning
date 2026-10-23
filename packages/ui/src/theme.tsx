import { useEffect, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "./theme-boot.ts";
import { focusRing } from "./utils.ts";

export type ThemePreference = "system" | "light" | "dark";

// remembered per device; storage can be unavailable (private browsing), in
// which case the app just follows the device
export const readThemePreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
};

export const applyThemePreference = (preference: ThemePreference) => {
  const root = document.documentElement;
  if (preference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preference);
  }

  try {
    if (preference === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  } catch {
    // not remembered, still applied
  }
};

const options = [
  { id: "system", label: "Match device", Icon: Monitor },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
] as const;

export function ThemeToggle() {
  // read after mounting, not during render: a page prerendered at build time
  // (the landing site) can't know this device's choice
  const [preference, setPreference] = useState<ThemePreference>("system");
  useEffect(() => setPreference(readThemePreference()), []);

  return (
    <ToggleButtonGroup
      aria-label="Theme"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[preference]}
      onSelectionChange={(keys) => {
        const [next] = [...keys] as ThemePreference[];
        if (!next) return;
        setPreference(next);
        applyThemePreference(next);
      }}
      className="inline-flex self-start rounded-md border border-border-strong p-0.5"
    >
      {options.map(({ id, label, Icon }) => (
        <ToggleButton
          key={id}
          id={id}
          aria-label={label}
          className={(renderProps) =>
            `${focusRing(renderProps)} flex size-9 items-center justify-center rounded-sm text-fg-muted hover:text-fg selected:bg-primary selected:text-primary-fg`
          }
        >
          <Icon aria-hidden size={18} />
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
