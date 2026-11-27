import type { LucideIcon } from "lucide-react";
import { Link as AriaLink, type LinkProps } from "react-aria-components";
import { TileLabel, tileForm } from "./tile.tsx";
import { focusRing } from "./utils.ts";

const tile = `${tileForm} min-h-touch no-underline`;

// one shortcut, a Home's tile that links (HomeTiles): what it does, and a
// hint of what's there (the card on file, a phone number, how many), so a
// glance often answers without opening it. `href`
// goes through the app's router; `externalHref` is for tel: and mailto:.
// With none there (`isDisabled`) it's greyed out and can't be pressed, as
// a CountTile with none is (#499's UX review U15)
export function ShortcutTile({
  icon,
  label,
  hint,
  href,
  externalHref,
  isDisabled,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  href?: LinkProps["href"];
  externalHref?: string;
  isDisabled?: boolean;
}) {
  const body = (
    <>
      <TileLabel icon={icon} label={label} />
      <span className="font-semibold text-fg [overflow-wrap:anywhere]">
        {hint}
      </span>
    </>
  );
  return externalHref ? (
    <a href={externalHref} className={`${focusRing()} ${tile}`}>
      {body}
    </a>
  ) : (
    <AriaLink
      href={href}
      isDisabled={isDisabled}
      className={(renderProps) => `${focusRing(renderProps)} ${tile}`}
    >
      {body}
    </AriaLink>
  );
}
