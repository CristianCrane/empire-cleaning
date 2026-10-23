import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Button } from "./Button.tsx";
import { Form } from "./Form.tsx";
import { TextField } from "./TextField.tsx";

const meta = {
  title: "Components/TextField",
  component: TextField,
  args: { label: "Email", type: "email", name: "email" },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: "We'll send your Quote here." },
};

export const WithPlaceholder: Story = {
  args: { label: "Postcode", type: "text", placeholder: "11375" },
};

export const Invalid: Story = {
  args: {
    defaultValue: "casey@",
    isInvalid: true,
    errorMessage: "Enter a full email address",
  },
};

export const Disabled: Story = {
  args: { defaultValue: "casey@example.com", isDisabled: true },
};

export const Multiline: Story = {
  args: {
    label: "Access Instructions",
    type: "text",
    multiline: true,
    description: "Door codes, where the key is, parking.",
  },
};

// errors appear on submit, are announced, and clear once fixed and the person
// moves on (never mid-typing)
export const RequiredInAForm: Story = {
  render: (args) => (
    <Form onSubmit={(e) => e.preventDefault()}>
      <TextField {...args} isRequired />
      <Button type="submit">Continue</Button>
    </Form>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Continue" }));

    const field = canvas.getByRole("textbox", { name: "Email" });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveFocus();
    await expect(field).toHaveAccessibleDescription(/fill out this field/i);

    await userEvent.type(field, "casey@example.com");
    await userEvent.tab();
    await expect(field).not.toHaveAttribute("aria-invalid");
  },
};
