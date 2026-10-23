import type { Meta, StoryObj } from "@storybook/react-vite";
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

export const Success: Story = { args: { tone: "success" } };

export const Danger: Story = {
  args: {
    tone: "danger",
    children: "That sign-in link has expired or has already been used.",
  },
};
