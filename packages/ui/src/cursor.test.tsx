import { parseDate } from "@internationalized/date";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { Button } from "./Button.tsx";
import { Calendar } from "./Calendar.tsx";
import { Checkbox } from "./Checkbox.tsx";
import { List, ListItem } from "./List.tsx";

const cursor = (el: Element) => getComputedStyle(el).cursor;

test("everything that can be pressed shows the hand cursor", async () => {
  const screen = await render(
    <>
      <Button>Send Quote</Button>
      <Checkbox>Inside the fridge</Checkbox>
      <Calendar aria-label="Schedule" defaultValue={parseDate("2026-11-02")} />
      <List aria-label="Jobs" onAction={() => {}}>
        <ListItem id="1" title="41-12 Austin St" />
      </List>
    </>,
  );

  expect(
    cursor(screen.getByRole("button", { name: "Send Quote" }).element()),
  ).toBe("pointer");
  expect(cursor(screen.getByText("Inside the fridge").element())).toBe(
    "pointer",
  );
  expect(
    cursor(screen.getByRole("button", { name: /November 12/ }).element()),
  ).toBe("pointer");
  expect(
    cursor(screen.getByRole("row", { name: "41-12 Austin St" }).element()),
  ).toBe("pointer");
});

test("things that can't be pressed don't pretend they can", async () => {
  const screen = await render(
    <>
      <Button isDisabled>Send Quote</Button>
      <List aria-label="Add-ons">
        <ListItem id="1" title="Inside the oven" />
      </List>
    </>,
  );

  expect(cursor(screen.getByRole("button").element())).not.toBe("pointer");
  expect(cursor(screen.getByRole("row").element())).not.toBe("pointer");
});
