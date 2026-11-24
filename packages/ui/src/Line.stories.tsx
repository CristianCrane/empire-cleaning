import type { Meta, StoryObj } from "@storybook/react-vite";
import { Line } from "./Line.tsx";

const meta = {
  title: "Components/Line",
  component: Line,
  args: {
    parts: [
      "41-12 Austin St, 4B, 11375",
      "Standard Clean $194.89",
      "waiting since today",
    ],
  },
  // a phone's row is about this wide, so the line wraps
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Line>;

export default meta;
type Story = StoryObj<typeof meta>;

// wraps between whole parts: no dot at a line's end or start, and a
// Service keeps its price
export const Default: Story = {};

// a part too long for a line breaks inside itself, its dot still before it
export const LongPart: Story = {
  args: {
    parts: [
      "Acme Dental (Casey Client)",
      "1234 Northern Boulevard, Suite 200, 11354",
      "asked Jan 5",
    ],
  },
};
