import type { Meta, StoryObj } from "@storybook/react-vite";
import { MapPin, Repeat } from "lucide-react";
import { Button } from "./Button.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { Notice } from "./Notice.tsx";

const meta = {
  title: "Components/EmptyState",
  component: EmptyState,
  args: {
    icon: Repeat,
    title: "This Property doesn't have a Service Plan",
    description:
      "Quote regular cleaning: the Client accepts the Quote and their Jobs are booked for them.",
    children: (
      <Button>
        <Repeat aria-hidden size={18} />
        Quote a Service Plan
      </Button>
    ),
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAction: Story = {};

export const WithTwoActions: Story = {
  args: {
    icon: MapPin,
    title: "This Property doesn't have a Site Visit",
    description:
      "Business premises are seen before they're quoted. Book a Site Visit, or record findings you know already.",
    children: (
      <>
        <Button>Book a Site Visit</Button>
        <Button variant="secondary">Record findings without a visit</Button>
      </>
    ),
  },
};

export const CantAddYet: Story = {
  args: {
    children: (
      <Notice>
        The Client asked for a Quote that's still open: carry on with that one.
      </Notice>
    ),
  },
};

export const NoAction: Story = {
  args: {
    description:
      "A home can be quoted a Service Plan once its First Clean is Completed.",
    children: undefined,
  },
};
