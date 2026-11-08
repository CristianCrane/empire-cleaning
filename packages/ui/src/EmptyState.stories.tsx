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
    title: "This property doesn't have a cleaning plan",
    description:
      "Quote regular cleaning: the client accepts the quote and their jobs are booked for them.",
    children: (
      <Button>
        <Repeat aria-hidden size={18} />
        Quote a cleaning plan
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
    title: "This property doesn't have a site visit",
    description:
      "This business needs a site visit before it's quoted. Book one, or record what you know about it already.",
    children: (
      <>
        <Button>Book a site visit</Button>
        <Button variant="secondary">Record findings without a visit</Button>
      </>
    ),
  },
};

export const CantAddYet: Story = {
  args: {
    children: (
      <Notice>
        The Client asked for a quote that's still open: carry on with that one.
      </Notice>
    ),
  },
};

export const NoAction: Story = {
  args: {
    description:
      "A home can be quoted a cleaning plan once its first clean is done.",
    children: undefined,
  },
};
