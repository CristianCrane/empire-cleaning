import { parseDate } from "@internationalized/date";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { DatePicker, TimeField } from "./DateField.tsx";
import { NumberField } from "./NumberField.tsx";
import { Select, SelectItem } from "./Select.tsx";
import { TextField } from "./TextField.tsx";

test("every kind of field lines up at the height of a text box", async () => {
  const screen = await render(
    <div className="flex flex-col gap-4">
      <TextField label="Name" />
      <NumberField label="Crew Size" defaultValue={2} />
      <DatePicker label="First Clean" defaultValue={parseDate("2026-11-02")} />
      <TimeField label="Arrival" />
      <Select label="Condition">
        <SelectItem id="light">Light</SelectItem>
      </Select>
    </div>,
  );
  const height = (el: Element) => el.getBoundingClientRect().height;

  // the box drawn right under each label
  const outline = (label: string) =>
    height(
      screen.getByText(label, { exact: true }).element().nextElementSibling!,
    );

  const textBox = outline("Name");
  const outlines = ["Crew Size", "First Clean", "Arrival", "Condition"].map(
    outline,
  );

  expect(textBox).toBeGreaterThanOrEqual(44);
  expect(outlines).toEqual(outlines.map(() => textBox));
});
