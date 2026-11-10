import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarClock, CalendarSync, CalendarX } from "lucide-react";
import { Heading } from "./Heading.tsx";
import { MenuButton, MenuItem, MenuSeparator } from "./Menu.tsx";

const meta = {
  title: "Components/Menu",
  component: MenuButton,
  args: { label: "Actions", children: null },
} satisfies Meta<typeof MenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// what can be done to a whole Job, at the end of its title row
export const AtTheEndOfATitle: Story = {
  render: (args) => (
    <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Heading level={1}>Deep Clean at 30 Pine Ave</Heading>
        <p className="text-lg text-fg-muted">Mon, Oct 26, 9:00 AM</p>
      </div>
      <MenuButton {...args}>
        <MenuItem icon={CalendarSync}>Move job</MenuItem>
        <MenuItem icon={CalendarClock}>Ask for a new time</MenuItem>
        <MenuSeparator />
        <MenuItem icon={CalendarX} danger>
          Cancel job
        </MenuItem>
      </MenuButton>
    </div>
  ),
};
