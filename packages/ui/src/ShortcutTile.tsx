import type { LucideIcon } from "lucide-react";
import { Children, type ReactNode } from "react";
import { Link as AriaLink, type LinkProps } from "react-aria-components";
import { focusRing } from "./utils.ts";

// on a wider screen, a column a tile, up to four, so fewer fill the row
const wideColumns = [
  "sm:grid-cols-1",
  "sm:grid-cols-2",
  "sm:grid-cols-3",
  "sm:grid-cols-4",
];

// quick ways into what a person can do from where they stand, e.g. under
// the Client's next clean: two a row on a phone, an odd one out spanning
// the row; up to four on a wider screen, filling it, with no gap at the end
export function ShortcutTiles({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const count = Children.toArray(children).length;
  const wide = wideColumns[Math.min(Math.max(count, 1), 4) - 1];
  return (
    <nav aria-label={label}>
      <ul
        className={`grid grid-cols-2 gap-3 ${wide} [&>li:last-child:nth-child(odd)]:col-span-2 sm:[&>li:last-child:nth-child(odd)]:col-span-1`}
      >
        {children}
      </ul>
    </nav>
  );
}

const tile =
  "flex h-full min-h-touch flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left no-underline hover:bg-surface-sunken";

// one shortcut: what it does, and a hint of what's there (the card on file,
// a phone number), so a glance often answers without opening it. `href`
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
      <Icon aria-hidden size={22} className="text-primary" />
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-fg">{label}</span>
        <span className="text-sm text-fg-muted [overflow-wrap:anywhere]">
          {hint}
        </span>
      </span>
    </>
  );
  return (
    <li>
      {externalHref ? (
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
      )}
    </li>
  );
}
