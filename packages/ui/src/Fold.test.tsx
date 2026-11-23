import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Fold } from "./Fold.tsx";

const fold = (defaultOpen: boolean) => (
  <Fold label="Deep Clean, also offered" defaultOpen={defaultOpen}>
    <p>Set the Deep Clean price yourself</p>
  </Fold>
);

// what it opens with is read once: a caller that opens it while something
// inside is set (a price of your own) mustn't shut it as the person unsets
// it, hiding what they just pressed (#527, review F15)
test("a Fold stays as the person left it when what it opens with changes", async () => {
  const screen = await render(fold(false));
  const inside = page.getByText("Set the Deep Clean price yourself");
  await expect.element(inside).not.toBeVisible();
  await page.getByText("Deep Clean, also offered").click();
  await expect.element(inside).toBeVisible();

  await screen.rerender(fold(true));
  await screen.rerender(fold(false));
  await expect.element(inside).toBeVisible();
});
