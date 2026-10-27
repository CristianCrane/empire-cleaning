import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBadge } from "./StatusBadge.tsx";

const meta = {
  title: "Components/StatusBadge",
  component: StatusBadge,
  args: { children: "Sent", tone: "info" },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge tone="neutral">Neutral</StatusBadge>
      <StatusBadge tone="info">Info</StatusBadge>
      <StatusBadge tone="success">Success</StatusBadge>
      <StatusBadge tone="warning">Warning</StatusBadge>
      <StatusBadge tone="danger">Danger</StatusBadge>
    </div>
  ),
};

// an illustration only: each feature decides its own statuses' tones
export const QuoteStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge tone="neutral">Draft</StatusBadge>
      <StatusBadge tone="info">Sent</StatusBadge>
      <StatusBadge tone="success">Accepted</StatusBadge>
      <StatusBadge tone="danger">Declined</StatusBadge>
      <StatusBadge tone="neutral">Expired</StatusBadge>
      <StatusBadge tone="neutral">Turned Down</StatusBadge>
    </div>
  ),
};
