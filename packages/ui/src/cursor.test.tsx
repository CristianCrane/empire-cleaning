import { parseDate } from "@internationalized/date";
import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Button } from "./Button.tsx";
import { Calendar } from "./Calendar.tsx";
import { Checkbox } from "./Checkbox.tsx";
import { List, ListItem } from "./List.tsx";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "./Table.tsx";

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

// a row is hoverable only when it does something: opens, or is picked
test("a Table row that opens shows the hand cursor", async () => {
  const table = (onRowAction?: () => void) => (
    <Table aria-label="History" onRowAction={onRowAction}>
      <TableHeader>
        <Column isRowHeader>Date</Column>
      </TableHeader>
      <TableBody>
        <Row id="1">
          <Cell>Oct 28, 2026</Cell>
        </Row>
      </TableBody>
    </Table>
  );
  const opens = await render(table(() => {}));
  const row = opens.getByRole("row", { name: "Oct 28, 2026" });
  await userEvent.hover(row);
  expect(cursor(row.element())).toBe("pointer");
  opens.unmount();

  const still = await render(table());
  const plain = still.getByRole("row", { name: "Oct 28, 2026" });
  await userEvent.hover(plain);
  expect(cursor(plain.element())).not.toBe("pointer");
});
