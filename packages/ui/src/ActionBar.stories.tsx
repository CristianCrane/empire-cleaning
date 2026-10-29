import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarClock, CalendarSync, CalendarX } from "lucide-react";
import { ActionBar, IconAction } from "./ActionBar.tsx";
import { Heading } from "./Heading.tsx";

const meta = {
  title: "Components/ActionBar",
  component: ActionBar,
  args: { "aria-label": "Job actions", children: null },
} satisfies Meta<typeof ActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// what can be done to a whole Job, beside its title: hover for each name
export const BesideATitle: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-start gap-3">
      <div className="flex flex-col gap-1">
        <Heading level={1}>Deep Clean at 30 Pine Ave</Heading>
        <p className="text-lg text-fg-muted">Mon, Oct 26, 9:00 AM</p>
      </div>
      <div className="ml-auto">
        <ActionBar {...args}>
          <IconAction icon={CalendarSync} label="Move Job" />
          <IconAction icon={CalendarClock} label="Ask for a new time" />
          <IconAction icon={CalendarX} label="Cancel Job" danger />
        </ActionBar>
      </div>
    </div>
  ),
};
