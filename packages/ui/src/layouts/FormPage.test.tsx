import { Archive, LayoutDashboard, Send, Trash2 } from "lucide-react";
import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { AppLayout } from "./AppLayout.tsx";
import { FormPage } from "./FormPage.tsx";

const box = (element: Element) => element.getBoundingClientRect();
const button = (name: string) => page.getByRole("button", { name }).element();

afterEach(() => page.viewport(414, 896));

// a Form page with nothing beside its form (Your card, Welcome) keeps no
// empty column for it, and keeps a form's width (42rem) on a wide screen,
// not the screen's: the card runs to the header's action, which moves in
// with it (docs/ux.md, Forms)
test("a Form page with no aside is one column at a form's width on a wide screen, lined up with its header", async () => {
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
  expect(box(card!).width).toBe(42 * 16);
  expect(box(card!).right).toBe(box(button("Retire")).right);
});

// and in an area, once the window's top reaches the title row's action,
// the header that sticks keeps the form's width too: its action stays over
// the card's end, not the content's (#493)
test("a Form page at a form's width keeps it in the header that sticks", async () => {
  await page.viewport(1440, 900);
  await render(
    <AppLayout
      area="Office"
      nav={[
        {
          href: "#",
          label: "Services",
          icon: LayoutDashboard,
          isCurrent: true,
        },
      ]}
      foot={() => null}
    >
      <FormPage
        title="Deep Clean"
        actions={[
          { label: "Retire", icon: Archive, danger: true, onAction: () => {} },
        ]}
        buttons={<button type="submit">Save</button>}
      >
        <p className="h-[200rem]">The form</p>
      </FormPage>
    </AppLayout>,
  );
  const card = page.getByText("The form").element().closest("section")!;
  const retire = page.getByRole("button", { name: "Retire" });

  window.scrollTo(0, 600);
  await expect.poll(() => box(retire.element()).top).toBeGreaterThanOrEqual(0);
  expect(box(retire.element()).bottom).toBeLessThan(80);
  expect(box(retire.element()).right).toBeGreaterThan(box(card).right - 24);
  expect(box(retire.element()).right).toBeLessThan(box(card).right);
});

// a form with a price and a Send (the Draft): its price beside the card
// from xl, first below it
const pricedNoting = (note: string) => (
  <AppLayout
    area="Office"
    nav={[
      { href: "#", label: "Quotes", icon: LayoutDashboard, isCurrent: true },
    ]}
    foot={() => null}
  >
    <FormPage
      title="Draft quote for Grace Murphy"
      actions={[
        {
          label: "Delete draft",
          icon: Trash2,
          danger: true,
          onAction: () => {},
        },
      ]}
      next={{ label: "Send", icon: Send, onAction: () => {} }}
      price={{ line: "Deep Clean $568.87", short: "$568.87" }}
      note={note}
      aside={{ title: "Prices", leads: true, children: <p>$568.87</p> }}
    >
      <p className="h-[200rem]">The form</p>
    </FormPage>
  </AppLayout>
);
const priced = pricedNoting("Saved");
const whatToDo = () => page.getByRole("group", { name: "What to do" });
// the save's state, read out as it changes (the frame keeps a status of its
// own, for a page loading)
const saved = () => page.getByRole("status").filter({ hasText: "Saved" });

// from md no bar at the foot, a phone's habit (#493 D1): the button is the
// header's primary, the rest behind its arrow, "Saved" beside it from the
// start; once the window's top reaches it, the header that sticks holds
// the price too, below xl, where the aside isn't beside the form. One
// "Saved" is read out at a time
test("a priced Form page's button is the header's primary from md, the price and Saved in the header that sticks", async () => {
  await page.viewport(1024, 768);
  await render(priced);
  const send = whatToDo().getByRole("button", { name: "Send" });

  await expect.element(send).toBeVisible();
  expect(whatToDo().all()).toHaveLength(1);
  expect(saved().all()).toHaveLength(1);
  await expect.element(saved()).toBeVisible();
  // nothing fixed at the foot
  const fixed = [...document.querySelectorAll('[role="group"]')].filter(
    (g) =>
      getComputedStyle(g).position === "fixed" && g.getClientRects().length,
  );
  expect(fixed.filter((g) => box(g).bottom > 700)).toHaveLength(0);
  await whatToDo().getByRole("button", { name: "More actions" }).click();
  await expect
    .element(page.getByRole("menuitem", { name: "Delete draft" }))
    .toBeVisible();
  await page.getByRole("menuitem", { name: "Delete draft" }).click();

  window.scrollTo(0, 600);
  await expect.poll(() => box(send.element()).top).toBeGreaterThan(0);
  expect(box(send.element()).bottom).toBeLessThan(80);
  const sticky = send.element().closest(".fixed")!;
  expect(sticky.textContent).toContain("$568.87");
  expect(saved().all()).toHaveLength(1);
  await expect.element(saved()).toBeVisible();
});

