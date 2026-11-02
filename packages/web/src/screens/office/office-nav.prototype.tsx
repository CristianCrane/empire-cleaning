// PROTOTYPE: throwaway. Where the Office's eight sections go on a phone, whose
// bottom tab bar fits five (#200), at /prototype/office-nav?case=&layout=
// (no sign-in). ↑/↓ switch layouts, ←/→ the page you're on; the nav itself
// works too. Lives only on prototype-office-nav.

import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  ContactRound,
  Ellipsis,
  LayoutDashboard,
  Menu,
  Sparkles,
  Tag,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Button,
  Card,
  Dialog,
  Drawer,
  DialogTrigger,
  Heading,
  Link,
  List,
  ListItem,
  Logo,
  ThemeToggle,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { JobIcon, QuoteIcon } from "../icons.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

type SectionId =
  | "today"
  | "quotes"
  | "jobs"
  | "clients"
  | "schedule"
  | "staff"
  | "services"
  | "price-list"
  | "business"
  | "more";

type Section = { id: SectionId; label: string; icon: LucideIcon };

const all: Record<Exclude<SectionId, "business" | "more">, Section> = {
  today: { id: "today", label: "Today", icon: LayoutDashboard },
  quotes: { id: "quotes", label: "Quotes", icon: QuoteIcon },
  jobs: { id: "jobs", label: "Jobs", icon: JobIcon },
  clients: { id: "clients", label: "Clients", icon: ContactRound },
  schedule: { id: "schedule", label: "Schedule", icon: CalendarDays },
  staff: { id: "staff", label: "Staff", icon: Users },
  services: { id: "services", label: "Services", icon: Sparkles },
  "price-list": { id: "price-list", label: "Price List", icon: Tag },
};
const business: Section = {
  id: "business",
  label: "Business",
  icon: Building2,
};

// what each layout puts in the tab bar, and what goes behind it
type Layout = {
  key: string;
  name: string;
  tabs: Section[];
  rest: Section[];
};

const layouts: Layout[] = [
  {
    key: "A",
    name: "More tab",
    tabs: [all.today, all.quotes, all.jobs, all.schedule],
    rest: [all.clients, all.staff, all.services, all["price-list"]],
  },
  {
    key: "B",
    name: "Top-bar menu",
    tabs: [all.today, all.quotes, all.jobs, all.clients, all.schedule],
    rest: [all.staff, all.services, all["price-list"]],
  },
  {
    key: "C",
    name: "Business page",
    tabs: [all.today, all.quotes, all.jobs, all.clients, all.schedule],
    rest: [all.staff, all.services, all["price-list"]],
  },
  {
    key: "D",
    name: "Side drawer",
    tabs: [all.today, all.schedule],
    rest: [
      all.quotes,
      all.jobs,
      all.clients,
      all.staff,
      all.services,
      all["price-list"],
    ],
  },
];

const cases: { key: SectionId; name: string }[] = [
  ...Object.values(all).map(({ id, label }) => ({ key: id, name: label })),
  { key: "business", name: "Business (C)" },
];

