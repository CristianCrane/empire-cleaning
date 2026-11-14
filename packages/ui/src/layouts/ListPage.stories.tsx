import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BrushCleaning, FilePlus, Layers, UserPlus } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Avatar } from "../Avatar.tsx";
import { Dialog } from "../Dialog.tsx";
import { StatusBadge } from "../StatusBadge.tsx";
import { ListPage, type ListColumn, type ListRow } from "./ListPage.tsx";

type Job = {
  id: string;
  at: string;
  client: string;
  home: string;
  area: string;
  service: string;
  tab: "upcoming" | "past" | "cancelled";
  staffed: boolean;
};

const clients = [
  "Chloe Nguyen",
  "Maria Lopez",
  "Ortiz Dental",
  "Sam Ng",
  "Priya Shah",
  "Dan Weiss",
];
const homes: [string, string][] = [
  ["482 Halsey St", "Bed-Stuy, 11233"],
  ["17 5th Ave", "Park Slope, 11215"],
  ["210 Court St", "Cobble Hill, 11201"],
];
const services = ["Standard Clean", "Deep Clean", "Move-out Clean"];

// a run of Jobs, two a week from Nov 2026, the first few needing cleaners
const jobs: Job[] = Array.from({ length: 64 }, (_, i) => {
  const at = new Date(
    Date.UTC(2026, 10, 15 + Math.floor(i * 3.5), 13 + (i % 3) * 2),
  );
  const [home, area] = homes[i % homes.length]!;
  return {
    id: `j${i}`,
    at: at.toISOString(),
    client: clients[i % clients.length]!,
    home,
    area,
    service: services[i % services.length]!,
    tab: i % 9 === 8 ? "cancelled" : "upcoming",
    staffed: i % 5 !== 0,
  };
});

const jobTabs = ["upcoming", "past", "cancelled"] as const;
const jobLabels = {
  upcoming: "Upcoming",
  past: "Past",
  cancelled: "Cancelled",
};

// the Office's Jobs: a Table from md, by month, searched across every Tab
function OfficeJobs({ start = "" }: { start?: string }) {
  const [tab, setTab] = useState<string>("upcoming");
  const [query, setQuery] = useState(start);
  const q = query.toLowerCase();
  const items = query
    ? jobs.filter((j) => `${j.client} ${j.home}`.toLowerCase().includes(q))
    : jobs.filter((j) => j.tab === tab);
  const row = (j: Job): ListRow => ({
    id: j.id,
    at: j.at,
    title: j.client,
    description: `${j.home} · ${j.service}`,
    status: {
      badge:
        j.tab === "cancelled" ? (
          <StatusBadge tone="neutral">Cancelled</StatusBadge>
        ) : j.staffed ? (
          <StatusBadge tone="info">Staffed</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Needs cleaners</StatusBadge>
        ),
      plain: j.tab === "cancelled" || j.staffed,
    },
    onOpen: () => {},
  });
  const columns: ListColumn<Job>[] = [
    {
      id: "when",
      label: "When",
      cell: (j) =>
        new Date(j.at).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        }),
    },
    { id: "client", label: "Client", cell: (j) => j.client },
    { id: "home", label: "Home", cell: (j) => j.home },
    { id: "service", label: "Service", from: "lg", cell: (j) => j.service },
  ];
  return (
    <ListPage
      title="Jobs"
      tabs={jobTabs.map((id) => ({
        id,
        label: jobLabels[id],
        count: jobs.filter((j) => j.tab === id).length,
        none: `No ${jobLabels[id].toLowerCase()} jobs.`,
      }))}
      tab={tab}
      onTabChange={setTab}
      search={{
        label: "Search jobs",
        placeholder: "Client or address",
        query,
        onSearch: setQuery,
        found: items.length,
      }}
      items={items}
      row={row}
      columns={columns}
      empty={{ icon: BrushCleaning, title: "No jobs yet" }}
    />
  );
}

type Member = { id: string; name: string; roles: string; active: boolean };
const staff: Member[] = [
  { id: "1", name: "Ana Ruiz", roles: "Cleaner", active: true },
  { id: "2", name: "Jennifer Ortiz", roles: "Office", active: true },
  { id: "3", name: "Luz Mejia", roles: "Cleaner", active: true },
  { id: "4", name: "Beto Sanz", roles: "Cleaner", active: false },
];

