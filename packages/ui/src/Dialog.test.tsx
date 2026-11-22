import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Actions } from "./Actions.tsx";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";
import { TextField } from "./TextField.tsx";

const box = (element: Element) => element.getBoundingClientRect();

// Mark done's shape: questions, then Go back and Mark done
const renderDialog = (questions: number) =>
  render(
    <Dialog title="Mark this job done" isOpen>
      {Array.from({ length: questions }, (_, i) => (
        <TextField key={i} label={`Question ${i + 1}`} />
      ))}
      <Actions>
        <Button variant="quiet">Go back</Button>
        <Button>Mark done</Button>
      </Actions>
    </Dialog>,
  );

const title = () => page.getByRole("heading", { name: "Mark this job done" });
const buttons = () => [
  page.getByRole("button", { name: "Go back" }),
  page.getByRole("button", { name: "Mark done" }),
];
// the dialog's box that scrolls, its title row and its Actions row
const parts = () => {
  const actions = document.querySelector("[data-actions]")!;
  return {
    body: actions.parentElement!.parentElement!,
    titleRow: title().element().parentElement!,
    actions,
  };
};
// wholly in view: a viewport the runner scales to fit its frame gives a
// ratio a hair under 1 (0.9999998 for the title at 1440 wide)
const whole = { ratio: 0.99 };
const line = (element: Element) => getComputedStyle(element).borderColor;
const noLine = "rgba(0, 0, 0, 0)";

afterEach(() => page.viewport(414, 896));

test.for([
  { device: "a phone", width: 390, height: 667 },
  { device: "a laptop", width: 1440, height: 700 },
])(
  "on $device a long dialog keeps its title and buttons in view as it scrolls, and a field brought into view stops between them",
  async ({ width, height }) => {
    await page.viewport(width, height);
    await renderDialog(14);
    const last = page.getByRole("textbox", { name: "Question 14" });

    // the dialog runs past the screen: its last question is below it
    await expect.element(last).not.toBeInViewport();
    await expect.element(title()).toBeInViewport(whole);
    for (const button of buttons()) {
      await expect.element(button).toBeInViewport(whole);
    }

    // a field brought into view only as far as it must be (as the layout
    // test brings in each control) stops above the buttons, not under, and
    // the title still over it
    last.element().scrollIntoView({ block: "nearest" });
    await expect.element(last).toBeInViewport(whole);
    expect(box(last.element()).bottom).toBeLessThanOrEqual(
      box(buttons()[0]!.element()).top,
    );
    await expect.element(title()).toBeInViewport(whole);
    expect(box(last.element()).top).toBeGreaterThanOrEqual(
      box(parts().titleRow).bottom,
    );
  },
);

test("a dialog's title and Actions rows draw their line only while its body runs on under them", async () => {
  await page.viewport(1440, 700);
  const short = await renderDialog(2);
  await expect.element(buttons()[1]!).toBeVisible();
  // nothing above or below: no line
  await expect.poll(() => line(parts().actions)).toBe(noLine);
  expect(line(parts().titleRow)).toBe(noLine);
  await short.unmount();

  await renderDialog(14);
  const { body, titleRow, actions } = parts();
  // at its top: more below, nothing above
  await expect.poll(() => line(actions)).not.toBe(noLine);
  expect(line(titleRow)).toBe(noLine);

  // halfway: more each way
  body.scrollTop = (body.scrollHeight - body.clientHeight) / 2;
  await expect.poll(() => line(titleRow)).not.toBe(noLine);
  expect(line(actions)).not.toBe(noLine);

  // at its end: more above only
  body.scrollTop = body.scrollHeight;
  await expect.poll(() => line(actions)).toBe(noLine);
  expect(line(titleRow)).not.toBe(noLine);
});
