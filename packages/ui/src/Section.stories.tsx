import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link } from "./Link.tsx";
import { List, ListItem } from "./List.tsx";
import { Section } from "./Section.tsx";
import { StatusBadge } from "./StatusBadge.tsx";

const meta = {
  title: "Components/Section",
  component: Section,
  args: {
    title: "Tue, Oct 27",
    description: "32h available · 24h booked",
    children: (
      <List aria-label="Today's Jobs" onAction={() => {}}>
        <ListItem
          id="1"
          title="9:00 AM · Maria Lopez"
          description="41-12 Austin St · Standard Clean · crew of 2, 3h on site"
          end={<StatusBadge tone="success">Confirmed</StatusBadge>}
        />
        <ListItem
          id="2"
          title="1:00 PM · Dev Patel"
          description="88 Grand St · Deep Clean · crew of 3, 4h on site"
          end={<StatusBadge tone="warning">Unassigned</StatusBadge>}
        />
      </List>
    ),
  },
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: { actions: <Link href="#">Schedule</Link> },
};

export const TitleOnly: Story = {
  args: { description: undefined },
};
