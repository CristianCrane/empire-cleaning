import type { ReactNode } from "react";
import type { VariantProps } from "tailwind-variants";
import { tv } from "./utils.ts";

// the tone is the design system's; which status gets which tone (a Sent Quote
// is info, an Unpaid Job is danger) belongs to the feature showing it. The
// label always carries the meaning, so colour is never the only signal.
const badge = tv({
  base: "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap",
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

export type StatusTone = NonNullable<VariantProps<typeof badge>["tone"]>;

export function StatusBadge({
  tone,
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return (
    <span className={badge({ tone })}>
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {children}
    </span>
  );
}
