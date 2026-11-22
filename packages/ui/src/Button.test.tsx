import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { Button } from "./Button.tsx";

test("presses with a tap, Enter or Space", async () => {
  const onPress = vi.fn();
  const screen = await render(<Button onPress={onPress}>Send Quote</Button>);
  const button = screen.getByRole("button", { name: "Send Quote" });

  await button.click();
  await userEvent.keyboard("{Enter}");
  await userEvent.keyboard(" ");

  expect(onPress).toHaveBeenCalledTimes(3);
});

test("is a comfortable tap target", async () => {
  const screen = await render(<Button>Confirm</Button>);
  const box = screen.getByRole("button").element().getBoundingClientRect();

  expect(box.height).toBeGreaterThanOrEqual(44);
});

test("shows the focus ring for keyboard focus but not for taps", async () => {
  const screen = await render(<Button>Confirm</Button>);
  const button = screen.getByRole("button").element();

  await screen.getByRole("button").click();
  expect(getComputedStyle(button).outlineWidth).toBe("0px");

  (button as HTMLElement).blur();
  await userEvent.tab();
  expect(getComputedStyle(button).outlineWidth).toBe("2px");
});

test.each(["sm", "md"] as const)(
  "flush, a %s Button's words meet the edge, its padding hanging outside",
  async (size) => {
    const screen = await render(
      <div className="flex w-80 flex-col items-start">
        <Button variant="text" size={size} flush="start">
          Show more
        </Button>
        <Button variant="text" size={size} flush="end" className="self-end">
          Sign out
        </Button>
      </div>,
    );
    const edges = screen.container
      .querySelector("div")!
      .getBoundingClientRect();
    const words = (name: string) => {
      const range = document.createRange();
      range.selectNodeContents(
        screen.getByRole("button", { name }).element().lastElementChild!,
      );
      return range.getBoundingClientRect();
    };

    expect(Math.round(words("Show more").left)).toBe(Math.round(edges.left));
    expect(Math.round(words("Sign out").right)).toBe(Math.round(edges.right));
  },
);
