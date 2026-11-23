import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Button } from "./Button.tsx";
import { Stepper } from "./Stepper.tsx";

const meta = {
  title: "Components/Stepper",
  component: Stepper,
  args: {
    label: "Mon, Jan 5 – Sun, Jan 11",
    previous: "Previous week",
    next: "Next week",
    onStep: fn(),
  },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// nothing earlier to show: this month's working hours
export const AtTheStart: Story = {
  args: {
    label: "January 2026",
    previous: "Previous month",
    next: "Next month",
    canGoBack: false,
  },
};

// the Schedule's, with Today between its arrows
export const WithToday: Story = {
  args: {
    children: (
      <Button variant="secondary" size="sm">
        This week
      </Button>
    ),
  },
};
