import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { RouterProvider } from "react-aria-components";
import { PrototypeBar } from "./PrototypeBar.tsx";

afterEach(() => sessionStorage.clear());

// a prototype of two layouts and three cases, at layout A, case 1; each
// link's address names what it draws, so a press says where it went
const barAt = async () => {
  const navigate = vi.fn();
  const choices = (keys: string[]) =>
    keys.map((key) => ({ key, name: `Name ${key}`, href: `/to/${key}` }));
  await render(
    <RouterProvider navigate={navigate}>
      <PrototypeBar
        layouts={choices(["A", "B"])}
        cases={choices(["1", "2", "3"])}
        layout="A"
        case="1"
        index="/to/index"
      />
    </RouterProvider>,
  );
  // where each press went, in order
  return () => navigate.mock.calls.map(([href]) => href as string);
};

test("the arrow keys step through cases and layouts, wrapping at the ends", async () => {
  const went = await barAt();
  await userEvent.keyboard("{ArrowRight}");
  await userEvent.keyboard("{ArrowLeft}");
  await userEvent.keyboard("{ArrowDown}");
  await userEvent.keyboard("{ArrowUp}");
  expect(went()).toEqual(["/to/2", "/to/3", "/to/B", "/to/B"]);
});

test("a held modifier, or a key the bar has no link for, steps nothing", async () => {
  const went = await barAt();
  // Alt+← is the browser's Back
  await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
  await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
  await userEvent.keyboard("x");
  // and a key that does step, so the bar is shown listening
  await userEvent.keyboard("{ArrowRight}");
  expect(went()).toEqual(["/to/2"]);
});

test("folded to its tab, the keys still step", async () => {
  const went = await barAt();
  await page.getByRole("button", { name: "Fold the bar" }).click();
  await expect
    .element(page.getByRole("button", { name: "Unfold the bar" }))
    .toHaveTextContent("A1");
  await userEvent.keyboard("{ArrowRight}");
  expect(went()).toEqual(["/to/2"]);
});
