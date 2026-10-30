import type { LucideIcon } from "lucide-react";
import type { StatusTone } from "./StatusBadge.tsx";
import { tv } from "./utils.ts";

const tile = tv({
  base: "flex shrink-0 items-center justify-center rounded-md",
  variants: {
    // lg leads a card, e.g. what Home's next thing is when it has no date
    size: { md: "size-10", lg: "size-20 rounded-lg" },
    tone: {
      neutral: "bg-neutral-subtle text-neutral-strong",
      info: "bg-info-subtle text-info-strong",
      success: "bg-success-subtle text-success-strong",
      warning: "bg-warning-subtle text-warning-strong",
      danger: "bg-danger-subtle text-danger-strong",
    },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

// a list row's leading icon on a tile in a StatusBadge tone, saying what kind
// of thing the row is. Decorative: the row's text carries the meaning.
export function IconTile({
  icon: Icon,
  tone,
  size = "md",
}: {
  icon: LucideIcon;
  tone?: StatusTone;
  size?: "md" | "lg";
}) {
  return (
    <span aria-hidden className={tile({ tone, size })}>
      <Icon size={size === "lg" ? 36 : 20} />
    </span>
  );
}
