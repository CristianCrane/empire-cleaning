import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleAlert, LayoutDashboard, SearchX } from "lucide-react";
import { expect } from "storybook/test";
import { Button } from "../Button.tsx";
import { TextField } from "../TextField.tsx";
import { AppLayout } from "./AppLayout.tsx";
import { MessagePage, SignInPage } from "./MessagePage.tsx";

const meta = {
  title: "Layout/MessagePage",
  component: MessagePage,
  parameters: { layout: "fullscreen" },
  args: {
    title: "Page not found",
    icon: SearchX,
    home: "#",
    children: <p className="text-fg-muted">That page doesn't exist.</p>,
  },
} satisfies Meta<typeof MessagePage>;

export default meta;
type Story = StoryObj<typeof meta>;

// signed out: a page of its own, the logo above
export const OnItsOwn: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("main")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Go to your home page" }),
    ).toBeVisible();
  },
};

// its one Button, what fixes it
export const WithItsButton: Story = {
  args: {
    title: "Something went wrong",
    icon: CircleAlert,
    tone: "warning",
    children: (
      <>
        <p className="text-fg-muted">
          We couldn't load this page. Try again in a moment.
        </p>
        <Button>Try again</Button>
      </>
    ),
  },
};

// in an area: the area's frame, nav and all, and no logo or main of its own
export const InAnArea: Story = {
  globals: { viewport: { value: "phone" } },
  render: (args) => (
    <AppLayout
      area="Office"
      nav={[
        { href: "#", label: "Today", icon: LayoutDashboard, isCurrent: true },
      ]}
      foot={() => null}
    >
      <MessagePage {...args} />
    </AppLayout>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("main")).toHaveLength(1);
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
  },
};

// Sign in's: the form in the card, a line for someone new under it
export const SignIn: Story = {
  render: () => (
    <SignInPage
      title="Sign in"
      after={
        <p className="text-center text-sm text-fg-muted">
          New to Empire Cleaning? Sign in with your email.
        </p>
      }
    >
      <TextField label="Email" type="email" />
      <Button className="w-full">Email me a sign-in link</Button>
    </SignInPage>
  ),
};
