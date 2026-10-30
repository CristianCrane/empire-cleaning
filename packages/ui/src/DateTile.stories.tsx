import type { Meta, StoryObj } from "@storybook/react-vite";
import { DateTile } from "./DateTile.tsx";

const meta = {
  title: "Components/DateTile",
  component: DateTile,
  args: { date: "2026-11-03T14:00:00Z" },
} satisfies Meta<typeof DateTile>;

export default meta;
type Story = StoryObj<typeof meta>;

// Tue, Nov 3 in New York
export const Default: Story = {};

// leading a list row
export const Small: Story = { args: { size: "sm" } };
