import type { ReactNode } from "react";
import { twMerge } from "./utils.ts";

// A list of figures, each a label and its value (docs/ux.md, Figures): a
// price's hours and Deposit, how a price is worked out, a receipt. The one
// ledger, in a column at most 28rem wide at its card's start, so on a wide
// card each value sits near its label rather than across the card (the
// user's pick, #548). Small type under a price, its labels muted; `md` where
// the figures are the part's point, such as a receipt, its labels in full.
// Each is a Figure.
export function Figures({
  size = "sm",
  children,
}: {
  size?: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <dl
      data-size={size}
      className={twMerge(
        "group/figures grid w-full max-w-md grid-cols-[1fr_auto] gap-x-4",
        size === "sm" ? "gap-y-1 text-sm" : "gap-y-2",
      )}
    >
      {children}
    </dl>
  );
}

// One figure: its label, and its value at the column's end. `strong` for
// the one a list adds up to (a Suggested Price, a plan clean's price),
// `total` for the sum under a rule; `was`, the value it had before, struck
// through beside it where it differs
export function Figure({
  label,
  value,
  was,
  strong = false,
  total = false,
}: {
  label: ReactNode;
  value: ReactNode;
  was?: string | null;
  strong?: boolean;
  total?: boolean;
}) {
  const differs = was != null && was !== value;
  return (
    <div
      className={twMerge(
        "col-span-full grid grid-cols-subgrid",
        total && "mt-1 border-t border-border pt-2 text-base",
      )}
    >
      <dt
        className={
          strong || total
            ? "font-semibold text-fg"
            : "text-fg-muted group-data-[size=md]/figures:text-fg"
        }
      >
        {label}
      </dt>
      <dd
        className={twMerge(
          "text-right text-fg tabular-nums",
          (strong || total) && "font-semibold",
        )}
      >
        {differs && (
          <s className="mr-2 text-fg-muted">
            <span className="sr-only">was </span>
            {was}
          </s>
        )}
        <span className={differs ? "font-semibold text-primary" : undefined}>
          {value}
        </span>
      </dd>
    </div>
  );
}
