import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Checkbox } from "./Checkbox.tsx";

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  args: { children: "Inside the fridge" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const box = canvas.getByRole("checkbox", { name: "Inside the fridge" });
    await userEvent.click(canvas.getByText("Inside the fridge"));
    await expect(box).toBeChecked();
  },
};

export const Selected: Story = { args: { defaultSelected: true } };

export const Indeterminate: Story = {
  args: { children: "All Add-ons", isIndeterminate: true },
};

export const Invalid: Story = {
  args: { children: "I accept the cancellation policy", isInvalid: true },
};

export const Disabled: Story = { args: { isDisabled: true } };
