import type { Meta, StoryObj } from "@storybook/react-vite";
import { Figure, Figures } from "./Figures.tsx";

const meta = {
  title: "Components/Figures",
  component: Figures,
  args: { children: null },
} satisfies Meta<typeof Figures>;

export default meta;
type Story = StoryObj<typeof meta>;

// a price's hours and Deposit, under it: in a column at most 28rem wide,
// so on a wide card each value sits near its label
export const Default: Story = {
  render: () => (
    <Figures>
      <Figure label="Cleaning hours" value="3 h 15 min" />
      <Figure label="On site, with 2 cleaners" value="1 h 38 min" />
      <Figure label="Deposit (25%)" value="$48.72" />
    </Figures>
  ),
};

// a plan clean against the same clean as a one-off: the one it comes to
// strong, a value changed since it was sent struck through beside it
export const StrongAndWas: Story = {
  render: () => (
    <Figures>
      <Figure label="As a one-off clean" value="$224.29" />
      <Figure label="Plan discount (10%)" value="−$22.44" />
      <Figure label="On the plan" value="$201.85" was="$194.89" strong />
    </Figures>
  ),
};

// a receipt, its labels in full and its total under a rule
export const Receipt: Story = {
  render: () => (
    <Figures size="md">
      <Figure label="Standard Clean" value="$179.00" />
      <Figure label="Sales tax" value="$15.89" />
      <Figure label="Total" value="$194.89" total />
    </Figures>
  ),
};
