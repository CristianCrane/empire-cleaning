import {
  CalendarSync,
  CalendarX,
  CircleCheck,
  ClipboardCheck,
  LayoutDashboard,
  Printer,
} from "lucide-react";
import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { Card } from "../Card.tsx";
import { Dialog } from "../Dialog.tsx";
import { Section } from "../Section.tsx";
import { Timeline, TimelineItem } from "../Timeline.tsx";
import { AppLayout } from "./AppLayout.tsx";
import type { PageAction } from "./PageActions.tsx";
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
          children: <button type="button">Complete</button>,
        }}
      />
    </AppLayout>,
  );

  expect(box(button("Complete")).right).toBe(box(region("Details")).right);
});

const visitWith = (next?: PageAction) => (
  <AppLayout
    area="Office area"
    nav={[
      { href: "#", label: "Schedule", icon: LayoutDashboard, isCurrent: true },
    ]}
    foot={() => null}
  >
    <RecordPage
      trail={[{ label: "Schedule", href: "#" }, { label: "Site visit" }]}
      title="Site visit"
      next={next}
      actions={[
        {
          label: "Move or change",
          icon: CalendarSync,
          dialog: (state) => (
            <Dialog title="Move this visit" {...state}>
              When it's for
            </Dialog>
          ),
        },
        { label: "Cancel visit", icon: CalendarX, danger: true, onAction() {} },
      ]}
      details={<DetailsCard label="Details" title="Mon, Nov 9, 9:00 AM" />}
    >
      <Section title="Notes">
        <Card>
          <div className="h-[200vh]">Long notes</div>
        </Card>
      </Section>
    </RecordPage>
  </AppLayout>
);
const visit = visitWith({
  label: "Record findings",
  icon: ClipboardCheck,
  onAction() {},
});

// the one copy of the next step there to press: the title row's, at its
// end and lined up with the content; once the window's top reaches it, the header that sticks
// at the top, lined up with it too (#493)
test("a Record's next step on a wide screen is at the title row's end, then sticks at the top", async () => {
  await page.viewport(1024, 768);
  await render(visit);
  const press = page.getByRole("button", { name: "Record findings" });
  const more = page.getByRole("button", { name: "More actions" });

  await expect.element(press).toBeVisible();
  expect(box(more.element()).right).toBe(box(region("Details")).right);
  // named as a phone's foot is, the one copy there to press
  expect(
    page
      .getByRole("group", { name: "What to do" })
      .getByRole("button", { name: "Record findings" })
      .all(),
  ).toHaveLength(1);

  // scrolled until the button is cut by the window's top: never half a
  // button, the header that sticks is there already. In view at the top,
  // its bar's edge the content's, its button inside the bar's padding
  window.scrollTo(0, box(press.element()).top + 10);
  await expect.poll(() => box(press.element()).top).toBeGreaterThan(0);
  expect(box(press.element()).bottom).toBeLessThan(80);
  expect(box(more.element()).right).toBeGreaterThan(
    box(region("Details")).right - 24,
  );
  expect(box(more.element()).right).toBeLessThan(box(region("Details")).right);

  window.scrollTo(0, 600);
  await expect.element(press).toBeVisible();
  expect(box(press.element()).bottom).toBeLessThan(80);
});

// with nothing next, the ⋯ sticks the same way from md; on a phone it
// stays on the title row, scrolled with it, and still there to press
test("a Record's ⋯ sticks at the top on a wide screen, and stays on its row on a phone", async () => {
  await page.viewport(1024, 768);
  const { unmount } = await render(visitWith());
  const more = page.getByRole("button", { name: "More actions" });
  await expect.element(more).toBeVisible();
  window.scrollTo(0, 600);
  await expect.poll(() => box(more.element()).top).toBeGreaterThan(0);
  expect(box(more.element()).bottom).toBeLessThan(80);
  await unmount();

  window.scrollTo(0, 0);
  await page.viewport(390, 844);
  await render(visitWith());
  window.scrollTo(0, 600);
  await expect.poll(() => box(more.element()).top).toBeLessThan(0);
  // once the scroll has been watched (two frames), the row's ⋯ is still
  // one to press, not taken out of reach for a header a phone doesn't have
  await new Promise((done) =>
    requestAnimationFrame(() => requestAnimationFrame(done)),
  );
  expect(more.all()).toHaveLength(1);
});

// on a phone, read after the facts: pinned at the foot, above the tab bar;
// the rest in a sheet rising from it, the destructive last
test("a Record's next step on a phone is pinned at the foot, the rest in a sheet", async () => {
  await page.viewport(390, 844);
  await render(visit);
  const foot = page.getByRole("group", { name: "What to do" });

  await expect
    .element(foot.getByRole("button", { name: "Record findings" }))
    .toBeVisible();
  expect(
    page.getByRole("button", { name: "Record findings" }).all(),
  ).toHaveLength(1);
  await foot.getByRole("button", { name: "More actions" }).click();
  const sheet = page.getByRole("dialog", { name: "More actions" });
  await expect
    .element(sheet.getByRole("menuitem").last())
    .toHaveTextContent("Cancel visit");
  await expect.poll(() => box(sheet.element()).bottom).toBe(window.innerHeight);

  // a choice's dialog outlives the sheet it closed, and gives focus back
  // to the arrow that opened it
  await sheet.getByRole("menuitem", { name: "Move or change" }).click();
  const move = page.getByRole("dialog", { name: "Move this visit" });
  await expect.element(move).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(move).not.toBeInTheDocument();
  await expect
    .element(foot.getByRole("button", { name: "More actions" }))
    .toHaveFocus();
});
