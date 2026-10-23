import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button.tsx";
import { Card } from "./Card.tsx";

const meta = {
  title: "Components/Card",
  component: Card,
  args: {
    title: "41-12 Austin St",
    description: "Forest Hills, NY 11375",
    children: (
      <p>
        3 bedrooms · 2 bathrooms · Moderate Condition. Ring the bell for
        apartment 4B; the key is with the doorman.
      </p>
    ),
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    actions: (
      <Button variant="secondary" size="sm">
        Edit
      </Button>
    ),
  },
};

export const ContentOnly: Story = {
  args: { title: undefined, description: undefined },
};
