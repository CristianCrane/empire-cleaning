import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Actions } from "./Actions.tsx";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";
import { TextField } from "./TextField.tsx";

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

test.each([
  ["a phone's sheet", 390, 667],
  ["a laptop's centred dialog", 1280, 720],
])(
  "%s, longer than the screen, keeps its buttons at its foot, and a field brought into view stops above them",
  async (_, width, height) => {
    await page.viewport(width, height);
    await render(
      <Dialog title="Mark this job done" isOpen>
        {Array.from({ length: 14 }, (_, i) => (
          <TextField key={i} label={`Question ${i + 1}`} />
        ))}
        <Actions>
          <Button variant="quiet">Go back</Button>
          <Button>Mark done</Button>
        </Actions>
      </Dialog>,
    );
    const last = page.getByRole("textbox", { name: "Question 14" });

    // it runs past the screen: its last question is below it
    await expect.element(last).not.toBeInViewport();
    await expect
      .element(page.getByRole("button", { name: "Go back" }))
      .toBeInViewport({ ratio: 1 });
    await expect
      .element(page.getByRole("button", { name: "Mark done" }))
      .toBeInViewport({ ratio: 1 });

    // a field brought into view only as far as it must be (as the layout test
    // brings in each control) stops above them, not under
    last.element().scrollIntoView({ block: "nearest" });
    await expect.element(last).toBeInViewport({ ratio: 1 });
    expect(last.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(
      box("Go back").top,
    );
  },
);
