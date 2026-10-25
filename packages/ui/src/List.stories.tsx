import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { Avatar } from "./Avatar.tsx";
import { List, ListItem } from "./List.tsx";
import { StatusBadge } from "./StatusBadge.tsx";

const meta = {
  title: "Components/List",
  component: List,
  args: { "aria-label": "Today's Jobs", onAction: fn() },
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

// a Cleaner's day on a phone: tap a Job to open it
export const Default: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem
        id="1"
        title="41-12 Austin St"
        description="9:00 AM · Deep Clean · 2 Cleaners"
        end={<StatusBadge tone="success">Completed</StatusBadge>}
      />
      <ListItem
        id="2"
        title="108-20 71st Ave"
        description="12:30 PM · Standard Clean"
        end={<StatusBadge tone="info">Scheduled</StatusBadge>}
      />
      <ListItem
        id="3"
        title="35-06 Ditmars Blvd"
        description="3:00 PM · Standard Clean"
        end={<StatusBadge tone="warning">No Access</StatusBadge>}
      />
    </List>
  ),
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("108-20 71st Ave"));
    await expect(args.onAction).toHaveBeenCalledWith("2");
  },
};

export const ReadOnly: Story = {
  args: { onAction: undefined },
  render: (args) => (
    <List {...args}>
      <ListItem id="1" title="Inside the oven" description="$35.00" />
      <ListItem id="2" title="Inside the fridge" description="$30.00" />
    </List>
  ),
};

// people, each with their picture or the plain icon
export const WithAvatars: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem
        id="1"
        title="Cory Cleaner"
        description="Cleaner · cory@example.com"
        start={<Avatar />}
      />
      <ListItem
        id="2"
        title="Olive Owner"
        description="Office Staff · olive@example.com"
        start={<Avatar />}
        end={<StatusBadge tone="info">Invited</StatusBadge>}
      />
    </List>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <List
      {...args}
      renderEmptyState={() => (
        <p className="p-6 text-center text-fg-muted">No Jobs today.</p>
      )}
    >
      {[]}
    </List>
  ),
};
