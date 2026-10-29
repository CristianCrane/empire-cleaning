import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { CalendarX, CalendarSync } from "lucide-react";
import { ActionBar, IconAction } from "./ActionBar.tsx";
import { Dialog, DialogTrigger } from "./Dialog.tsx";

test("an icon action names itself in a tooltip on hover", async () => {
  const screen = await render(
    <ActionBar aria-label="Job actions">
      <IconAction icon={CalendarSync} label="Move Job" />
    </ActionBar>,
  );
  // as a real mouse does before it rests on anything
  await screen.getByRole("toolbar").hover();
  await screen.getByRole("button", { name: "Move Job" }).hover();

  await expect
    .element(screen.getByRole("tooltip"))
    .toHaveTextContent("Move Job");
});

test("and when it opens a dialog", async () => {
  const screen = await render(
    <ActionBar aria-label="Job actions">
      <DialogTrigger>
        <IconAction icon={CalendarX} label="Cancel Job" danger />
        <Dialog title="Cancel this Job?">
          <p>Sure?</p>
        </Dialog>
      </DialogTrigger>
    </ActionBar>,
  );
  const button = screen.getByRole("button", { name: "Cancel Job" });
  await button.hover();
  await expect
    .element(screen.getByRole("tooltip"))
    .toHaveTextContent("Cancel Job");

  await button.click();
  await expect
    .element(screen.getByRole("dialog", { name: "Cancel this Job?" }))
    .toBeVisible();
});

test("arrow keys move between the actions", async () => {
  const screen = await render(
    <ActionBar aria-label="Job actions">
      <IconAction icon={CalendarSync} label="Move Job" />
      <IconAction icon={CalendarX} label="Cancel Job" danger />
    </ActionBar>,
  );
  await userEvent.tab();
  await userEvent.keyboard("{ArrowRight}");

  await expect
    .element(screen.getByRole("button", { name: "Cancel Job" }))
    .toHaveFocus();
});
