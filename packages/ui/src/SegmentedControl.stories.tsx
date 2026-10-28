import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect } from "storybook/test";
import { Segment, SegmentedControl } from "./SegmentedControl.tsx";

const meta = {
  title: "Components/SegmentedControl",
  component: SegmentedControl,
  args: { label: "Type of home", children: null },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TypeOfHome: Story = {
  args: {
    defaultValue: "house",
    children: (
      <>
        <Segment value="house">House</Segment>
        <Segment value="apartment">Apartment</Segment>
        <Segment value="townhouse">Townhouse</Segment>
      </>
    ),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Apartment"));
    await expect(
      canvas.getByRole("radio", { name: "Apartment" }),
    ).toBeChecked();
  },
};

const conditions = {
  light: "Tidy, with everyday dust and marks",
  moderate: "Lived in, with some build-up in the kitchen and bathrooms",
  heavy: "Not cleaned in a while, or after a move, renovation or party",
};

// the picked option's meaning shows under the tray
export const ExplainsThePick: Story = {
  render: function Render() {
    const [value, setValue] = useState<keyof typeof conditions>("moderate");
    return (
      <SegmentedControl
        label="How much cleaning does it need?"
        value={value}
        onChange={(v) => setValue(v as keyof typeof conditions)}
        description={conditions[value]}
      >
        <Segment value="light">Light</Segment>
        <Segment value="moderate">Moderate</Segment>
        <Segment value="heavy">Heavy</Segment>
      </SegmentedControl>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Heavy"));
    await expect(canvas.getByRole("radiogroup")).toHaveAccessibleDescription(
      conditions.heavy,
    );
  },
};
