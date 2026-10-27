import type { LucideIcon } from "lucide-react";
import type { StatusTone } from "./StatusBadge.tsx";
import { tv } from "./utils.ts";

const tile = tv({
  base: "flex size-10 shrink-0 items-center justify-center rounded-md",
  variants: {
    tone: {
      neutral: "bg-neutral-subtle text-neutral-strong",
      info: "bg-info-subtle text-info-strong",
      success: "bg-success-subtle text-success-strong",
      warning: "bg-warning-subtle text-warning-strong",
      danger: "bg-danger-subtle text-danger-strong",
    },
  },
  defaultVariants: { tone: "neutral" },
});

// a list row's leading icon on a tile in a StatusBadge tone, saying what kind
// of thing the row is. Decorative: the row's text carries the meaning.
export function IconTile({
  icon: Icon,
  tone,
}: {
  icon: LucideIcon;
  tone?: StatusTone;
}) {
  return (
    <span aria-hidden className={tile({ tone })}>
      <Icon size={20} />
    </span>
  );
}
