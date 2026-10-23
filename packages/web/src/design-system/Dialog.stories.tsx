import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor, within } from "storybook/test";
import { Actions } from "./Actions.tsx";
import { Button } from "./Button.tsx";
import { Dialog, DialogTrigger, type DialogProps } from "./Dialog.tsx";
import { Form } from "./Form.tsx";
import { TextField } from "./TextField.tsx";

type Args = Omit<DialogProps, "children"> & { onConfirm: () => void };

const meta: Meta<Args> = {
  title: "Components/Dialog",
  args: { title: "Send Quote", onConfirm: fn() },
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<Args>;

// focus moves into the dialog, Escape closes it, and focus returns to the button
export const Default: Story = {
  render: ({ onConfirm, ...args }) => (
    <DialogTrigger>
      <Button>Send Quote</Button>
      <Dialog {...args}>
        {({ close }) => (
          <>
            <p className="text-fg-muted">
              Casey Client will get an email with the Quote for 41-12 Austin St.
            </p>
            <Actions>
              <Button variant="secondary" onPress={close}>
                Not yet
              </Button>
              <Button
                onPress={() => {
                  onConfirm();
                  close();
                }}
              >
                Send
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const opener = canvas.getByRole("button", { name: "Send Quote" });
    await userEvent.click(opener);

    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Send Quote" },
    );
    await expect(dialog).toContainElement(
      canvasElement.ownerDocument.activeElement as HTMLElement,
    );

    await userEvent.keyboard("{Escape}");
    // it animates out before leaving the page
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  },
};

// for something that can't be undone: tapping outside doesn't close it
export const Destructive: Story = {
  args: { title: "End Service Plan", role: "alertdialog" },
  render: ({ onConfirm, ...args }) => (
    <DialogTrigger>
      <Button variant="danger">End Service Plan</Button>
      <Dialog {...args}>
        {({ close }) => (
          <>
            <p className="text-fg-muted">
              No more Jobs will be scheduled for 41-12 Austin St.
            </p>
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                onPress={() => {
                  onConfirm();
                  close();
                }}
              >
                End Service Plan
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  ),
};

export const WithForm: Story = {
  args: { title: "Add Property" },
  render: ({ onConfirm, ...args }) => (
    <DialogTrigger>
      <Button>Add Property</Button>
      <Dialog {...args}>
        {({ close }) => (
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              onConfirm();
              close();
            }}
          >
            <TextField label="Address" isRequired autoFocus />
            <TextField label="Postcode" isRequired />
            <Actions>
              <Button variant="secondary" onPress={close}>
                Cancel
              </Button>
              <Button type="submit">Add</Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  ),
};
