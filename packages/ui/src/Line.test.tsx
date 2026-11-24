import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { Line } from "./Line.tsx";

const parts = [
  "41-12 Austin St, 4B, 11375",
  "Standard Clean $194.89",
  "waiting since today",
  "Casey",
];

// a row's line on a phone: each part stays whole, and a wrap never leaves
// a dot at a line's start or end (#548)
test("a Line's dots sit only between two parts on one line", async () => {
  const screen = await render(
    <div style={{ width: "15em", marginLeft: 100, fontSize: 16 }}>
      <Line parts={[...parts.slice(0, 2), false, ...parts.slice(2)]} />
    </div>,
  );
  const line = screen.container.querySelector("div > span")!;
  expect(line.textContent).toBe(parts.join(" · "));

  const left = line.getBoundingClientRect().left;
  const items = [...line.firstElementChild!.children] as HTMLElement[];
  let wraps = 0;
  items.slice(1).forEach((item, i) => {
    const dot = item.firstElementChild as HTMLElement;
    const box = dot.getBoundingClientRect();
    const seen = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    // its part starts a line: the dot falls in the margin the line hides
    if (item.getBoundingClientRect().left < left) {
      wraps++;
      expect(seen).not.toBe(dot);
    } else {
      expect(seen).toBe(dot);
      expect(item.getBoundingClientRect().top).toBe(
        items[i]!.getBoundingClientRect().top,
      );
    }
  });
  expect(wraps).toBeGreaterThan(0);
});

test("a Line of no parts draws nothing", async () => {
  const screen = await render(<Line parts={[undefined, false, ""]} />);
  expect(screen.container.textContent).toBe("");
});
