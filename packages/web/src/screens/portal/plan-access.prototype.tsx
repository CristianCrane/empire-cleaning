// PROTOTYPE: throwaway. Ways to a Client's Service Plan without a nav item
// of its own, on made-up data, at /prototype/plan-access?case=1..4&layout=
// A..D (no sign-in): A–C the Cleans page, D Home's shortcuts. For the UX pass
// (#96). Lives only on prototype-portal-plan-access.
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  ChevronRight,
  House,
  KeyRound,
  Phone,
  Repeat,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  AppLayout,
  Card,
  DateTile,
  Heading,
  IconTile,
  Link,
  List,
  ListItem,
  type NavItem,
  Notice,
  ShortcutTile,
  ShortcutTiles,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

const here = linkTo({ to: "/prototype/plan-access" });

// ---- made-up data ----

type Plan = {
  id: string;
  // "Standard Clean, every week"
  name: string;
  // "Mondays at 9:00 AM"
  when: string;
  home: string;
  onHold?: boolean;
};

type AccessCase = {
  key: string;
  name: string;
  plans: Plan[];
};

const elm: Plan = {
  id: "elm",
  name: "Standard Clean, every week",
  when: "Mondays at 9:00 AM",
  home: "12 Elm St, 4B",
};

export const cases: AccessCase[] = [
  { key: "1", name: "One plan", plans: [elm] },
  {
    key: "2",
    name: "Two homes, a plan each",
    plans: [
      elm,
      {
        id: "oak",
        name: "Deep Clean, every 4 weeks",
        when: "Thursdays at 2:00 PM",
        home: "40 Oak Ave",
      },
    ],
  },
  { key: "3", name: "Plan On Hold", plans: [{ ...elm, onHold: true }] },
  { key: "4", name: "No plan: one-off cleans", plans: [] },
];

export const layouts = [
  { key: "A", name: "Cleans: a slim line per plan" },
  { key: "B", name: "Cleans: a plan row, like a list" },
  { key: "C", name: "Cleans: under the title" },
  { key: "D", name: "Home: a Your plan shortcut" },
];

const upcoming = [
  "2026-11-02T14:00:00Z",
  "2026-11-09T14:00:00Z",
  "2026-11-16T14:00:00Z",
];

// ---- the page ----