export function OfficeNavPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const layout = layouts.find((l) => l.key === search.layout) ?? layouts[3]!;
  const current = (cases.find((c) => c.key === search.case)?.key ??
    "today") as SectionId;
  const go = (next: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/office-nav",
      search: { case: current, layout: layout.key, ...next },
      replace: true,
    });
  const hrefFor = (id: SectionId) =>
    linkTo({
      to: "/prototype/office-nav",
      search: { case: id, layout: layout.key },
    });

  // a section behind the menu or the Business page counts as that place's
  const inRest = layout.rest.some((s) => s.id === current);
  const isCurrent = (s: Section) =>
    s.id === current ||
    (s.id === "more" && inRest) ||
    (s.id === "business" && (current === "business" || inRest));

  const tabs: (Section & { more?: true })[] =
    layout.key === "A"
      ? [
          ...layout.tabs,
          { id: "more", label: "More", icon: Ellipsis, more: true },
        ]
      : layout.key === "C"
        ? [...layout.tabs, business]
        : layout.tabs;

  const title =
    current === "business"
      ? "Business"
      : all[current as Exclude<SectionId, "business" | "more">].label;

  const restList = (close?: () => void) => (
    <List
      aria-label="More of the Office"
      onAction={(id) => {
        close?.();
        go({ case: String(id) });
      }}
    >
      {layout.rest.map((s) => (
        <ListItem
          key={s.id}
          id={s.id}
          title={s.label}
          start={<s.icon aria-hidden size={20} className="text-fg-muted" />}
        />
      ))}
    </List>
  );

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4 md:sticky md:top-0 md:flex md:h-dvh">
        <div className="flex flex-col items-center gap-3 px-2 pt-2">
          <Logo className="w-44" />
          <span className="text-sm text-fg-muted">Office</span>
        </div>
        <nav aria-label="Office" className="flex flex-1 flex-col gap-1">
          {layout.key === "A" || layout.key === "D" ? (
            Object.values(all).map((s) => (
              <SidebarLink
                key={s.id}
                s={s}
                href={hrefFor(s.id)}
                current={s.id === current}
              />
            ))
          ) : (
            <>
              {layout.tabs.map((s) => (
                <SidebarLink
                  key={s.id}
                  s={s}
                  href={hrefFor(s.id)}
                  current={s.id === current}
                />
              ))}
              <span className="mt-4 px-3 text-xs font-semibold tracking-wide text-fg-muted uppercase">
                Business
              </span>
              {layout.rest.map((s) => (
                <SidebarLink
                  key={s.id}
                  s={s}
                  href={hrefFor(s.id)}
                  current={s.id === current}
                />
              ))}
            </>
          )}
        </nav>
        <div className="flex flex-col gap-3">
          <AccountButton />
          <ThemeToggle />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 md:hidden">
        <div className="flex min-w-0 items-center gap-1">
          {layout.key === "B" && (
            <DialogTrigger>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Menu"
                className="-ml-2"
              >
                <Menu aria-hidden size={22} />
              </Button>
              <Dialog title="Business">{({ close }) => restList(close)}</Dialog>
            </DialogTrigger>
          )}
          {layout.key === "D" && (
            <DialogTrigger>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Menu"
                className="-ml-2"
              >
                <Menu aria-hidden size={22} />
              </Button>
              <Drawer aria-label="Office">
                {({ close }) => (
                  <>
                    <div className="flex flex-col items-center gap-3 px-2 pt-8">
                      <Logo className="w-44" />
                      <span className="text-sm text-fg-muted">Office</span>
                    </div>
                    <nav aria-label="Office" className="flex flex-col gap-1">
                      {layout.rest.map((s) => (
                        <SidebarLink
                          key={s.id}
                          s={s}
                          href={hrefFor(s.id)}
                          current={s.id === current}
                          onPress={close}
                        />
                      ))}
                    </nav>
                  </>
                )}
              </Drawer>
            </DialogTrigger>
          )}
          <span className="truncate font-display text-xl font-bold tracking-wide uppercase">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccountButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-4 pb-28 md:px-8 md:py-8">
        {current === "today" && layout.key !== "D" && (
          <Logo className="mx-auto mb-4 w-36 md:hidden" />
        )}
        <Heading level={1} className="mb-4 hidden md:block">
          {title}
        </Heading>
        {current === "business" ? (
          <div className="flex flex-col gap-3">
            <p className="text-fg-muted">
              Who works for you, what you offer and what it costs.
            </p>
            {restList()}
          </div>
        ) : (
          <Placeholder>
            {title} would be here. Pick another section from the nav, or ←/→.
          </Placeholder>
        )}
      </main>

      <nav
        aria-label="Office"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {tabs.map((s) =>
          s.more ? (
            <DialogTrigger key={s.id}>
              <Button
                variant="quiet"
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-none text-xs font-semibold ${inRest ? "text-primary" : "text-fg-muted"}`}
              >
                <s.icon aria-hidden size={22} />
                {s.label}
              </Button>
              <Dialog title="More">{({ close }) => restList(close)}</Dialog>
            </DialogTrigger>
          ) : (
            <TabLink
              key={s.id}
              s={s}
              href={hrefFor(s.id)}
              current={isCurrent(s)}
            />
          ),
        )}
      </nav>

      <PrototypeSwitcher
        variants={layouts.map(({ key, name }) => ({ key, name }))}
        current={layout.key}
        onChange={(key) => go({ layout: key })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-40 md:bottom-16"
      />
      <PrototypeSwitcher
        variants={cases}
        current={current}
        onChange={(key) => go({ case: key })}
      />
    </div>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <Card>
      <p className="py-16 text-center text-fg-muted">{children}</p>
    </Card>
  );
}

function AccountButton() {
  return (
    <Button variant="quiet" className="justify-start">
      <User aria-hidden size={20} />
      <span className="max-md:sr-only">Jennifer</span>
    </Button>
  );
}

type Href = ReturnType<typeof linkTo>;

function SidebarLink({
  s,
  href,
  current,
  onPress,
}: {
  s: Section;
  href: Href;
  current: boolean;
  onPress?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      onPress={onPress}
      className="flex min-h-touch items-center gap-3 rounded-md px-3 font-semibold text-fg-muted no-underline hover:bg-surface-sunken hover:text-fg current:bg-success-subtle current:text-success-strong"
    >
      <s.icon aria-hidden size={20} />
      {s.label}
    </Link>
  );
}

function TabLink({
  s,
  href,
  current,
}: {
  s: Section;
  href: Href;
  current: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-fg-muted no-underline current:text-primary"
    >
      <s.icon aria-hidden size={22} />
      {s.label}
    </Link>
  );
}
