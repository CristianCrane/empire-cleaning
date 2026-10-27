import type { Meta, StoryObj } from "@storybook/react-vite";
import { List, ListItem } from "./List.tsx";
import { Tab, TabList, TabPanel, Tabs } from "./Tabs.tsx";

const quotes = {
  requested: ["Priya Shah", "Ortiz Dental (Dana Ortiz)"],
  draft: ["Ana Lima"],
  sent: ["Sam Ng", "Jo Wright", "Kim Osei"],
};

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  args: {
    children: (
      <>
        <TabList aria-label="Show">
          <Tab id="requested" count={quotes.requested.length}>
            Requested
          </Tab>
          <Tab id="draft" count={quotes.draft.length}>
            Draft
          </Tab>
          <Tab id="sent" count={quotes.sent.length}>
            Sent
          </Tab>
        </TabList>
        {Object.entries(quotes).map(([status, names]) => (
          <TabPanel key={status} id={status}>
            <List aria-label="Quotes">
              {names.map((name) => (
                <ListItem key={name} id={name} title={name} />
              ))}
            </List>
          </TabPanel>
        ))}
      </>
    ),
  },
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
