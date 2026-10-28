import { Building2, House, Houses, Store } from "lucide-react";
import type { Condition, PropertyType } from "@empire-cleaning/models";
import { conditions } from "@empire-cleaning/quote-request";
import {
  ChoiceTile,
  ChoiceTiles,
  Segment,
  SegmentedControl,
} from "@empire-cleaning/ui";

// the fields the Office corrects a place with, asked as the quote form asks
// them: on its Details and when a Site Visit records what it found

// what kind of place it is, asked as the quote form asks it. A home and
// business premises are priced from different details, so one can't be
// corrected into the other: a home's type is the only choice
export function PlaceTiles({
  value,
  onChange,
}: {
  value: PropertyType | "commercial";
  onChange?: (type: PropertyType) => void;
}) {
  const premises = value === "commercial";
  return (
    <ChoiceTiles
      label="Kind of place"
      value={value}
      onChange={(type) => onChange?.(type as PropertyType)}
      description={
        premises
          ? "Business premises can't be corrected into a home."
          : "A home can't be corrected into business premises."
      }
    >
      <ChoiceTile value="house" icon={House} isDisabled={premises}>
        House
      </ChoiceTile>
      <ChoiceTile value="apartment" icon={Building2} isDisabled={premises}>
        Apartment
      </ChoiceTile>
      <ChoiceTile value="townhouse" icon={Houses} isDisabled={premises}>
        Townhouse
      </ChoiceTile>
      <ChoiceTile value="commercial" icon={Store} isDisabled={!premises}>
        Business premises
      </ChoiceTile>
    </ChoiceTiles>
  );
}

// how much cleaning it needs; business premises have none until a Site
// Visit records it
export function ConditionField({
  value,
  onChange,
}: {
  value: Condition | null;
  onChange: (condition: Condition) => void;
}) {
  return (
    <SegmentedControl
      label="Condition"
      name="condition"
      value={value}
      onChange={(condition) => onChange(condition as Condition)}
      description={
        value
          ? conditions.find((c) => c.value === value)?.description
          : "Not recorded yet"
      }
    >
      {conditions.map((c) => (
        <Segment key={c.value} value={c.value}>
          {c.label}
        </Segment>
      ))}
    </SegmentedControl>
  );
}
