import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Banknote,
  Calendar,
  CalendarX,
  CircleCheck,
  Clock,
  FilePen,
  Mail,
  MapPin,
  Phone,
  Printer,
  RotateCcw,
  Send,
  Users,
} from "lucide-react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "../Button.tsx";
import { DateTile } from "../DateTile.tsx";
import { Dialog } from "../Dialog.tsx";
import { Fact, Facts } from "../Facts.tsx";
import { Fold } from "../Fold.tsx";
import { IconTile } from "../IconTile.tsx";
import { Section } from "../Section.tsx";
import { Card } from "../Card.tsx";
import { StatusBadge } from "../StatusBadge.tsx";
import { Timeline, TimelineItem } from "../Timeline.tsx";
import { DetailsCard, RecordPage } from "./RecordPage.tsx";

const trail = [
  { label: "Jobs", href: "#" },
  { label: "Maria Lopez", href: "#" },
  { label: "Deep Clean" },
];

const history = (
  <Timeline aria-label="History">
    <TimelineItem
      icon={CircleCheck}
      title="Done by Ana Ruiz"
      when="Nov 12, 4:10 PM"
      current
    />
    <TimelineItem icon={Users} title="Ana Ruiz confirmed" when="Nov 10" />
    <TimelineItem icon={Calendar} title="Booked" when="Nov 3" />
  </Timeline>
);

const details = (
  <DetailsCard
    tile={<DateTile date="2026-11-12" />}
    kicker="Deep Clean"
    title="Thu, Nov 12, 9:00 AM"
    line="Until about 4:00 PM"
  >
    <Facts>
      <Fact icon={MapPin} label="Home" value="482 Halsey St, Brooklyn" />
      <Fact icon={Clock} label="Cleaning hours" value="7 h" />
      <Fact icon={Users} label="Cleaners" value="2" />
    </Facts>
  </DetailsCard>
);

const meta = {
  title: "Layout/RecordPage",
  component: RecordPage,
  args: {
    trail,
    title: "Deep Clean at 482 Halsey St",
    status: <StatusBadge tone="success">Done</StatusBadge>,
    details,
    history,
  },
} satisfies Meta<typeof RecordPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// what can be done to it in one Actions menu at the end of the title row,
// the destructive last in red; one opens its dialog
export const ActionsInTheHeader: Story = {
  args: {
    actions: [
      {
        label: "Undo completion",
        icon: RotateCcw,
        danger: true,
        dialog: (state) => (
          <Dialog title="Undo completion?" role="alertdialog" {...state}>
            <p>It goes back to booked.</p>
          </Dialog>
        ),
      },
      { label: "Send receipt again", icon: Send, onAction: () => {} },
      { label: "Correct how it went", icon: FilePen, onAction: () => {} },
    ],
    children: (
      <Section title="Money">
        <Card>
          <Facts>
            <Fact icon={Banknote} label="Total" value="$370.17" />
          </Facts>
          <Fold label="How it's worked out">
            <p>7 h at $45.00, and tax.</p>
          </Fold>
        </Card>
      </Section>
    ),
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Actions" }));
    const menu = within(document.body).getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    // the destructive one last, whatever order it's given in
    await expect(items.at(-1)).toHaveTextContent("Undo completion");
    await userEvent.click(items.at(-1)!);
    await expect(
      within(document.body).getByRole("alertdialog", {
        name: "Undo completion?",
      }),
    ).toBeVisible();
  },
};

// one action: a Button in the menu's place
export const OneAction: Story = {
  args: {
    trail: [{ label: "Bills", href: "#" }, { label: "EC-000123" }],
    title: "Bill EC-000123",
    status: <StatusBadge tone="warning">Due</StatusBadge>,
    subtitle: "Week of Nov 3",
    actions: [{ label: "Print", icon: Printer, onAction: () => {} }],
    details: (
      <DetailsCard
        tile={<IconTile icon={Banknote} size="lg" />}
        kicker="To pay by Nov 14"
        title="$1,240.00"
      />
    ),
    history: undefined,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Print" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Actions" })).toBeNull();
  },
};

// two alerts, the most pressing first; the rest a tap away
export const Alerts: Story = {
  args: {
    alerts: [
      { key: "a", tone: "info", children: <p>The client asked for a plan.</p> },
      {
        key: "b",
        tone: "warning",
        children: <p>The cleaner reported 2 price changes.</p>,
      },
      {
        key: "c",
        tone: "danger",
        children: <p>$370.17 didn't go through (card declined).</p>,
        action: <Button variant="text">Retry charge</Button>,
      },
    ],
  },
  play: async ({ canvas }) => {
    const shown = () => [
      ...canvas.queryAllByRole("alert"),
      ...canvas.queryAllByRole("status"),
    ];
    await expect(shown()).toHaveLength(2);
    // the danger one, though given last
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "didn't go through",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Show 1 more" }));
    await expect(shown()).toHaveLength(3);
  },
};

// on site: the main action kept in reach at the foot
export const OnSite: Story = {
  globals: { viewport: { value: "phone" } },
  args: {
    trail: [{ label: "Jobs", href: "#" }, { label: "Deep Clean" }],
    status: <StatusBadge tone="info">Confirmed</StatusBadge>,
    history: undefined,
    actions: [
      { label: "Call the office", icon: Phone, onAction: () => {} },
      { label: "Email the office", icon: Mail, onAction: () => {} },
      { label: "Drop out", icon: CalendarX, danger: true, onAction: () => {} },
    ],
    footer: {
      label: "Job",
      children: (
        <Button>
          <CircleCheck aria-hidden size={18} />
          Complete
        </Button>
      ),
    },
  },
};
