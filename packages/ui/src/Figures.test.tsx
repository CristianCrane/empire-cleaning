import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Figure, Figures } from "./Figures.tsx";

// on a wide card each value sits near its label, at the end of a column
// about 28rem wide, not at the card's far edge (#548, the user's pick B)
test("Figures keep their values in a readable column on a wide card", async () => {
  await render(
    <div style={{ width: 960, fontSize: 16 }}>
      <Figures>
        <Figure label="Cleaning hours" value="3 h 15 min" />
        <Figure label="Deposit (25%)" value="$48.72" />
      </Figures>
    </div>,
  );
  const label = page.getByText("Cleaning hours").element();
  const value = page.getByText("$48.72").element();
  const right = value.getBoundingClientRect().right;
  expect(right - label.getBoundingClientRect().left).toBeLessThanOrEqual(
    28 * 16,
  );
  expect(
    page.getByText("3 h 15 min").element().getBoundingClientRect().right,
  ).toBe(right);
});
