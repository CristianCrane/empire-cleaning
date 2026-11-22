import { Archive, LayoutDashboard } from "lucide-react";
import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
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
