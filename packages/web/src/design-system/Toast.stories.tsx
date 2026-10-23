import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Button } from "./Button.tsx";
import { ToastRegion, showToast, type ToastContent } from "./Toast.tsx";

function Demo(content: ToastContent) {
  return (
    <>
      <Button onPress={() => showToast(content)}>Show toast</Button>
      <ToastRegion />
    </>
  );
}

const meta = {
  title: "Components/Toast",
  component: Demo,
  args: { title: "Quote sent", description: "Casey Client has been emailed." },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

// announced to screen readers without stealing focus; can be dismissed
export const Default: Story = {
  args: { tone: "success" },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Show toast" }));

    const body = within(canvasElement.ownerDocument.body);
    const toast = await body.findByRole("alertdialog", { name: "Quote sent" });
    await expect(
      canvas.getByRole("button", { name: "Show toast" }),
    ).toHaveFocus();

    await userEvent.click(
      within(toast).getByRole("button", { name: "Dismiss" }),
    );
    await expect(toast).not.toBeInTheDocument();
  },
};

export const Info: Story = {
  args: { tone: "info", title: "Schedule updated", description: undefined },
};

export const Failure: Story = {
  args: {
    tone: "danger",
    title: "Couldn't charge the card",
    description: "The Job is marked Unpaid.",
  },
};
