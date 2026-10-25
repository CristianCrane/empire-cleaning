import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Breadcrumbs } from "./Breadcrumbs.tsx";

const meta = {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
  args: {
    trail: [
      { label: "Requests", href: "#requests" },
      { label: "Casey Client" },
    ],
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

// the last crumb is the page you're on: marked current, not a link
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: "Requests" }),
    ).toHaveAttribute("href", "#requests");
    await expect(canvas.getByText("Casey Client")).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

export const ThreeLevels: Story = {
  args: {
    trail: [
      { label: "Home", href: "#home" },
      { label: "Your homes", href: "#homes" },
      { label: "41-12 Austin St, 4B, 11375" },
    ],
  },
};

// long names wrap rather than push the page sideways
export const WrapsOnAPhone: Story = {
  args: {
    trail: [
      { label: "Requests", href: "#requests" },
      { label: "Casey Clientwithaverylongsurname-Smithington-Jones" },
    ],
  },
  globals: { viewport: { value: "phone" } },
};
