import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmbeddedField } from "./EmbeddedField.tsx";

// stands in for the payment provider's card box, which lives in its own frame
const providerInput = (
  <span className="text-fg-muted">Card number · MM / YY · CVC</span>
);

const meta = {
  title: "Components/EmbeddedField",
  component: EmbeddedField,
  args: {
    label: "Card",
    description: "Entered straight into our payment provider's secure form.",
    children: providerInput,
  },
} satisfies Meta<typeof EmbeddedField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Focused: Story = { args: { isFocused: true } };

export const Invalid: Story = {
  args: { errorMessage: "Your card number is incomplete." },
};
