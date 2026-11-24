import { CircleCheck } from "lucide-react";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Timeline, TimelineItem } from "./Timeline.tsx";

const box = (element: Element) => element.getBoundingClientRect();

// what happened on one line, when on the line under it, in every entry,
// however short the title (the user's review of 903a201c, #493)
test("a History entry's time sits under what happened", async () => {
  await render(
    <Timeline aria-label="History">
      <TimelineItem icon={CircleCheck} title="Paid" when="Nov 12" />
    </Timeline>,
  );

  const title = page.getByText("Paid", { exact: true }).element();
  const when = page.getByText("Nov 12", { exact: true }).element();
  expect(box(when).top).toBeGreaterThanOrEqual(box(title).bottom);
});

// the space under an entry leads to the next: the last ends where its
// words do, so a History card with one entry has no empty band under it
test("a Timeline ends at its last entry's words", async () => {
  await render(
    <Timeline aria-label="History">
      <TimelineItem icon={CircleCheck} title="Quote sent" when="Jan 5" />
      <TimelineItem icon={CircleCheck} title="Paid" when="Nov 12" />
    </Timeline>,
  );

  const list = page.getByRole("list", { name: "History" }).element();
  const first = page.getByText("Jan 5", { exact: true }).element();
  const last = page.getByText("Nov 12", { exact: true }).element();
  const next = page.getByText("Paid", { exact: true }).element();
  expect(box(next).top - box(first).bottom).toBeGreaterThan(16);
  expect(box(list).bottom - box(last).bottom).toBeLessThan(4);
});
