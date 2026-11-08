import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { NumberField } from "./NumberField.tsx";

const meta = {
  title: "Components/NumberField",
  component: NumberField,
  args: { label: "Cleaners", defaultValue: 2, minValue: 1, maxValue: 6 },
} satisfies Meta<typeof NumberField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /increase/i }));
    await expect(canvas.getByRole("textbox", { name: "Cleaners" })).toHaveValue(
      "3",
    );
  },
};

export const Currency: Story = {
  args: {
    label: "Price",
    defaultValue: 185,
    minValue: 0,
    maxValue: undefined,
    step: 5,
    formatOptions: { style: "currency", currency: "USD" },
    description: "The suggested price is $185.00",
  },
};

export const Hours: Story = {
  args: {
    label: "Cleaning hours",
    defaultValue: 4.5,
    minValue: 0.5,
    maxValue: undefined,
    step: 0.5,
  },
};

export const Invalid: Story = {
  args: { isInvalid: true, errorMessage: "At least one cleaner is needed" },
};

export const Disabled: Story = { args: { isDisabled: true } };
