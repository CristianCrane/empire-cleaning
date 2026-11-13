import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { twMerge } from "./utils.ts";

// A record's facts (docs/ux.md, Record): the one facts grid, on every
// details card and in every dialog (#432). Even columns across, one on a
// phone, two from a medium width, three on a wide one, following the width
// of what holds it (a card beside a History, a dialog), not the screen's.
// Each is a Fact.
export function Facts({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-3">
        {children}
      </dl>
    </div>
  );
}

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
