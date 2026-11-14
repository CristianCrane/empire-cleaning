import type { LucideIcon } from "lucide-react";
import { ToggleButton } from "react-aria-components";
import { focusRing } from "./utils.ts";

// how many of one kind there are, with a hint of what's in it ($ owed, how
// many are new): a Home's tile that opens its rows in place (HomeTiles).
// Pressing it opens them; pressing it again, closes them. A tile with none
// is greyed out and can't be pressed
export function CountTile({
  icon: Icon,
  label,
  count,
  hint,
  isSelected,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  hint?: string;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
}) {
  return (
    <ToggleButton
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={count === 0}
      className={(renderProps) =>
        `${focusRing(renderProps)} flex h-full w-full min-w-0 cursor-pointer flex-col items-start gap-1 rounded-lg border border-border bg-surface p-3 text-left shadow-raised transition-colors hover:bg-surface-sunken disabled:cursor-default disabled:shadow-none disabled:hover:bg-surface group selected:border-success-strong selected:bg-success-subtle selected:shadow-none selected:hover:bg-success-subtle sm:p-4`
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
