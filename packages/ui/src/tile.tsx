import type { LucideIcon } from "lucide-react";

// a Home's tile, raised as what can be pressed: one form for both kinds
// (CountTile, ShortcutTile), so side by side they read as one kind of thing
// (review F16; #499's UX review U4). With none there it's greyed out, flat
// and not pressable, whichever kind it is (UX review U15, review F25)
export const tileForm =
  "flex h-full w-full min-w-0 flex-col items-start gap-1 rounded-lg border border-border bg-surface p-3 text-left shadow-raised transition-colors hover:bg-surface-sunken disabled:cursor-default disabled:shadow-none disabled:hover:bg-surface sm:p-4";

// its first line: the icon and what it is, green once a CountTile is open
export function TileLabel({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2 text-sm font-semibold text-fg-muted group-selected:text-success-strong">
      <Icon aria-hidden size={18} className="shrink-0" />
      {label}
    </span>
  );
}
