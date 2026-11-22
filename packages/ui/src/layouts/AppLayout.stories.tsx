import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CalendarDays,
  ClipboardPenLine,
  Languages,
  LayoutDashboard,
  LogOut,
  User,
  Users,
} from "lucide-react";
import { expect, waitFor, within } from "storybook/test";
import { AppLayout, type NavItem } from "./AppLayout.tsx";
import { Button } from "../Button.tsx";
import { Card } from "../Card.tsx";
import { Heading } from "../Heading.tsx";
import { List, ListItem } from "../List.tsx";
import { StatusBadge } from "../StatusBadge.tsx";

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
    // the app puts the account's parts here: the sidebar's foot, the rail's
    // Account, and on a phone the ☰ menu's
    foot: () => (
      <Button variant="quiet" className="justify-start">
        <LogOut aria-hidden size={20} />
        Sign out
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
              title="Unpaid job at 35-06 Ditmars Blvd"
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

// from md to lg the sidebar folds to a rail of icons, each name its
// tooltip; the account's parts behind Account at its foot, under the logo
// and the area (#493)
export const Rail: Story = {
  globals: { viewport: { value: "tablet" } },
  play: async ({ canvas, userEvent }) => {
    const rail = canvas.getByRole("navigation", { name: "Office" });
    await expect(rail.getBoundingClientRect().width).toBeLessThanOrEqual(64);
    await expect(
      within(rail).getByRole("link", { name: "Today" }),
    ).toHaveAttribute("aria-current", "page");
    await userEvent.click(canvas.getByRole("button", { name: "Account" }));
    const account = within(document.body).getByRole("dialog", {
      name: "Account",
    });
    await expect(
      within(account).getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
    await expect(
      within(account).getByRole("img", { name: /Empire Cleaning/ }),
    ).toBeVisible();
  },
};

// from lg the full sidebar: the logo, every section named, the account's
// parts at its foot
export const Sidebar: Story = {
  globals: { viewport: { value: "laptop" } },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("img", { name: /Empire Cleaning/ }),
    ).toBeVisible();
  },
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

// more sections than the tab bar holds: the rest are only in the drawer the
// ☰ opens, which lists every section, with the logo (#200, #305)
export const PhoneMenu: Story = {
  globals: { viewport: { value: "phone" } },
  args: {
    nav: [
      { href: "#today", label: "Today", icon: LayoutDashboard },
      {
        href: "#quotes",
        label: "Quotes",
        icon: ClipboardPenLine,
        inMenu: true,
      },
      {
        href: "#clients",
        label: "Clients",
        icon: Users,
        inMenu: true,
        isCurrent: true,
      },
      { href: "#schedule", label: "Schedule", icon: CalendarDays },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    const bar = canvas.getByRole("navigation", { name: "Office" });
    await expect(bar).toHaveTextContent("TodaySchedule");

    await userEvent.click(canvas.getByRole("button", { name: "Menu" }));
    const menu = within(document.body).getByRole("dialog", { name: "Menu" });
    await expect(
      within(menu).getByRole("link", { name: "Clients" }),
    ).toHaveAttribute("aria-current", "page");
    // once it has slid in
    await waitFor(() =>
      expect(
        within(menu).getByRole("img", { name: /Empire Cleaning/ }),
      ).toBeVisible(),
    );
  },
};

// related sections under a heading, in the sidebar and the ☰ menu (on the
// rail, a rule between them); the busiest come first, without one
export const Groups: Story = {
  globals: { viewport: { value: "laptop" } },
  args: {
    nav: [
      {
        href: "#today",
        label: "Today",
        icon: LayoutDashboard,
        isCurrent: true,
      },
      { href: "#schedule", label: "Schedule", icon: CalendarDays },
      {
        href: "#quotes",
        label: "Quotes",
        icon: ClipboardPenLine,
        inMenu: true,
        group: "Work",
      },
      {
        href: "#clients",
        label: "Clients",
        icon: Users,
        inMenu: true,
        group: "People",
      },
      {
        href: "#staff",
        label: "Staff",
        icon: User,
        inMenu: true,
        group: "People",
      },
    ],
  },
  play: async ({ canvas }) => {
    const people = canvas.getByRole("group", { name: "People" });
    await expect(people).toHaveTextContent("PeopleClientsStaff");
  },
};

// on a phone the tab bar keeps the shortcuts, and the account's parts sit
// at the foot of the ☰ menu, as of the sidebar, the other language among
// them named in its own words, so the top bar holds only the ☰ and the
// section (#305)
export const PhoneMenuFoot: Story = {
  globals: { viewport: { value: "phone" } },
  args: {
    area: "Cleaner area",
    nav: [
      {
        href: "#jobs",
        label: "Your jobs",
        icon: CalendarDays,
        isCurrent: true,
      },
      { href: "#offers", label: "Offers", icon: ClipboardPenLine },
    ],
    foot: () => (
      <div className="flex flex-col gap-1">
        <Button variant="quiet" className="justify-start">
          <Languages aria-hidden size={20} />
          <span lang="es">Español</span>
        </Button>
        <Button variant="quiet" className="justify-start">
          <LogOut aria-hidden size={20} />
          Sign out
        </Button>
      </div>
    ),
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const bar = canvas.getByRole("navigation", { name: "Cleaner area" });
    await expect(bar).toHaveTextContent("Your jobsOffers");
    // the top bar holds only the ☰ and the section
    await expect(canvasElement.querySelector("header")).toHaveTextContent(
      /^Your jobs$/i,
    );

    await userEvent.click(canvas.getByRole("button", { name: "Menu" }));
    const menu = within(document.body).getByRole("dialog", { name: "Menu" });
    await waitFor(() =>
      expect(
        within(menu).getByRole("button", { name: "Español" }),
      ).toBeVisible(),
    );
    // the full menu, the tab bar's sections too
    await expect(
      within(menu).getByRole("link", { name: "Your jobs" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      within(menu).getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
  },
};

// the next page loading: the page on show can't be pressed from the start
// until the next one shows, and once it has gone on a moment (200ms; a
// quicker one shows nothing) a bar runs across the top, the page fades, and
// a screen reader hears "Loading…" once. The navigation stays live, still
// on the page on show's section (#454)
export const Loading: Story = {
  globals: { viewport: { value: "tablet" } },
  args: { loading: true },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Loading…"),
    );
    await waitFor(() =>
      expect(
        canvasElement.querySelector("[data-loading-bar=loading]"),
      ).toBeVisible(),
    );
    const onShow = canvasElement.querySelector("main > div");
    await expect(onShow).toHaveAttribute("inert");
    await expect(onShow).toHaveClass(/opacity-50/);
    await expect(canvas.getByRole("link", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};
