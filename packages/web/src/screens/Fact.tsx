import { KeyRound, Ruler, Sparkles } from "lucide-react";
import { Fact } from "@empire-cleaning/ui";
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
