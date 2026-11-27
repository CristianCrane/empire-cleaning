import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  ClipboardPenLine,
  CreditCard,
  KeyRound,
  Phone,
  Receipt,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { expect } from "storybook/test";
import { Button } from "../Button.tsx";
import { DateTile } from "../DateTile.tsx";
import { IconTile } from "../IconTile.tsx";
import { Link } from "../Link.tsx";
import { Notice } from "../Notice.tsx";
import { AnswerCard, HomePage, type HomeTile } from "./HomePage.tsx";

const meta = {
  title: "Layout/HomePage",
  component: HomePage,
  args: { answer: null, tilesLabel: "What else, by kind", tiles: [] },
} satisfies Meta<typeof HomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

const at = (days: number, hours: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
};

const officeTiles: HomeTile[] = [
  {
    id: "today",
    icon: CalendarDays,
    label: "On today",
    count: 2,
    hint: "1 needs cleaners",
    rows: [
      {
        id: "j1",
        at: at(0, 9),
        title: "Grace Murphy",
        description: "Standard Clean · 22 Bergen St",
      },
      {
        id: "j2",
        at: at(0, 13),
        title: "Leo Park",
        description: "Deep Clean · 3 Wyckoff St",
      },
    ],
    more: (
      <Link href="#" className="self-start">
        Open the Schedule
      </Link>
    ),
  },
  {
    id: "jobs",
    icon: Sparkles,
    label: "Jobs",
    count: 1,
    hint: "1 new time asked for",
    rows: [
      {
        id: "t1",
        title: "Move to a new time",
        description: "Ruth Kim · asks for Thu, 10:00 AM",
      },
    ],
  },
  {
    id: "quotes",
    icon: ClipboardPenLine,
    label: "Quotes",
    count: 0,
    hint: "None waiting",
  },
  { id: "money", icon: CircleDollarSign, label: "Money", count: 0 },
];

function Office({ clear = false }: { clear?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <HomePage
      greet="Jen Rivera"
      answer={
        clear ? (
          <AnswerCard
            tile={<IconTile icon={CircleCheck} tone="success" size="lg" />}
            headline="Nothing needs you"
          />
        ) : (
          <AnswerCard
            tile={<IconTile icon={UserPlus} tone="warning" size="lg" />}
            label="Needs cleaners"
            headline="Grace Murphy"
            lines={["Deep Clean, Thu, 1:00 PM · 22 Bergen St"]}
            actions={<Button>Find cleaners</Button>}
          />
        )
      }
      tilesLabel="What else, by kind"
      tiles={officeTiles}
      open={open}
      onOpen={setOpen}
    />
  );
}

// the Office's Today: the first to-do as the card, what else by kind in
// tiles that open their rows in place. One with none can't be pressed
export const InPlace: Story = {
  render: () => <Office />,
  play: async ({ canvas, userEvent }) => {
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Hi, Jen" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("region", { name: "Needs cleaners" }),
    ).toBeVisible();
    // no rows until a tile is pressed
    await expect(canvas.queryByRole("grid")).toBeNull();
    const today = canvas.getByRole("button", { name: /On today/ });
    await userEvent.click(today);
    await expect(today).toHaveAttribute("aria-pressed", "true");
    await expect(
      canvas.getByRole("grid", { name: "On today" }),
    ).toHaveTextContent(/Leo Park/);
    // one open at a time; pressed again, closed
    await userEvent.click(canvas.getByRole("button", { name: /Jobs/ }));
    await expect(canvas.getByRole("grid", { name: "Jobs" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /Jobs/ }));
    await expect(canvas.queryByRole("grid")).toBeNull();
    await expect(canvas.getByRole("button", { name: /Money/ })).toBeDisabled();
  },
};

// nothing waiting: the card all clear, green
export const AllClear: Story = {
  render: () => <Office clear />,
};

// a Client's Home: tiles that link to their Lists, the count in the hint;
// fewer than four fill the row, and on a phone an odd one out spans it
export const Links: Story = {
  args: {
    greet: "Grace Murphy",
    actions: [{ label: "Request a quote", icon: ClipboardPenLine, href: "#" }],
    answer: (
      <AnswerCard
        tile={<DateTile date={at(6, 9)} />}
        label="Your next clean"
        headline="Thu, 9:00 AM"
        lines={["Standard Clean at 22 Bergen St"]}
        actions={<Button>See your clean</Button>}
      />
    ),
    tilesLabel: "Shortcuts",
    tiles: [
      {
        id: "move",
        icon: CalendarClock,
        label: "Move or skip",
        hint: "Your Thu clean",
        href: "#",
      },
      {
        id: "in",
        icon: KeyRound,
        label: "How we get in",
        hint: "Key under the mat",
        href: "#",
      },
      {
        id: "call",
        icon: Phone,
        label: "Call us",
        hint: "(646) 320-9076",
        externalHref: "tel:+16463209076",
      },
    ],
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: /How we get in/ }),
    ).toBeVisible();
  },
};

// Payments: its own name in the bar, news under the card, a tile in place
// beside one that links
export const Mixed: Story = {
  render: function Render() {
    const [open, setOpen] = useState<string | null>(null);
    return (
      <HomePage
        title="Payments"
        answer={
          <AnswerCard
            tile={<IconTile icon={CircleCheck} tone="success" size="lg" />}
            label="To pay"
            headline="Nothing"
          />
        }
        notices={<Notice>Your bank payment of $230.00 is on its way.</Notice>}
        tilesLabel="Your payments"
        tiles={[
          {
            id: "all",
            icon: Receipt,
            label: "All payments",
            count: 3,
            panel: <p>Each payment, by month</p>,
          },
          {
            id: "card",
            icon: CreditCard,
            label: "Your card",
            hint: "Visa ending 4242",
            href: "#",
          },
        ]}
        open={open}
        onOpen={setOpen}
      />
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /All payments/ }));
    await expect(canvas.getByText("Each payment, by month")).toBeVisible();
  },
};
