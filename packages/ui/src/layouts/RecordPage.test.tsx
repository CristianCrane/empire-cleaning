import { Archive, CircleCheck, LayoutDashboard, Printer } from "lucide-react";
import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Card } from "../Card.tsx";
import { Section } from "../Section.tsx";
import { Timeline, TimelineItem } from "../Timeline.tsx";
import { AppLayout } from "./AppLayout.tsx";
import { FormPage } from "./FormPage.tsx";
import { DetailsCard, RecordPage } from "./RecordPage.tsx";

const box = (element: Element) => element.getBoundingClientRect();
const region = (name: string) => page.getByRole("region", { name }).element();
const button = (name: string) => page.getByRole("button", { name }).element();

afterEach(() => page.viewport(414, 896));

// one column at every width, History last: beside the parts, it competed
// with the page (#493). With nothing beside it, the details card runs to
// the header's button, not 22rem short of it (#493 G4.4)
test("a Record on a wide screen is one column, its History last, lined up with its header", async () => {
  await page.viewport(1440, 900);
  await render(
    <RecordPage
      trail={[{ label: "Bills", href: "#" }, { label: "EC-000123" }]}
      title="Bill EC-000123"
      actions={[{ label: "Print", icon: Printer, onAction: () => {} }]}
      details={<DetailsCard label="Details" title="$1,240.00" />}
      history={
        <Timeline aria-label="History, newest first">
          <TimelineItem icon={CircleCheck} title="Paid" when="Nov 12" />
        </Timeline>
      }
    >
      <Section title="Money">
        <Card>$1,240.00</Card>
      </Section>
    </RecordPage>,
  );

  expect(box(region("History")).top).toBeGreaterThan(
    box(region("Money")).bottom,
  );
  expect(box(region("History")).right).toBe(box(region("Details")).right);
  expect(box(region("Details")).right).toBe(box(button("Print")).right);
});

// the bar at a Record's foot on site (a Cleaner's Complete) ends where the
// page's content does, its button under the cards' right edge
test("a Record's bar at the foot lines up with its content on a wide screen", async () => {
  await page.viewport(1440, 900);
  await render(
    <AppLayout
      area="Cleaner area"
      nav={[
        {
          href: "#",
          label: "Your jobs",
          icon: LayoutDashboard,
          isCurrent: true,
        },
      ]}
      foot={() => null}
    >
      <RecordPage
        trail={[{ label: "Your jobs", href: "#" }, { label: "Deep Clean" }]}
        title="Deep Clean"
        details={<DetailsCard label="Details" title="9:00 AM" />}
        footer={{
          label: "Job",
          children: <button type="button">Complete</button>,
        }}
      />
    </AppLayout>,
  );

  expect(box(button("Complete")).right).toBe(box(region("Details")).right);
});

// a Form page with nothing beside its form (Your card) keeps no empty
// column for it: the card runs to the header's action
test("a Form page with no aside is one column on a wide screen, lined up with its header", async () => {
  await page.viewport(1440, 900);
  await render(
    <FormPage
      title="Deep Clean"
      actions={[
        { label: "Retire", icon: Archive, danger: true, onAction: () => {} },
      ]}
      buttons={<button type="submit">Save</button>}
    >
      <p>The form</p>
    </FormPage>,
  );

  // the form's one Card
  const card = page.getByText("The form").element().closest("section");
  expect(box(card!).right).toBe(box(button("Retire")).right);
});

// what happened on one line, when on the line under it, in every entry,
// however short the title (the user's review of 903a201c, #493)
test("a History entry's time sits under what happened", async () => {
  await render(
    <Timeline aria-label="History">
      <TimelineItem icon={CircleCheck} title="Paid" when="Nov 12" />
    </Timeline>,
  );

  const title = page.getByText("Paid", { exact: true }).element();
  const when = page.getByText("Nov 12", { exact: true }).element();
  expect(box(when).top).toBeGreaterThanOrEqual(box(title).bottom);
});
