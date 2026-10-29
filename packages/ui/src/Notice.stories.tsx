import type { Meta, StoryObj } from "@storybook/react-vite";
import { Mail } from "lucide-react";
import { Button } from "./Button.tsx";
import { Notice } from "./Notice.tsx";

const meta = {
  title: "Components/Notice",
  component: Notice,
  args: {
    children: "We've sent a sign-in link to casey@example.com.",
  },
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

// someone needs to act, e.g. a Job still needing a Cleaner
export const Warning: Story = { args: { tone: "warning" } };

export const Success: Story = { args: { tone: "success" } };

export const Danger: Story = {
  args: {
    tone: "danger",
    children: "That sign-in link has expired or has already been used.",
  },
};

// with the one thing to do about it, as text on its right
export const WithAction: Story = {
  args: {
    children:
      "Waiting for Max to accept, until Fri, Nov 6. To record an acceptance by phone, he needs a card saved first.",
    action: (
      <Button variant="text" size="sm">
        <Mail aria-hidden size={16} />
        Email Max a link to add a card
      </Button>
    ),
  },
};
