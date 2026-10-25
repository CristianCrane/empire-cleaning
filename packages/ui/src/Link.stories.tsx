import type { Meta, StoryObj } from "@storybook/react-vite";
import { ButtonLink, Link } from "./Link.tsx";

const meta = {
  title: "Components/Link",
  component: Link,
  args: { href: "#", children: "View the Quote" },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InText: Story = {
  render: (args) => (
    <p>
      Your Quote is ready. <Link {...args} /> to accept it.
    </p>
  ),
};

export const AsAButton: Story = {
  render: () => <ButtonLink href="#">Request a Quote</ButtonLink>,
};
