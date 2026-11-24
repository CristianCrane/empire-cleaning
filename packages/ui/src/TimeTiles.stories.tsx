import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { TimeTiles } from "./TimeTiles.tsx";

const meta = {
  title: "Components/TimeTiles",
  component: TimeTiles,
  args: {
    label: "Open times on Tue, Jan 6",
    heading: "Morning",
    times: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"],
    onPick: fn(),
  },
} satisfies Meta<typeof TimeTiles>;

export default meta;
type Story = StoryObj<typeof meta>;

// nothing picked yet
export const Default: Story = {};

// picked, with when the clean ends under it
export const Chosen: Story = { args: { chosen: "09:00", until: "to 3:00 PM" } };

// where it's booked now, which can't be picked
export const Current: Story = { args: { chosen: "10:00", current: "09:00" } };

// picked with no room then: a warning, as it can still be sent
export const NoRoom: Story = {
  args: { chosen: "09:00", until: "to 3:00 PM", flagged: "warning" },
};

// picked at a time that can't be sent (too soon, past midnight)
export const Refused: Story = {
  args: { chosen: "09:00", flagged: "danger" },
};
