import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActionFooter } from "./ActionFooter.tsx";
import { Button } from "./Button.tsx";

const meta = {
  title: "Components/ActionFooter",
  component: ActionFooter,
  args: {
    "aria-label": "What to do",
    children: (
      <>
        <Button variant="danger-text">Record No Access</Button>
        <Button>Complete Job</Button>
      </>
    ),
  },
} satisfies Meta<typeof ActionFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
