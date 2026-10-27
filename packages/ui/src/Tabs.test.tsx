import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Tab, TabList, TabPanel, Tabs } from "./Tabs.tsx";

test("the row of Tabs never scrolls up and down, only sideways", async () => {
  await page.viewport(390, 844);
  await render(
    <Tabs>
      <TabList aria-label="Status">
        {["All", "Requested", "Draft", "Sent", "Expired"].map((name) => (
          <Tab key={name} id={name} count={3}>
            {name}
          </Tab>
        ))}
      </TabList>
      <TabPanel id="All">Quotes</TabPanel>
    </Tabs>,
  );

  const row = page.getByRole("tablist").element();
  expect(row.scrollHeight).toBe(row.clientHeight);
});
