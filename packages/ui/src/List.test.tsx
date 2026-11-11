import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { List, ListItem } from "./List.tsx";
import { StatusBadge } from "./StatusBadge.tsx";

// a row's title wraps, never cut (docs/ux.md, Lists and tables): a
// payment's "Price change: 1 more hour" lost its hour at phone width
test("a row's title shows whole on a phone, wrapping rather than cut", async () => {
  await page.viewport(390, 844);
  const title = "Price change: Inside the cabinets, 1 more hour";
  await render(
    <List aria-label="Payments" onAction={() => {}}>
      <ListItem
        id="1"
        title={title}
        description="Approved after your Jan 12 Deep Clean"
        start={<span className="w-12 shrink-0">Jan 12</span>}
        end={<StatusBadge tone="info">Clearing</StatusBadge>}
      />
    </List>,
  );

  const shown = page.getByText(title).element();
  expect(shown.scrollWidth).toBeLessThanOrEqual(shown.clientWidth);
});

// a row's action stays beside its text on a phone, where its badge goes
// under it: the X on a Job's crew lines up with the name, not the badge
test("a row's action stays beside the text on a phone", async () => {
  await page.viewport(320, 700);
  await render(
    <List aria-label="Crew">
      <ListItem
        id="1"
        title="Ana Lucía Hernández-Restrepo"
        description="Offered Nov 8"
        start={<span className="size-10" />}
        end={<StatusBadge tone="warning">Offered</StatusBadge>}
        action={<button type="button">Remove</button>}
      />
    </List>,
  );

  const action = page.getByRole("button", { name: "Remove" }).element();
  const title = page.getByText("Ana Lucía").element();
  const badge = page.getByText("Offered", { exact: true }).element();
  expect(action.getBoundingClientRect().left).toBeGreaterThan(
    title.getBoundingClientRect().right,
  );
  expect(badge.getBoundingClientRect().top).toBeGreaterThan(
    title.getBoundingClientRect().top,
  );
});
