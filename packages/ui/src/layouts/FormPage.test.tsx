import { Archive } from "lucide-react";
import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { FormPage } from "./FormPage.tsx";

const box = (element: Element) => element.getBoundingClientRect();
const button = (name: string) => page.getByRole("button", { name }).element();

afterEach(() => page.viewport(414, 896));

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
