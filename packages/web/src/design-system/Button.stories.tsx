import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Trash2 } from "lucide-react";
import { expect, fn } from "storybook/test";
import { Button } from "./Button.tsx";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Send Quote", onPress: fn() },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Send Quote" }));
    await expect(args.onPress).toHaveBeenCalledOnce();
  },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Save draft" },
};

export const Quiet: Story = { args: { variant: "quiet", children: "Cancel" } };

export const Danger: Story = {
  args: { variant: "danger", children: "Turn Down" },
};

export const Small: Story = { args: { size: "sm", children: "Edit" } };

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus aria-hidden size={20} />
        Add Property
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: {
    variant: "quiet",
    size: "icon",
    "aria-label": "Remove Add-on",
    children: <Trash2 aria-hidden size={20} />,
  },
};

export const Disabled: Story = {
  args: { isDisabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button")).toBeDisabled();
  },
};

// while a request is in flight: shows a spinner, keeps its width, and ignores presses
export const Pending: Story = {
  args: { isPending: true },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button"));
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};
