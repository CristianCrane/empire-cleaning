import { KeyRound, Ruler, Sparkles } from "lucide-react";
import { Fact } from "@empire-cleaning/ui";
import { catalog, type PropertyView } from "@empire-cleaning/models";
import { useSaid } from "./words.ts";

// in the screen's language: the Office's English, the portal's its
// Client's, the Cleaner's their own (ADR-0025)
const words = catalog({
  en: {
    floorArea: "Floor area",
    // the condition a cleaner found on a Job, as its pages say it
    howDirty: "How dirty the home was",
  },
  es: {
    floorArea: "Superficie",
    howDirty: "Qué tan sucia estaba la casa",
  },
});

// a Property's facts, as each of its details cards shows them (the kit's
// Fact, in its words); `line` says what it is for that reader

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

// a home's condition; `found`, as a cleaner found it on a Job
export function ConditionFact({
  property,
  line,
  found = false,
}: {
  property: Pick<PropertyView, "condition">;
  line?: string;
  found?: boolean;
}) {
  const t = useSaid(words);
  return (
    <Fact
      icon={Sparkles}
      label={t.condition}
      value={t.conditionText(property.condition)}
      line={found ? t.w.howDirty : line}
    />
  );
}

// how we get in; `empty` is what's said when nothing's written down, if
// not "Not added yet" (the Cleaner's: call the client when you get there)
export function AccessFact({
  property,
  line,
  empty,
  className,
}: {
  property: Pick<PropertyView, "accessInstructions">;
  line?: string;
  empty?: string;
  className?: string;
}) {
  const t = useSaid(words);
  return (
    <Fact
      icon={KeyRound}
      label={t.howWeGetIn}
      value={
        <span className="whitespace-pre-line">
          {property.accessInstructions || (empty ?? t.notAdded)}
        </span>
      }
      line={line}
      className={className}
    />
  );
}
