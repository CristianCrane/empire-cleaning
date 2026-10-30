import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActionRow } from "./ActionRow.tsx";
import { Button } from "./Button.tsx";
import { Card } from "./Card.tsx";
import { Section } from "./Section.tsx";

const meta = {
  title: "Components/ActionRow",
  component: ActionRow,
  decorators: [
    (Story) => (
      <Section title="Need another time?">
        <Card>
          <Story />
        </Card>
      </Section>
    ),
  ],
  args: {
    children: (
      <p>
        You can move it for free until <strong>Mon, Nov 2, 9:00 AM</strong>.
        After that, it's a Late Reschedule, and only one per clean is free.
      </p>
    ),
    actions: <Button variant="secondary">Choose a new time</Button>,
  },
} satisfies Meta<typeof ActionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TwoButtons: Story = {
  args: {
    children: (
      <>
        <p>
          Our team did more than was quoted: <strong>Inside oven</strong>.
        </p>
        <p>
          It comes to <strong>$45.00</strong>, tax included, charged only if you
          approve it.
        </p>
      </>
    ),
    actions: (
      <>
        <Button variant="secondary">Decline</Button>
        <Button>Approve $45.00</Button>
      </>
    ),
  },
};
