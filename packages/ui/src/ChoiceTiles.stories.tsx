import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Building2,
  House,
  Houses,
  PaintRoller,
  Sparkles,
  Store,
} from "lucide-react";
import { expect } from "storybook/test";
import { ChoiceTile, ChoiceTiles, ChoiceTilesLoading } from "./ChoiceTiles.tsx";

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

const five = (
  <>
    <ChoiceTile value="standard" icon={Sparkles}>
      Standard Clean
    </ChoiceTile>
    <ChoiceTile value="deep" icon={House}>
      Deep Clean
    </ChoiceTile>
    <ChoiceTile value="move" icon={Houses}>
      Move-in/out Clean
    </ChoiceTile>
    <ChoiceTile value="commercial" icon={Building2}>
      Commercial cleaning
    </ChoiceTile>
    <ChoiceTile value="painting" icon={PaintRoller}>
      Painting
    </ChoiceTile>
  </>
);

// a short last row's tiles grow to fill it, so no row ends in a gap
export const LastRowFilled: Story = {
  args: { label: "What can we help with?", children: five },
  play: async ({ canvas }) => {
    const width = (name: string) =>
      canvas
        .getByRole("radio", { name })
        .closest("label")!
        .getBoundingClientRect().width;
    await expect(width("Painting")).toBeGreaterThan(width("Standard Clean"));
  },
};

// while the choices load, blank tiles the size of real ones, so nothing
// moves when they arrive
export const Loading: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <ChoiceTilesLoading label="What can we help with?" count={6} />
      <ChoiceTiles label="What can we help with?">{five}</ChoiceTiles>
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const blank = canvasElement
      .querySelector("[aria-busy] [aria-hidden] > div")!
      .getBoundingClientRect().height;
    const real = canvas
      .getByRole("radio", { name: "Painting" })
      .closest("label")!
      .getBoundingClientRect().height;
    await expect(blank).toBeCloseTo(real, 0);
  },
};
