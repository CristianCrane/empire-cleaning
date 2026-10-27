import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarClock, CircleDollarSign, Inbox, UserX } from "lucide-react";
import { IconTile } from "./IconTile.tsx";
import { List, ListItem } from "./List.tsx";

const meta = {
  title: "Components/IconTile",
  component: IconTile,
  args: { icon: Inbox, tone: "info" },
} satisfies Meta<typeof IconTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// an illustration only: the action leads, the icon says what kind it is
export const InAList: Story = {
  render: () => (
    <List aria-label="Needs attention" onAction={() => {}}>
      <ListItem
        id="1"
        title="Send a Quote"
        description="Maria Lopez · 41-12 Austin St · asked Oct 26"
        start={<IconTile icon={Inbox} tone="info" />}
      />
      <ListItem
        id="2"
        title="Assign Staff"
        description="Cleo Hart · 301 Main St · Oct 28, 1:00 PM"
        start={<IconTile icon={UserX} tone="warning" />}
      />
      <ListItem
        id="3"
        title="Confirm or turn down the new time"
        description="Sam Ito · 5 Bay Rd · Oct 30 to Oct 31"
        start={<IconTile icon={CalendarClock} tone="warning" />}
      />
      <ListItem
        id="4"
        title="Collect the Balance"
        description="Nina Gold · $184.00 owed · 22 Pine St"
        start={<IconTile icon={CircleDollarSign} tone="danger" />}
      />
    </List>
  ),
};
