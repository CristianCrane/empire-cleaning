import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { twMerge } from "./utils.ts";

// A record's facts (docs/ux.md, Record): the one facts grid, on every
// details card and in every dialog (#432). Even columns across, one on a
// phone, two from a medium width, three on a wide one, following the width
// of what holds it (a card beside a History, a dialog), not the screen's.
// `columns` caps them: 2 keeps four short facts two and two rather than
// three and one, and 1 gives a lone fact the whole row. Each is a Fact.
export function Facts({
  columns = 3,
  children,
}: {
  columns?: 1 | 2 | 3;
  children: ReactNode;
}) {
  return (
    <div className="@container">
      <dl
        className={twMerge(
          "grid gap-x-6 gap-y-4",
          columns > 1 && "@md:grid-cols-2",
          columns === 3 && "@3xl:grid-cols-3",
        )}
      >
        {children}
      </dl>
    </div>
  );
}

// the columns for so many short facts, so none sits alone in a part of a
// row: a lone fact the whole row, four two and two rather than three and one
// (the Office's Job, U15; a Bill, #534's UX review U20)
export const factColumns = (facts: number): 1 | 2 | 3 =>
  facts === 1 ? 1 : facts === 4 ? 2 : 3;

// One fact: an icon, its value, and under it a muted line saying what it
// is, the label unless `line` says more. className places it, e.g.
// col-span-full for a long value such as notes
export function Fact({
  icon: Icon,
  label,
  value,
  line,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  // what the value is, when there's more to say than the label
  line?: ReactNode;
  className?: string;
}) {
  // a dl's group holds its dt and dds directly: the icon sits in their grid
  return (
    <div
      className={twMerge(
        "grid grid-cols-[auto_1fr] content-start gap-x-3",
        className,
      )}
    >
      <Icon
        aria-hidden
        size={20}
        className="row-span-2 mt-0.5 shrink-0 text-fg-muted"
      />
      <dt className="sr-only">{label}</dt>
      <dd className="col-start-2 text-fg [overflow-wrap:anywhere]">{value}</dd>
      <dd className="col-start-2 text-sm text-fg-muted">{line ?? label}</dd>
    </div>
  );
}
