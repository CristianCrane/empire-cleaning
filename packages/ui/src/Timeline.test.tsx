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