// a short list: rows at every width, a primary that opens a dialog
function ShortList({ members }: { members: Member[] }) {
  const [tab, setTab] = useState<string>("active");
  return (
    <ListPage
      title="Staff"
      primary={{
        label: "Invite staff",
        icon: UserPlus,
        dialog: (state) => (
          <Dialog title="Invite staff" {...state}>
            <p>The invite form.</p>
          </Dialog>
        ),
      }}
      tabs={[
        {
          id: "active",
          label: "Active",
          count: members.filter((m) => m.active).length,
          none: "No active staff.",
        },
        {
          id: "deactivated",
          label: "Deactivated",
          count: members.filter((m) => !m.active).length,
          none: "No one deactivated.",
        },
      ]}
      tab={tab}
      onTabChange={setTab}
      items={members.filter((m) => m.active === (tab === "active"))}
      row={(m) => ({
        id: m.id,
        title: m.name,
        description: m.roles,
        start: <Avatar />,
        onOpen: () => {},
      })}
      empty={{ icon: Layers, title: "No staff yet" }}
    />
  );
}

type Clean = { id: string; at: string; service: string; home: string };
const cleans: Clean[] = jobs.slice(0, 6).map((j) => ({
  id: j.id,
  at: j.at,
  service: j.service,
  home: j.home,
}));

// a Client's or a Cleaner's dated list: rows, by month, no search
function DatedList({
  who,
  items,
}: {
  who: "client" | "cleaner";
  items: Clean[];
}) {
  const [tab, setTab] = useState<string>("upcoming");
  return (
    <ListPage
      title={who === "client" ? "Cleans" : "Offers"}
      tabs={[
        {
          id: "upcoming",
          label: who === "client" ? "Upcoming" : "Offered to you",
          count: items.length,
          none: "Nothing booked.",
        },
        {
          id: "past",
          label: who === "client" ? "Past" : "Open to you",
          count: 0,
          none: "None yet.",
        },
      ]}
      tab={tab}
      onTabChange={setTab}
      items={tab === "upcoming" ? items : []}
      row={(c) => ({
        id: c.id,
        at: c.at,
        title:
          who === "client" ? c.service : homes.find(([h]) => h === c.home)![1]!,
        description: who === "client" ? c.home : c.service,
        onOpen: () => {},
      })}
      empty={{
        icon: FilePlus,
        title:
          who === "client" ? "No cleans yet" : "Nothing open to you right now",
      }}
    />
  );
}

const meta = {
  title: "Layout/ListPage",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// An Office work list: Tabs with counts, no All; a search that looks
// through every Tab; by month; 50, then Show more; the status only where
// it isn't usual (Needs cleaners)
export const OfficeWorkList: Story = {
  render: () => <OfficeJobs />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: /Upcoming/ })).toBeVisible();
    await expect(canvas.queryByRole("tab", { name: /All/ })).toBeNull();
    await expect(canvas.getAllByText("Needs cleaners").length).toBeGreaterThan(
      0,
    );
    await expect(canvas.queryByText("Staffed")).toBeNull();
    await expect(
      canvas.getByRole("button", { name: /Show more \(\d+ left\)/ }),
    ).toBeVisible();
  },
};

export const OfficeWorkListOnAPhone: Story = {
  ...OfficeWorkList,
  globals: { viewport: { value: "phone" } },
};

// a search across the Tabs: they step aside for how many it found, and
// every row says where it stands
export const Searching: Story = {
  render: () => <OfficeJobs start="Chloe" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/found in every tab/)).toBeVisible();
    await expect(canvas.queryByRole("tab")).toBeNull();
    await expect(canvas.getAllByText("Staffed").length).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
    await waitFor(() =>
      expect(canvas.getByRole("tab", { name: /Upcoming/ })).toBeVisible(),
    );
  },
};

export const NoMatch: Story = {
  render: () => <OfficeJobs start="Zebra" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Nothing matches “Zebra”")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Clear search" }),
    ).toBeVisible();
  },
};

// a short list, rows at every width, with its one primary
export const ShortListWithPrimary: Story = {
  render: () => <ShortList members={staff} />,
};

// with nothing in it, the empty state offers the primary
export const EmptyWithAction: Story = {
  render: () => <ShortList members={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No staff yet")).toBeVisible();
    await expect(canvas.queryByRole("tab")).toBeNull();
  },
};

// a Client's: the kind of clean leads, by month
export const ClientCleans: Story = {
  render: () => <DatedList who="client" items={cleans} />,
  globals: { viewport: { value: "phone" } },
};

// a Cleaner's: the area leads
export const CleanerOffers: Story = {
  render: () => <DatedList who="cleaner" items={cleans} />,
  globals: { viewport: { value: "phone" } },
};

// with nothing in it and nothing to add, one quiet line
export const QuietEmptyLine: Story = {
  render: () => <DatedList who="cleaner" items={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Nothing open to you right now"),
    ).toBeVisible();
  },
};
