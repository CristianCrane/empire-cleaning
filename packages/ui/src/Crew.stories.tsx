import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CrewSection, ExtrasSection } from "./Crew.tsx";

const meta = {
  title: "Components/Crew",
  component: CrewSection,
  args: {
    title: "Crew",
    size: 2,
    members: [{ name: "You", confirmed: true }],
  },
} satisfies Meta<typeof CrewSection>;

export default meta;
type Story = StoryObj<typeof meta>;

// one confirmed, one still needed: a tick on the face, a ghost for the
// one needed, and the line counting both
export const OneNeeded: Story = {
  play: async ({ canvasElement }) => {
    const crew = within(canvasElement).getByRole("region", { name: "Crew" });
    await expect(crew).toHaveTextContent("1 of 2 confirmed, 1 needed");
    await expect(within(crew).getAllByRole("listitem")).toHaveLength(2);
  },
};

// an offer: nobody in yet, every one needed
export const AllNeeded: Story = {
  args: { members: [], size: 3 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent("3 needed");
  },
};

// a full crew, one still to confirm: no word but the tick tells them apart
export const OneNotYet: Story = {
  args: {
    size: 3,
    members: [
      { name: "You", confirmed: true },
      { name: "Dee", confirmed: false },
      { name: "Ana", confirmed: true },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent("2 of 3 confirmed");
    await expect(canvasElement).not.toHaveTextContent("needed");
  },
};

// a Job's extras, one a line; none, no part
export const Extras: Story = {
  render: () => (
    <ExtrasSection
      title="Extras"
      extras={["Inside the oven", "Inside the fridge", "Baseboards"]}
    />
  ),
};
