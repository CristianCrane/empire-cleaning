import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { CalendarPage } from "./CalendarPage.tsx";

const meta = {
  title: "Layout/CalendarPage",
  component: CalendarPage,
  args: {
    title: "Schedule",
    children: (
      <div className="grid h-64 grid-cols-3 gap-2">
        {["Mon 16", "Tue 17", "Wed 18"].map((day) => (
          <div key={day} className="rounded-md border border-border p-2">
            {day}
          </div>
        ))}
      </div>
    ),
  },
} satisfies Meta<typeof CalendarPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// the shared page header, then the calendar's parts
export const TheSchedule: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Schedule" }),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Tue 17")).toBeVisible();
  },
};
