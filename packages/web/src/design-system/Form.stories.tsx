import type { Meta, StoryObj } from "@storybook/react-vite";
import { parseDate } from "@internationalized/date";
import { expect, fn } from "storybook/test";
import { Actions } from "./Actions.tsx";
import { Button } from "./Button.tsx";
import { Checkbox } from "./Checkbox.tsx";
import { DatePicker, TimeField } from "./DateField.tsx";
import { Form } from "./Form.tsx";
import { NumberField } from "./NumberField.tsx";
import { Select, SelectItem } from "./Select.tsx";
import { TextField } from "./TextField.tsx";

const meta = {
  title: "Components/Form",
  component: Form,
  args: { onSubmit: fn((e) => e.preventDefault()) },
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

// every control together, as a feature screen would use them
export const AllControls: Story = {
  render: (args) => (
    <Form {...args} className="max-w-md">
      <TextField label="Full name" name="name" isRequired />
      <TextField label="Email" name="email" type="email" isRequired />
      <Select label="Condition" name="condition" defaultSelectedKey="moderate">
        <SelectItem id="light">Light</SelectItem>
        <SelectItem id="moderate">Moderate</SelectItem>
        <SelectItem id="heavy">Heavy</SelectItem>
      </Select>
      <NumberField
        label="Bedrooms"
        name="bedrooms"
        defaultValue={2}
        minValue={0}
      />
      <DatePicker
        label="Preferred date"
        name="date"
        defaultValue={parseDate("2026-11-02")}
      />
      <TimeField label="Preferred time" name="time" />
      <TextField label="Access Instructions" name="access" multiline />
      <Checkbox name="pets">There are pets at the Property</Checkbox>
      <Actions>
        <Button type="submit">Request a Quote</Button>
      </Actions>
    </Form>
  ),
};

// the API's own field errors show against the fields they belong to
export const ServerErrors: Story = {
  args: {
    validationErrors: { email: "There is already an Account with this email" },
  },
  render: AllControls.render,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("textbox", { name: "Email" }),
    ).toHaveAccessibleDescription(
      "There is already an Account with this email",
    );
  },
};

export const SubmitsWhenValid: Story = {
  render: AllControls.render,
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Full name" }),
      "Casey Client",
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Email" }),
      "casey@example.com",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Request a Quote" }),
    );

    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};
