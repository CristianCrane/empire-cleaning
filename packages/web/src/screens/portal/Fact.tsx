import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// An icon, a value and a muted line saying what it is: every fact's shape on
// a details card, in even columns across. Put them in a dl. (UX pass, #96)
export function Fact({
  icon: Icon,
  label,
  value,
  line,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  // what the value is; the label, without another
  line?: ReactNode;
  // e.g. a wider column for a long value
  className?: string;
}) {
  // a dl's group holds its dt and dds directly: the icon sits in their grid
  return (
    <div
      className={`grid grid-cols-[auto_1fr] content-start gap-x-3 ${className}`}
    >
      <Icon
        aria-hidden
        size={20}
        className="row-span-2 mt-0.5 shrink-0 text-fg-muted"
      />
      <dt className="sr-only">{label}</dt>
      <dd className="col-start-2 text-fg">{value}</dd>
      <dd className="col-start-2 text-sm text-fg-muted">{line ?? label}</dd>
    </div>
  );
}
