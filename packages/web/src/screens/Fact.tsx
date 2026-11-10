import type { ReactNode } from "react";
import { KeyRound, Ruler, Sparkles, type LucideIcon } from "lucide-react";
import { catalog, type PropertyView } from "@empire-cleaning/models";
import { useSaid } from "./words.ts";

// in the screen's language: the Office's English, the portal's its
// Client's (ADR-0025)
const words = catalog({
  en: {
    floorArea: "Floor area",
  },
  es: {
    floorArea: "Superficie",
  },
});

// An icon, a value and a muted line saying what it is: every fact's shape on
// a details card, in even columns across, but the Office Job's, which leads
// each with its label (LabelledFact, #406). Put them in a dl. (UX pass, #96)
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
  const t = useSaid(words);
  return (
    <Fact
      icon={Ruler}
      label={t.w.floorArea}
      value={
        property.floorArea === null
          ? t.notKnownYet
          : t.formatFloorArea(property.floorArea)
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
  const t = useSaid(words);
  return (
    <Fact
      icon={Sparkles}
      label={t.condition}
      value={t.conditionText(property.condition)}
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
  const t = useSaid(words);
  return (
    <Fact
      icon={KeyRound}
      label={t.howWeGetIn}
      value={
        <span className="whitespace-pre-line">
          {property.accessInstructions || t.notAdded}
        </span>
      }
      line={line}
      className={className}
    />
  );
}
