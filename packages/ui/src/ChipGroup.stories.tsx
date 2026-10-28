import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Chip, ChipGroup } from "./ChipGroup.tsx";

const meta = {
  title: "Components/ChipGroup",
  component: ChipGroup,
  args: { label: "Any extras?", children: null },
} satisfies Meta<typeof ChipGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Extras: Story = {
  args: {
    description: "Optional. Your Quote will show what each one costs.",
    defaultValue: ["fridge"],
    children: (
      <>
        <Chip value="oven">Inside the oven</Chip>
        <Chip value="fridge">Inside the fridge</Chip>
        <Chip value="cabinets">Inside the cabinets</Chip>
        <Chip value="windows">Interior windows</Chip>
      </>
    ),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Inside the oven"));
    await expect(
      canvas.getByRole("checkbox", { name: "Inside the oven" }),
    ).toBeChecked();
  },
};

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// short labels, with the full name for screen readers
export const Weekdays: Story = {
  args: {
    label: "Which days?",
    errorMessage: "Choose at least one day.",
    children: days.map((day) => (
      <Chip key={day} value={day} aria-label={day}>
        {day.slice(0, 3)}
      </Chip>
    )),
  },
};
