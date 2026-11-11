import { useState } from "react";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { CalendarSync, CalendarX } from "lucide-react";
import { Dialog } from "./Dialog.tsx";
import { MenuButton, MenuItem, MenuSeparator } from "./Menu.tsx";

function JobActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MenuButton label="Actions">
        <MenuItem icon={CalendarSync}>Move job</MenuItem>
        <MenuSeparator />
        <MenuItem icon={CalendarX} danger onAction={() => setOpen(true)}>
          Cancel job
        </MenuItem>
      </MenuButton>
      <Dialog title="Cancel this job?" isOpen={open} onOpenChange={setOpen}>
        <p>Sure?</p>
      </Dialog>
    </>
  );
}

// a menu item opens its dialog, and focus comes back to the menu's Button
// as the dialog closes, as it came back to the icon that opened it before
test("an item opens its dialog; closing it puts focus back on the Button", async () => {
  const screen = await render(<JobActions />);
  const button = screen.getByRole("button", { name: "Actions" });

  await button.click();
  await screen.getByRole("menuitem", { name: "Cancel job" }).click();
  await expect
    .element(screen.getByRole("dialog", { name: "Cancel this job?" }))
    .toBeVisible();

  await userEvent.keyboard("{Escape}");
  await expect
    .element(screen.getByRole("dialog", { name: "Cancel this job?" }))
    .not.toBeInTheDocument();
  await expect.element(button).toHaveFocus();
});
