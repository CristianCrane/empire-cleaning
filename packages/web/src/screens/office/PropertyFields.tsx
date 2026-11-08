import { Building2, House, Houses, Store } from "lucide-react";
import type {
  Condition,
  PremisesTypeChoice,
  PropertyType,
} from "@empire-cleaning/models";
import { conditions } from "@empire-cleaning/quote-request";
import {
  Checkbox,
  ChoiceTile,
  ChoiceTiles,
  NumberField,
  Segment,
  SegmentedControl,
  Select,
  SelectItem,
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

// a home's rooms; a field left empty is NaN
type Room = "bedrooms" | "bathrooms" | "storeys";

export function RoomFields({
  rooms,
  onChange,
  isRequired,
}: {
  rooms: Record<Room, number>;
  onChange: (room: Room, count: number) => void;
  isRequired?: boolean;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
      <NumberField
        label="Bedrooms"
        name="bedrooms"
        isRequired={isRequired}
        minValue={0}
        maxValue={20}
        value={rooms.bedrooms}
        onChange={(count) => onChange("bedrooms", count)}
      />
      <NumberField
        label="Bathrooms"
        name="bathrooms"
        isRequired={isRequired}
        minValue={0.5}
        maxValue={20}
        step={0.5}
        value={rooms.bathrooms}
        onChange={(count) => onChange("bathrooms", count)}
      />
      <NumberField
        label="Floors"
        name="storeys"
        isRequired={isRequired}
        minValue={1}
        maxValue={5}
        value={rooms.storeys}
        onChange={(count) => onChange("storeys", count)}
      />
    </div>
  );
}

// a home's floor area, which it isn't priced from
export function HomeFloorAreaField({
  value,
  onChange,
}: {
  value: number;
  onChange: (area: number) => void;
}) {
  return (
    <NumberField
      label="Floor area in sq ft (optional)"
      name="floorArea"
      minValue={100}
      maxValue={100_000}
      step={50}
      value={value}
      onChange={onChange}
    />
  );
}

export function PetsField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (pets: boolean) => void;
}) {
  return (
    <Checkbox isSelected={value} onChange={onChange}>
      There are pets at home
    </Checkbox>
  );
}

// what kind of business premises they are: one on offer, or the retired one
// they have
export function PremisesTypeField({
  value,
  choices,
  onChange,
}: {
  value: string | null;
  choices: PremisesTypeChoice[];
  onChange: (key: string) => void;
}) {
  return (
    <Select
      label="Type of premises"
      name="premisesType"
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
    >
      {choices.map((t) => (
        <SelectItem key={t.key} id={t.key}>
          {t.name}
        </SelectItem>
      ))}
    </Select>
  );
}

// business premises' floor area, which they're priced from
export function PremisesFloorAreaField({
  value,
  onChange,
  isRequired,
  description,
}: {
  value: number;
  onChange: (area: number) => void;
  isRequired?: boolean;
  description?: string;
}) {
  return (
    <NumberField
      label="Floor area in sq ft"
      name="floorArea"
      description={description}
      isRequired={isRequired}
      minValue={100}
      maxValue={1_000_000}
      step={100}
      value={value}
      onChange={onChange}
    />
  );
}
