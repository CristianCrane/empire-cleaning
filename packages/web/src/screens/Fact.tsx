import type { ReactNode } from "react";
import { KeyRound, Ruler, Sparkles, type LucideIcon } from "lucide-react";
import type { PropertyView } from "@empire-cleaning/models";
import { screenWords } from "./format.ts";

const { conditionText, formatFloorArea } = screenWords.en;

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

// a Property's facts, as each of its details cards shows them; `line` says
// what it is for that reader

export function FloorAreaFact({
  property,
}: {
  property: Pick<PropertyView, "floorArea">;
}) {
  return (
    <Fact
      icon={Ruler}
      label="Floor area"
      value={
        property.floorArea === null
          ? "Not known yet"
          : formatFloorArea(property.floorArea)
      }
    />
  );
}

export function ConditionFact({
  property,
  line,
}: {
  property: Pick<PropertyView, "condition">;
  line?: string;
}) {
  return (
    <Fact
      icon={Sparkles}
      label="Condition"
      value={conditionText(property.condition)}
      line={line}
    />
  );
}

export function AccessFact({
  property,
  line,
  className,
}: {
  property: Pick<PropertyView, "accessInstructions">;
  line?: string;
  className?: string;
}) {
  return (
    <Fact
      icon={KeyRound}
      label="How we get in"
      value={
        <span className="whitespace-pre-line">
          {property.accessInstructions || "Not added yet"}
        </span>
      }
      line={line}
      className={className}
    />
  );
}
