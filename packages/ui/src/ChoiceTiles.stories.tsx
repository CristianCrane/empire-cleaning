import type { Meta, StoryObj } from "@storybook/react-vite";
import { Building2, House, Houses, Store } from "lucide-react";
import { expect } from "storybook/test";
import { ChoiceTile, ChoiceTiles } from "./ChoiceTiles.tsx";

const meta = {
  title: "Components/ChoiceTiles",
  component: ChoiceTiles,
  args: { label: "What needs cleaning?", children: null },
} satisfies Meta<typeof ChoiceTiles>;

export default meta;
type Story = StoryObj<typeof meta>;

// four sit two by two on a phone, in a row on wider screens
export const WhatNeedsCleaning: Story = {
  args: {
    defaultValue: "house",
    children: (
      <>
        <ChoiceTile value="house" icon={House}>
          House
        </ChoiceTile>
        <ChoiceTile value="apartment" icon={Building2}>
          Apartment
        </ChoiceTile>
        <ChoiceTile value="townhouse" icon={Houses}>
          Townhouse
        </ChoiceTile>
        <ChoiceTile value="commercial" icon={Store}>
          Business premises
        </ChoiceTile>
      </>
    ),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Business premises"));
    await expect(
      canvas.getByRole("radio", { name: "Business premises" }),
    ).toBeChecked();
  },
};
