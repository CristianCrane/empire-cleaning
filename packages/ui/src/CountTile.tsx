import type { LucideIcon } from "lucide-react";
import { ToggleButton } from "react-aria-components";
import { TileLabel, tileForm } from "./tile.tsx";
import { focusRing } from "./utils.ts";

// how many of one kind there are, with a hint of what's in it (how many
// need cleaners, how many are new): a Home's tile that opens its rows in
// place (HomeTiles). Where what the reader judges the kind by isn't how
// many (the Office's Money: what's owed), its `value` shows in the
// count's place, and the hint says how many. Pressing it opens them;
// pressing it again, closes them. A tile with none is greyed out and can't
// be pressed
export function CountTile({
  icon,
  label,
  count,
  value,
  hint,
  isSelected,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  value?: string;
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
        `${focusRing(renderProps)} ${tileForm} cursor-pointer disabled:cursor-default disabled:shadow-none disabled:hover:bg-surface group selected:border-success-strong selected:bg-success-subtle selected:shadow-none selected:hover:bg-success-subtle`
      }
    >
      <TileLabel icon={icon} label={label} />
      <span className="font-display text-3xl font-bold text-fg tabular-nums [overflow-wrap:anywhere]">
        {value ?? count}
      </span>
      {hint && (
        <span className="text-xs text-fg-muted [overflow-wrap:anywhere] sm:text-sm">
          {hint}
        </span>
      )}
    </ToggleButton>
  );
}
