import type { Meta, StoryObj } from "@storybook/react-vite";
import { TestSiteBanner } from "./TestSiteBanner.tsx";

const meta = {
  title: "Components/TestSiteBanner",
  component: TestSiteBanner,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TestSiteBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
