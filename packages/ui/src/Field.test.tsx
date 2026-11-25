import { parseDate, Time } from "@internationalized/date";
import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { DatePicker, TimeField } from "./DateField.tsx";
import { FieldRow } from "./Field.tsx";
import { NumberField } from "./NumberField.tsx";
import { Select, SelectItem } from "./Select.tsx";
import { TextField } from "./TextField.tsx";

afterEach(() => page.viewport(414, 896));

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

// a field's box holds its answer, not the row's width (docs/ux.md, Forms):
// on a wide screen a name runs to a form's width at most, and a phone, a
// ZIP code, an amount, a day and a time to their own, each still showing
// its widest answer whole
test("a field is as wide as what it holds, and its widest answer fits", async () => {
  await page.viewport(1440, 900);
  const screen = await render(
    <div className="flex w-[60rem] flex-col gap-4">
      <TextField label="Name" />
      <TextField label="Phone" type="tel" defaultValue="(646) 555-0100" />
      <TextField label="ZIP code" width="short" defaultValue="11375-1234" />
      <NumberField
        label="Price"
        defaultValue={100_000}
        formatOptions={{ style: "currency", currency: "USD" }}
      />
      <NumberField label="Area in sq ft" defaultValue={1_000_000} />
      <DatePicker label="Day" defaultValue={parseDate("2026-12-31")} />
      <TimeField label="Start" defaultValue={new Time(22, 30)} />
      <Select label="Service" defaultSelectedKey="plan">
        <SelectItem id="plan">Commercial cleaning, every weekday</SelectItem>
      </Select>
    </div>,
  );
  // the box drawn right under each label
  const box = (label: string) =>
    screen.getByText(label, { exact: true }).element().nextElementSibling!;
  const width = (label: string) => box(label).getBoundingClientRect().width;
  const rem = 16;

  expect(width("Name")).toBe(42 * rem);
  expect(width("Phone")).toBe(13 * rem);
  expect(width("ZIP code")).toBe(9 * rem);
  expect(width("Price")).toBe(13 * rem);
  expect(width("Area in sq ft")).toBe(13 * rem);
  expect(width("Day")).toBe(13 * rem);
  expect(width("Start")).toBe(9 * rem);
  expect(width("Service")).toBe(20 * rem);
  // nothing typed or picked runs past its box: its parts (a day's
  // segments) past the box, or its text past the input that holds it
  for (const label of [
    "Phone",
    "ZIP code",
    "Price",
    "Area in sq ft",
    "Day",
    "Start",
  ]) {
    const input = box(label).querySelector("input:not([type=hidden])");
    for (const holder of [box(label), input ?? box(label)])
      expect(holder.scrollWidth, label).toBeLessThanOrEqual(holder.clientWidth);
  }
  // nor a choice of a few words, its value cut off at the end
  const choice = box("Service").firstElementChild!;
  expect(choice.scrollWidth).toBeLessThanOrEqual(choice.clientWidth);
});

// a date and its start time in a form's card beside an aside (34rem at
// 1440): side by side from the row's start, a gap apart, not spread across
// the card's two columns (the user, on #527: "breaking symmetry and
// balance"); one above the other, full width, on a phone
test("a packed row keeps its fields at their own widths, side by side", async () => {
  await page.viewport(1440, 900);
  const screen = await render(
    <div className="w-[34rem]">
      <FieldRow packed>
        <DatePicker label="Date" defaultValue={parseDate("2026-01-12")} />
        <TimeField label="Start time" defaultValue={new Time(9)} />
      </FieldRow>
    </div>,
  );
  const box = (label: string) =>
    screen
      .getByText(label, { exact: true })
      .element()
      .nextElementSibling!.getBoundingClientRect();
  const rem = 16;
  expect(box("Date").left).toBe(box("Start time").left - 14 * rem);
  expect(box("Start time").width).toBe(9 * rem);

  // the phone's layout shows a frame after the resize: under reduced motion,
  // the tests' default, a box's widths ease over 0.01ms (tokens.css)
  await page.viewport(390, 844);
  await expect
    .poll(() => {
      const date = box("Date");
      const start = box("Start time");
      return { left: start.left - date.left, width: start.width - date.width };
    })
    .toEqual({ left: 0, width: 0 });
});
