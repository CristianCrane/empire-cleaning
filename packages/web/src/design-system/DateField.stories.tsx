import type { Meta, StoryObj } from "@storybook/react-vite";
import { Time, isWeekend, parseDate } from "@internationalized/date";
import { expect, within } from "storybook/test";
import { Calendar } from "./Calendar.tsx";
import { DatePicker, TimeField } from "./DateField.tsx";

const meta = {
  title: "Components/Date and time",
  component: DatePicker,
  args: { label: "First Clean" },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyDate: Story = {};

export const DateWithValue: Story = {
  args: { defaultValue: parseDate("2026-11-02") },
};

// opens a calendar; choosing a day fills the field
export const PickingADate: Story = {
  args: { defaultValue: parseDate("2026-11-02") },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /calendar/i }));

    const calendar = await within(canvasElement.ownerDocument.body).findByRole(
      "application",
    );
    await userEvent.click(
      within(calendar).getByRole("button", { name: /November 12/ }),
    );

    await expect(
      canvas.getByRole("spinbutton", { name: /day/i }),
    ).toHaveTextContent("12");
  },
};

// e.g. no weekend Jobs, nothing in the past
export const UnavailableDays: Story = {
  args: {
    defaultValue: parseDate("2026-11-02"),
    minValue: parseDate("2026-11-02"),
    isDateUnavailable: (date) => isWeekend(date, "en-US"),
    description: "Weekdays only",
  },
};

export const DateInvalid: Story = {
  args: {
    defaultValue: parseDate("2026-10-01"),
    isInvalid: true,
    errorMessage: "Choose a date after today",
  },
};

export const DateDisabled: Story = {
  args: { defaultValue: parseDate("2026-11-02"), isDisabled: true },
};

export const EmptyTime: StoryObj<typeof TimeField> = {
  render: (args) => <TimeField {...args} />,
  args: { label: "Arrival" },
};

export const TimeWithValue: StoryObj<typeof TimeField> = {
  render: (args) => <TimeField {...args} />,
  args: { label: "Arrival", defaultValue: new Time(9, 30) },
};

export const TimeInvalid: StoryObj<typeof TimeField> = {
  render: (args) => <TimeField {...args} />,
  args: {
    label: "Arrival",
    defaultValue: new Time(22, 0),
    isInvalid: true,
    errorMessage: "Jobs start between 7 AM and 6 PM",
  },
};

export const CalendarOnly: StoryObj<typeof Calendar> = {
  render: (args) => <Calendar {...args} />,
  args: { "aria-label": "Schedule", defaultValue: parseDate("2026-11-02") },
};
