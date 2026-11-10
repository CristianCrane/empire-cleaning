import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutDashboard } from "lucide-react";
import { expect, waitFor } from "storybook/test";
import { ActionFooter } from "./ActionFooter.tsx";
import { AppLayout } from "./AppLayout.tsx";
import { Button } from "./Button.tsx";

const meta = {
  title: "Components/ActionFooter",
  component: ActionFooter,
  args: {
    "aria-label": "What to do",
    children: (
      <>
        <Button variant="danger-text">Couldn't get in</Button>
        <Button>Mark done</Button>
      </>
    ),
  },
} satisfies Meta<typeof ActionFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// more actions than a phone's row holds: the footer wraps to more rows, and
// the page still scrolls clear of it
export const Wrapped: Story = {
  globals: { viewport: { value: "phone" } },
  parameters: { layout: "fullscreen" },
  args: {
    children: [
      "Couldn't get in",
      "Drop out of this job",
      "Call the office",
      "Directions",
      "Add a photo",
      "Mark done",
    ].map((label) => <Button key={label}>{label}</Button>),
  },
  render: (args) => (
    <AppLayout
      area="Cleaner"
      account={null}
      menuFoot={() => null}
      nav={[
        {
          href: "#today",
          label: "Today",
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
