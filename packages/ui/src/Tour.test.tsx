import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { startTour } from "./Tour.ts";

let stop: (() => void) | undefined;
afterEach(() => stop?.());

const tourOfAButton = async (onClose: () => void, lang: "en" | "es" = "en") => {
  await render(<button type="button">See your Quote</button>);
  stop = startTour(
    [
      { title: "Welcome", text: "Book, move and pay for your cleans here." },
      {
        element: page.getByRole("button").element(),
        title: "Your Quote",
        text: "Open it to book.",
      },
    ],
    onClose,
    lang,
  );
};

test("a tour closed as its first step opens still counts as closed, once", async () => {
  const onClose = vi.fn();
  await tourOfAButton(onClose);

  // before the first step's opening has finished
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledOnce();
  stop?.();
  expect(onClose).toHaveBeenCalledOnce();
});

test("a tour seen to the end is closed once", async () => {
  const onClose = vi.fn();
  await tourOfAButton(onClose);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Got it" }).click();
  expect(onClose).toHaveBeenCalledOnce();
});

test("a tour ended early, as the person leaves the screen, is closed once", async () => {
  const onClose = vi.fn();
  await tourOfAButton(onClose);
  stop?.();
  expect(onClose).toHaveBeenCalledOnce();
});

test("what a step points at isn't marked as opening the popover", async () => {
  await tourOfAButton(() => {});
  await page.getByRole("button", { name: "Next" }).click();
  const target = page.getByRole("button", { name: "See your Quote" });
  await expect.element(target).not.toHaveAttribute("aria-haspopup");
  await expect.element(target).not.toHaveAttribute("aria-expanded");
});

test("its buttons are in the screen's language (ADR-0025)", async () => {
  await tourOfAButton(vi.fn(), "es");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect
    .element(page.getByRole("button", { name: "Atrás" }))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Cerrar" }))
    .toBeInTheDocument();
  await expect.element(page.getByText("2 de 2")).toBeVisible();
});
