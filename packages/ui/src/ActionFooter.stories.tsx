import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutDashboard } from "lucide-react";
import { expect, waitFor } from "storybook/test";
import { ActionFooter } from "./ActionFooter.tsx";
import { AppLayout } from "./layouts/AppLayout.tsx";
import { Button } from "./Button.tsx";

const meta = {
  title: "Components/ActionFooter",
  component: ActionFooter,
  args: {
    "aria-label": "What to do",
    summary: "$240.00",
    status: "Saved",
    children: <Button>Send</Button>,
  },
} satisfies Meta<typeof ActionFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// more than a phone's row holds (a Quote Draft's sums, long): the footer
// wraps to more rows, and the page still scrolls clear of it
export const Wrapped: Story = {
  globals: { viewport: { value: "phone" } },
  parameters: { layout: "fullscreen" },
  args: {
    summary: "$240.00 a clean, $221.00 a clean on the plan",
    status: "Saved",
    children: [
      <Button key="preview" variant="secondary">
        See what the client sees
      </Button>,
      <Button key="send">Send to the client</Button>,
    ],
  },
  render: (args) => (
    <AppLayout
      area="Office"
      foot={() => null}
      nav={[
        {
          href: "#quotes",
          label: "Quotes",
          icon: LayoutDashboard,
          isCurrent: true,
        },
      ]}
    >
      <div className="h-[150vh]" />
      <p>The end of the page</p>
      <ActionFooter {...args} />
    </AppLayout>
  ),
  play: async ({ canvas }) => {
    const footer = canvas.getByRole("group", { name: "What to do" });
    const end = canvas.getByText("The end of the page");
    await waitFor(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await expect(end.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        footer.getBoundingClientRect().top,
      );
    });
  },
};
