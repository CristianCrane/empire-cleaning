import type { LucideIcon } from "lucide-react";
import { Link as AriaLink, type LinkProps } from "react-aria-components";
import { focusRing } from "./utils.ts";

// a CountTile's form, so the two side by side read as one kind of thing,
// both raised as what can be pressed (#499's UX review U4)
const tile =
  "flex h-full min-h-touch w-full min-w-0 flex-col items-start gap-1 rounded-lg border border-border bg-surface p-3 text-left no-underline shadow-raised transition-colors hover:bg-surface-sunken sm:p-4";

// one shortcut, a Home's tile that links (HomeTiles): what it does, and a
// hint of what's there (the card on file, a phone number, how many), so a
// glance often answers without opening it. `href`
// goes through the app's router; `externalHref` is for tel: and mailto:.
export function ShortcutTile({
  icon: Icon,
  label,
  hint,
  href,
  externalHref,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  href?: LinkProps["href"];
  externalHref?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
        <Icon aria-hidden size={18} className="shrink-0" />
        {label}
      </span>
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
      className={(renderProps) => `${focusRing(renderProps)} ${tile}`}
    >
      {body}
    </AriaLink>
  );
}
