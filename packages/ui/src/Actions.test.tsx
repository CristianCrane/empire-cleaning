import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Actions } from "./Actions.tsx";
import { Button } from "./Button.tsx";

const box = (name: string) =>
  page.getByRole("button", { name }).element().getBoundingClientRect();

const renderActions = () =>
  render(
    <Actions>
      <Button variant="secondary">Not yet</Button>
      <Button>Send</Button>
    </Actions>,
  );

afterEach(() => page.viewport(414, 896));

test("on a phone the main action sits at the bottom, nearest the thumb", async () => {
  await page.viewport(390, 844);
  await renderActions();

  expect(box("Send").top).toBeGreaterThan(box("Not yet").bottom);
});

test("on a larger screen the main action sits on the right", async () => {
  await page.viewport(1024, 768);
  await renderActions();

  expect(box("Send").left).toBeGreaterThan(box("Not yet").right);
});