export function PlanAccessPrototype() {
  const { case: key = "1", layout = "A" } = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    navigate({
      to: "/prototype/plan-access",
      search: { case: key, layout, ...search } as never,
    });
  const c = cases.find((x) => x.key === key) ?? cases[0]!;
  const home = layout === "D";

  const nav: NavItem[] = [
    { href: here, label: "Home", icon: House, isCurrent: home },
    { href: here, label: "Cleans", icon: Sparkles, isCurrent: !home },
    { href: here, label: "Payments", icon: Wallet },
    { href: here, label: "Your details", icon: UserRound },
  ];

  return (
    <AppLayout
      area="Client portal"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Casey Client</span>}
    >
      {home ? <HomePage c={c} /> : <CleansPage c={c} layout={layout} />}
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-40 md:bottom-20"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={c.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

// "Standard Clean, every week · Mondays at 9:00 AM", with the home when
// there's more than one
const planLine = (p: Plan, homes: boolean) =>
  [p.name, p.when, homes && p.home].filter(Boolean).join(" · ");

function CleansPage({ c, layout }: { c: AccessCase; layout: string }) {
  const homes = c.plans.length > 1;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading level={1}>Your cleans</Heading>
        {/* C: the plan says itself under the title, a link to it */}
        {layout === "C" &&
          c.plans.map((p) => (
            <p key={p.id} className="text-fg-muted">
              {planLine(p, homes)}
              {p.onHold && " · On Hold"} ·{" "}
              <Link href={here}>
                {homes ? `Plan at ${p.home.split(",")[0]}` : "Your plan"}
              </Link>
            </p>
          ))}
      </div>

      {/* A: a slim, quiet line per plan above the Tabs */}
      {layout === "A" && c.plans.length > 0 && (
        <div className="flex flex-col gap-2">
          {c.plans.map((p) => (
            <a
              key={p.id}
              href="#"
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:bg-surface-sunken"
            >
              <Repeat aria-hidden size={20} className="shrink-0 text-primary" />
              <span className="min-w-0 flex-1 text-fg">
                {planLine(p, homes)}
              </span>
              {p.onHold && <StatusBadge tone="warning">On Hold</StatusBadge>}
              <span className="flex shrink-0 items-center gap-1 font-semibold text-primary">
                Your plan
                <ChevronRight aria-hidden size={18} />
              </span>
            </a>
          ))}
        </div>
      )}

      {/* B: plans as rows of their own, like any list on the page */}
      {layout === "B" && c.plans.length > 0 && (
        <section className="flex flex-col gap-2">
          <Heading level={2} size={4} className="text-fg-muted">
            {homes ? "Your Service Plans" : "Your Service Plan"}
          </Heading>
          <List aria-label="Your Service Plans" onAction={() => {}}>
            {c.plans.map((p) => (
              <ListItem
                key={p.id}
                id={p.id}
                start={<IconTile icon={Repeat} />}
                title={p.name}
                description={[p.when, homes && p.home]
                  .filter(Boolean)
                  .join(" · ")}
                end={
                  p.onHold ? (
                    <StatusBadge tone="warning">On Hold</StatusBadge>
                  ) : undefined
                }
              />
            ))}
          </List>
        </section>
      )}

      <Tabs defaultSelectedKey="upcoming">
        <TabList aria-label="Your cleans">
          <Tab id="upcoming" count={upcoming.length}>
            Upcoming
          </Tab>
          <Tab id="past" count={12}>
            Past
          </Tab>
        </TabList>
        <TabPanel id="upcoming" className="flex flex-col gap-2">
          <Heading level={2} size={4} className="text-fg-muted">
            November 2026
          </Heading>
          <List aria-label="Upcoming" onAction={() => {}}>
            {upcoming.map((at) => (
              <ListItem
                key={at}
                id={at}
                start={<DateTile date={at} size="sm" />}
                title={c.plans.length > 0 ? "Standard Clean" : "Deep Clean"}
                description="9:00 AM · about 3.75 h"
              />
            ))}
          </List>
        </TabPanel>
        <TabPanel id="past">{null}</TabPanel>
      </Tabs>
    </div>
  );
}

// D: Home, its hero and shortcuts as built, with a Your plan tile when
// there's a plan. The card left them: Payments has its own nav item now
function HomePage({ c }: { c: AccessCase }) {
  const [plan] = c.plans;
  return (
    <div className="flex flex-col gap-6">
      <Heading level={1}>Hi, Casey</Heading>
      {plan?.onHold && (
        <Notice tone="warning">
          We couldn't charge for your Oct 26 clean, so your plan is On Hold.
        </Notice>
      )}
      <Card>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <DateTile date={upcoming[0]!} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Heading level={2} size={4} className="text-fg-muted">
              Your next clean
            </Heading>
            <p className="text-2xl font-semibold text-fg sm:text-3xl">
              Mon, Nov 2, 9:00 AM
            </p>
            <p className="text-fg-muted">
              {plan
                ? "Standard Clean, part of your Service Plan"
                : "Deep Clean"}
            </p>
          </div>
        </div>
      </Card>
      <ShortcutTiles label="Shortcuts">
        <ShortcutTile
          icon={CalendarClock}
          label={plan ? "Move or skip" : "Move or cancel"}
          hint="Your Mon, Nov 2 clean"
          externalHref="#"
        />
        {plan && (
          <ShortcutTile
            icon={Repeat}
            label={c.plans.length > 1 ? "Your plans" : "Your plan"}
            hint={
              c.plans.length > 1
                ? `${c.plans.length} homes on a plan`
                : `${plan.when.replace("s at", "s,")}`
            }
            externalHref="#"
          />
        )}
        <ShortcutTile
          icon={KeyRound}
          label="How we get in"
          hint="Key under the mat"
          externalHref="#"
        />
        <ShortcutTile
          icon={Phone}
          label="Call us"
          hint="(646) 320-9076"
          externalHref="#"
        />
      </ShortcutTiles>
    </div>
  );
}