// from xl the aside is beside the form, sticky too: the header that sticks
// leaves the price to it, said once
test("a priced Form page's header that sticks leaves the price to the aside beside it from xl", async () => {
  await page.viewport(1440, 900);
  await render(priced);
  const send = whatToDo().getByRole("button", { name: "Send" });
  window.scrollTo(0, 600);
  await expect.poll(() => box(send.element()).top).toBeGreaterThan(0);
  const price = [...send.element().closest(".fixed")!.querySelectorAll("*")]
    .filter((e) => e.textContent === "$568.87")
    .at(-1)!;
  expect(price.getClientRects()).toHaveLength(0);
  // the aside clears the header that sticks
  const aside = page.getByRole("region", { name: "Prices" }).element();
  expect(box(aside).top).toBeGreaterThanOrEqual(box(send.element()).bottom);
});

// a save's longest state wraps beside the button, at md, the narrowest
// width the header holds it, rather than squeezing the title to a word a line
test("a Form page's note wraps beside its button, leaving the title its room", async () => {
  await page.viewport(768, 1024);
  await render(
    pricedNoting("Your changes didn't save. We'll try again as you edit."),
  );
  const title = page.getByRole("heading", { level: 1 }).element();
  const note = page
    .getByRole("status")
    .filter({ hasText: "didn't save" })
    .element();
  expect(box(title).width).toBeGreaterThanOrEqual(box(note).width);
  window.scrollTo(0, 600);
  const send = whatToDo().getByRole("button", { name: "Send" });
  await expect.poll(() => box(send.element()).top).toBeGreaterThan(0);
  const sticky = send.element().closest(".fixed")!;
  const named = sticky.querySelector("p")!;
  expect(box(named).width).toBeGreaterThan(100);
});

// a Form page whose header sticks for its rare action alone (a Service's
// Retire) keeps its aside clear of that header too
test("a Form page's aside sticks under the header that sticks for a rare action", async () => {
  await page.viewport(1440, 900);
  await render(
    <AppLayout
      area="Office"
      nav={[
        {
          href: "#",
          label: "Services",
          icon: LayoutDashboard,
          isCurrent: true,
        },
      ]}
      foot={() => null}
    >
      <FormPage
        title="Deep Clean"
        actions={[
          { label: "Retire", icon: Archive, danger: true, onAction: () => {} },
        ]}
        buttons={<button type="submit">Save</button>}
        aside={{ title: "Example quote", children: <p>$568.87</p> }}
      >
        <p className="h-[200rem]">The form</p>
      </FormPage>
    </AppLayout>,
  );
  window.scrollTo(0, 1200);
  // the one copy to press, once the title row's has scrolled away
  const retire = page.getByRole("button", { name: "Retire" });
  await expect.poll(() => box(retire.element()).top).toBeGreaterThan(0);
  const aside = page.getByRole("region", { name: "Example quote" }).element();
  expect(box(aside).top).toBeGreaterThanOrEqual(box(retire.element()).bottom);
});

// a phone keeps its bar: the price, Saved and the button pinned at the
// foot, the rest on the title row
test("a priced Form page on a phone pins its price, Saved and button at the foot", async () => {
  await page.viewport(390, 844);
  await render(priced);
  const foot = whatToDo();

  await expect
    .element(foot.getByRole("button", { name: "Send" }))
    .toBeVisible();
  await expect.element(foot).toHaveTextContent("Deep Clean $568.87");
  expect(page.getByRole("button", { name: "Send" }).all()).toHaveLength(1);
  expect(saved().all()).toHaveLength(1);
  await expect
    .element(page.getByRole("button", { name: "Delete draft" }))
    .toBeVisible();
  expect(box(foot.element()).bottom).toBeGreaterThan(700);
});

// a form's own submit as the next step (New quote's Draft a quote): Enter
// in a field and the button send it, with the header scrolled away too,
// and a required field left empty stops it, as a form's submit does
test("a priced Form page's submit sends its form from the header that sticks, and Enter does", async () => {
  await page.viewport(1024, 768);
  let sent = 0;
  await render(
    <form
      onSubmit={(e) => {
        e.preventDefault();
        sent += 1;
      }}
    >
      <FormPage
        title="New quote"
        next={{ label: "Draft a quote", icon: Send, submit: true }}
        price={{ missing: "No price until the floor area is known." }}
        aside={{ title: "What it comes to", children: <p>No price</p> }}
      >
        <label>
          Street
          <input name="street" required />
        </label>
        <p className="h-[200rem]">The form</p>
        <label>
          Notes
          <input name="notes" />
        </label>
      </FormPage>
    </form>,
  );
  const draft = whatToDo().getByRole("button", { name: "Draft a quote" });
  const toNotes = async () => {
    page.getByRole("textbox", { name: "Notes" }).element().scrollIntoView();
    await expect.poll(() => box(draft.element()).top).toBeGreaterThan(0);
    expect(box(draft.element()).bottom).toBeLessThan(80);
  };
  await draft.click();
  expect(sent).toBe(0);
  // the header that sticks is the form's too: its button stops at a field
  // left empty, as the title row's does
  await toNotes();
  await draft.click();
  expect(sent).toBe(0);

  await page.getByRole("textbox", { name: "Street" }).fill("9 Main St");
  await toNotes();
  await draft.click();
  expect(sent).toBe(1);
  await page.getByRole("textbox", { name: "Notes" }).click();
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => sent).toBe(2);
});
