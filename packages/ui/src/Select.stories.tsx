import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Select, SelectItem } from "./Select.tsx";

const conditions = [
  { id: "light", name: "Light" },
  { id: "moderate", name: "Moderate" },
  { id: "heavy", name: "Heavy" },
];

const meta = {
  title: "Components/Select",
  component: Select,
  args: {
    label: "Condition",
    placeholder: "Choose a Condition",
    items: conditions,
    children: (item: { id: string; name: string }) => (
      <SelectItem id={item.id}>{item.name}</SelectItem>
    ),
  },
} satisfies Meta<typeof Select<{ id: string; name: string }>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelection: Story = {
  args: { defaultSelectedKey: "moderate" },
};

// opens with a tap or the keyboard; choosing an option closes it
export const Choosing: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /condition/i }));

    const listbox = await within(canvasElement.ownerDocument.body).findByRole(
      "listbox",
    );
    await userEvent.click(
      within(listbox).getByRole("option", { name: "Heavy" }),
    );

    await expect(
      canvas.getByRole("button", { name: /condition/i }),
    ).toHaveTextContent("Heavy");
  },
};

export const Invalid: Story = {
  args: { isInvalid: true, errorMessage: "Choose the Property's Condition" },
};

export const Disabled: Story = {
  args: { isDisabled: true, defaultSelectedKey: "light" },
};
