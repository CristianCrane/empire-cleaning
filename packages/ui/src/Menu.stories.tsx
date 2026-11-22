import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarClock, CalendarSync, CalendarX, Ellipsis } from "lucide-react";
import { Button } from "./Button.tsx";
import { Heading } from "./Heading.tsx";
import { Menu, MenuItem, MenuSeparator } from "./Menu.tsx";

const meta = {
  title: "Components/Menu",
  component: Menu,
  args: {
    trigger: (
      <Button variant="quiet" size="icon" aria-label="More actions">
        <Ellipsis aria-hidden size={22} />
      </Button>
    ),
    children: null,
  },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

// what can be done to a whole Job when nothing is next, behind a quiet ⋯
// at the end of its title row
export const AtTheEndOfATitle: Story = {
  render: (args) => (
    <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Heading level={1}>Deep Clean at 30 Pine Ave</Heading>
        <p className="text-lg text-fg-muted">Mon, Oct 26, 9:00 AM</p>
      </div>
      <Menu {...args}>
        <MenuItem icon={CalendarSync}>Move job</MenuItem>
        <MenuItem icon={CalendarClock}>Ask for a new time</MenuItem>
        <MenuSeparator />
        <MenuItem icon={CalendarX} danger>
          Cancel job
        </MenuItem>
      </Menu>
    </div>
  ),
};
