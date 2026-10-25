import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Radio, RadioGroup } from "./RadioGroup.tsx";

const meta = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  args: { label: "How much cleaning does it need?", children: null },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const conditions = (
  <>
    <Radio value="light" description="Tidy, with everyday dust and marks">
      Light
    </Radio>
    <Radio
      value="moderate"
      description="Lived in: some build-up in kitchen and bathrooms"
    >
      Moderate
    </Radio>
    <Radio
      value="heavy"
      description="Not cleaned in a while, or after a move or party"
    >
      Heavy
    </Radio>
  </>
);

export const WithDescriptions: Story = {
  args: { children: conditions, defaultValue: "moderate" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Heavy"));
    await expect(canvas.getByRole("radio", { name: /heavy/i })).toBeChecked();
  },
};

export const Horizontal: Story = {
  args: {
    label: "Type of home",
    orientation: "horizontal",
    children: (
      <>
        <Radio value="house">House</Radio>
        <Radio value="apartment">Apartment</Radio>
        <Radio value="townhouse">Townhouse</Radio>
      </>
    ),
  },
};

export const Invalid: Story = {
  args: {
    children: conditions,
    isInvalid: true,
    errorMessage: "Choose how much cleaning the home needs",
  },
};

export const Disabled: Story = {
  args: { children: conditions, defaultValue: "light", isDisabled: true },
};
