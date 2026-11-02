import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { focusRing } from "./utils.ts";

// how many of each kind a long list holds, e.g. what Needs attention in
// Jobs, Quotes and Money, side by side in one row. Pressing a tile shows
// only its kind; pressing it again, everything
export function CountTiles({
  label,
  selected,
  onSelect,
  children,
}: {
  label: string;
  // the tile pressed, if any
  selected: string | null;
  onSelect: (id: string | null) => void;
  children: ReactNode;
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      selectedKeys={selected === null ? [] : [selected]}
      onSelectionChange={(keys) => onSelect(([...keys][0] as string) ?? null)}
      className="grid auto-cols-fr grid-flow-col gap-3"
    >
      {children}
    </ToggleButtonGroup>
  );
}

// one kind: its name, how many, and a hint of what's in it ($ owed, how
// many are new). A tile with none can't be pressed
export function CountTile({
  id,
  icon: Icon,
  label,
  count,
  hint,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  count: number;
  hint?: string;
}) {
  return (
    <ToggleButton
      id={id}
      isDisabled={count === 0}
      className={(renderProps) =>
        `${focusRing(renderProps)} flex min-w-0 cursor-pointer flex-col items-start gap-1 rounded-lg border border-border bg-surface p-3 text-left shadow-raised transition-colors hover:bg-surface-sunken disabled:cursor-default disabled:shadow-none disabled:hover:bg-surface group selected:border-success-strong selected:bg-success-subtle selected:shadow-none selected:hover:bg-success-subtle sm:p-4`
      }
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-fg-muted group-selected:text-success-strong">
        <Icon aria-hidden size={18} className="shrink-0" />
        {label}
      </span>
      <span className="font-display text-3xl font-bold text-fg">{count}</span>
      {hint && (
        <span className="text-xs text-fg-muted [overflow-wrap:anywhere] sm:text-sm">
          {hint}
        </span>
      )}
    </ToggleButton>
  );
}
