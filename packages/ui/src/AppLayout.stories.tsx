import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CalendarDays,
  ClipboardPenLine,
  LayoutDashboard,
  User,
  Users,
} from "lucide-react";
import { expect } from "storybook/test";
import { AppLayout, type NavItem } from "./AppLayout.tsx";
import { Button } from "./Button.tsx";
import { Card } from "./Card.tsx";
import { Heading } from "./Heading.tsx";
import { List, ListItem } from "./List.tsx";
import { StatusBadge } from "./StatusBadge.tsx";

const officeNav: NavItem[] = [
  { href: "#today", label: "Today", icon: LayoutDashboard, isCurrent: true },
  { href: "#quotes", label: "Quotes", icon: ClipboardPenLine },
  { href: "#schedule", label: "Schedule", icon: CalendarDays },
  { href: "#clients", label: "Clients", icon: Users },
];

const meta = {
  title: "Layout/AppLayout",
  component: AppLayout,
  parameters: { layout: "fullscreen" },
  args: {
    area: "Office",
    nav: officeNav,
    // the app puts its account menu here
    account: (
      <Button variant="quiet" className="justify-start">
        <User aria-hidden size={20} />
        <span className="max-md:sr-only">Olive Owner</span>
      </Button>
    ),
    children: (
      <div className="flex flex-col gap-4">
        <Heading level={1} inBar>
          Today
        </Heading>
        <Card title="Needs attention">
          <List aria-label="Needs attention">
            <ListItem
              id="1"
              title="Quote asked for by Dana Doe"
              description="108-20 71st Ave · 2 hours ago"
              end={<StatusBadge tone="info">New</StatusBadge>}
            />
            <ListItem
              id="2"
              title="Unpaid Job at 35-06 Ditmars Blvd"
              description="Card declined yesterday"
              end={<StatusBadge tone="danger">Unpaid</StatusBadge>}
            />
          </List>
        </Card>
      </div>
    ),
  },
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

// the tests run at phone width: the bottom tab bar is the navigation
export const Phone: Story = {
  globals: { viewport: { value: "phone" } },
  play: async ({ canvas }) => {
    const nav = canvas.getByRole("navigation", { name: "Office" });
    await expect(nav).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // the bar names the page, so its own heading is for screen readers only
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Today" }),
    ).toHaveClass(/sr-only/);
  },
};

export const Desktop: Story = {
  globals: { viewport: { value: "tablet" } },
};

export const Cleaner: Story = {
  globals: { viewport: { value: "phone" } },
  args: {
    area: "Cleaner",
    nav: [
      {
        href: "#today",
        label: "Today",
        icon: LayoutDashboard,
        isCurrent: true,
      },
      { href: "#schedule", label: "Schedule", icon: CalendarDays },
    ],
  },
};
