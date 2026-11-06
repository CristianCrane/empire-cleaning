// PROTOTYPE: throwaway. First-time help on the real screens, on made-up
// data, signed out, at /prototype/onboarding?flow=client|office&case=&layout=
// (#291). ↑/↓ switch layouts, ←/→ cases. Lives only on prototype-onboarding.
//
// Layouts: A first-time Notices (and a teaching empty state), B a spotlight
// tour (driver.js), C a getting-started checklist with A's Notices on the
// screens it leads to. "Seen" is kept in the page here; the build keeps it
// on the Account (Q5).

import { useEffect, useEffectEvent, useLayoutEffect, useState } from "react";
import { useBlocker, useNavigate, useSearch } from "@tanstack/react-router";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { Circle, CircleCheck } from "lucide-react";
import type {
  ClientUpcomingJob,
  ClientView,
  NeedsAttentionItem,
  PropertyView,
  QuoteSummary,
  QuoteView,
  SignedInAccount,
} from "@empire-cleaning/models";
import {
  AppLayout,
  Button,
  Heading,
  IconTile,
  List,
  ListItem,
  Notice,
  Section,
  showToast,
  type NavItem,
} from "@empire-cleaning/ui";
import { AccountMenu, navFor } from "./AreaLayout.tsx";
import { NeedsAttention } from "./office/Dashboard.tsx";
import { HomeView } from "./portal/PortalHome.tsx";
import { OfferedQuote } from "./portal/PortalQuote.tsx";
import type { HomeData } from "./portal/whats-next.ts";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";

export type OnboardingSearch = {
  flow?: string;
  case?: string;
  layout?: string;
  screen?: string;
};

// an ISO time this many days from now, at this hour in New York (EST)
const iso = (days: number, hour = 9) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour + 5, 0, 0, 0);
  return d.toISOString();
};

// ---- made-up data ----------------------------------------------------------

const home = {
  id: "home",
  street: "12 Elm St",
  unit: "4B",
  postcode: "11375",
  accessInstructions: "",
} as PropertyView;
const at = {
  id: home.id,
  street: home.street,
  unit: home.unit,
  postcode: home.postcode,
};
const maria = { id: "maria", name: "Maria Lopez", businessName: null };
// who's signed in, for the real account menu
const mariaAccount: SignedInAccount = {
  id: "a-maria",
  email: "maria@example.com",
  name: maria.name,
  roles: ["client"],
};
const jennifer: SignedInAccount = {
  id: "a-jen",
  email: "jen@example.com",
  name: "Jennifer",
  roles: ["office_staff"],
};

const quoteSummary = {
  id: "q1",
  kind: "one_off",
  status: "sent",
  origin: "client",
  service: { key: "standard", name: "Standard Clean" },
  client: maria,
  property: home,
  homePlanId: null,
  headlineTotalCents: 39195,
  plan: null,
  proposedStartsAt: iso(5),
  sentAt: iso(-1, 15),
  expiresAt: iso(6, 23),
  drafting: false,
  siteVisit: null,
  turnDownReason: null,
  createdAt: iso(-2, 10),
} as unknown as QuoteSummary;

const quote = {
  id: "q1",
  revisionId: "r1",
  kind: "one_off",
  status: "sent",
  property: at,
  options: [
    {
      serviceKey: "deep",
      serviceName: "Deep Clean",
      recommended: true,
      labourHours: 6,
      hoursOnSite: 3,
      priceCents: 36000,
      taxCents: 3195,
      totalCents: 39195,
      depositCents: 7839,
      addOns: [],
    },
    {
      serviceKey: "standard",
      serviceName: "Standard Clean",
      recommended: false,
      labourHours: 4,
      hoursOnSite: 2,
      priceCents: 24000,
      taxCents: 2130,
      totalCents: 26130,
      depositCents: 5226,
      addOns: [],
    },
  ],
  plan: null,
  crewSize: 2,
  depositPercent: 20,
  proposedStartsAt: iso(5),
  sentAt: iso(-1, 15),
  updatedAt: null,
  expiresAt: iso(6, 23),
  declinedAt: null,
  acceptedAt: null,
  acceptedServiceKey: null,
  servicePlanId: null,
  changedPlan: false,
  changesPlan: null,
  weeklyBill: null,
  bookable: ["deep", "standard"],
} as QuoteView;

const bookedJob: ClientUpcomingJob = {
  id: "job",
  startsAt: iso(5),
  serviceName: "Deep Clean",
  crewSize: 2,
  hoursOnSite: 3,
  property: at,
  servicePlanId: null,
  movingTo: null,
};

const homeData = (booked: boolean): HomeData => ({
  client: {
    name: maria.name,
    properties: [home],
  } as unknown as ClientView,
  plans: [],
  quotes: booked ? [] : [quoteSummary],
  jobs: booked ? [bookedJob] : [],
  pastJobs: [],
  siteVisits: [],
  bills: [],
  // a first-time Client has no card saved yet
  paymentMethod: booked
    ? { label: "Visa ending 4242", savedAt: "", consentedAt: "" }
    : null,
});

const officeJob = (id: string, days: number, crew: string[]) => ({
  id,
  startsAt: iso(days, 10),
  serviceName: "Standard Clean",
  status: "booked",
  labourHours: 4,
  crewSize: 2,
  hoursOnSite: 2,
  movable: true,
  crew: crew.map((name) => ({ id: name, name })),
  assignment: crew.length === 2 ? "confirmed" : "unassigned",
});

const officeItems = [
  {
    kind: "quote_requested",
    since: iso(0, 8),
    quote: {
      ...quoteSummary,
      status: "requested",
      client: { id: "dev", name: "Dev Patel", businessName: null },
      property: { ...home, street: "88 Oak Ave", unit: null },
    },
  },
  {
    kind: "reschedule_requested",
    since: iso(0, 7),
    job: {
      ...officeJob("job-r", 3, ["Ana", "Luis"]),
      client: maria,
      property: at,
    },
    request: {
      id: "rr1",
      status: "pending",
      fromStartsAt: iso(3, 10),
      startsAt: iso(4, 13),
    },
  },
  {
    kind: "job_unassigned",
    since: iso(-1, 16),
    job: {
      ...officeJob("job-u", 1, ["Ana"]),
      client: { id: "kim", name: "Grace Kim", businessName: null },
      property: {
        id: "kim-home",
        street: "5 Bay St",
        unit: null,
        postcode: "11201",
      },
    },
  },
] as unknown as NeedsAttentionItem[];

// ---- hints and cases -------------------------------------------------------

type Flow = "client" | "office";
type Screen = "home" | "quote";

const welcome: Record<Flow, string> = {
  client: "Book, move and pay for your cleans here, no phone calls needed.",
  office: "Every request, clean and payment, and what needs you today.",
};

// each hint once; `where` finds what the tour points at
type Hint = { id: string; text: string; where?: () => Element | undefined };

const visible = (selector: string) =>
  [...document.querySelectorAll(selector)].find(
    (el) => el.getClientRects().length > 0,
  );
const headingSection = (text: string) =>
  [...document.querySelectorAll("h2, h3")]
    .find((h) => h.textContent?.trim() === text)
    ?.closest("section") ?? undefined;

const hintsFor = (flow: Flow, screen: Screen, booked: boolean): Hint[] => {
  if (flow === "office")
    return [
      { id: "welcome", text: welcome.office },
      {
        id: "rows",
        text: "Each row is something waiting on you. Open it to deal with it, and it leaves the list once it's done.",
        where: () => visible('[aria-label="Needs attention"]'),
      },
      {
        id: "tiles",
        text: "Tap Jobs, Quotes or Money to see only those.",
        where: () => visible('[aria-label="Needs attention by kind"]'),
      },
      {
        id: "schedule",
        text: "Book and move cleans and Site Visits on the Schedule.",
        where: () => visible('a[href="/office/schedule"]'),
      },
    ];
  if (screen === "quote")
    return [
      {
        id: "quote",
        text: "Pick the clean you want, then pay the Deposit to book it. The rest is charged once the clean is done.",
        where: () => headingSection("Pay and book"),
      },
    ];
  if (booked)
    return [
      {
        id: "access",
        text: "Tell the crew how to get in: gate codes, keys, pets. It's under How we get in.",
        where: () => visible('a[href="/portal/properties/home"]'),
      },
      {
        id: "move",
        text: "Need another time? Tap Move or cancel.",
        where: () =>
          [...document.querySelectorAll("main a")].find((a) =>
            a.textContent?.includes("Move or cancel"),
          ),
      },
    ];
  return [
    { id: "welcome", text: welcome.client },
    {
      id: "home-quote",
      text: "Your Quote is waiting. Open it to choose your clean and book. You pay only the Deposit today.",
      where: () => visible('main a[href="/portal/quotes/q1"]'),
    },
  ];
};

const allHints: Record<Flow, string[]> = {
  client: ["welcome", "home-quote", "quote", "access", "move"],
  office: ["welcome", "rows", "tiles", "schedule"],
};

type Case = { key: string; name: string; seen: string[]; empty?: boolean };
const casesFor = (flow: Flow): Case[] => [
  { key: "1", name: "First visit", seen: [] },
  {
    key: "2",
    name: "Back, some hints dismissed",
    seen: flow === "client" ? ["welcome", "home-quote"] : ["welcome", "tiles"],
  },
  { key: "3", name: "All dismissed", seen: allHints[flow] },
  ...(flow === "office"
    ? [
        {
          key: "4",
          name: "First visit, nothing waiting",
          seen: [],
          empty: true,
        },
      ]
    : []),
];

const layouts = [
  { key: "A", name: "First-time Notices" },
  { key: "B", name: "Spotlight tour" },
  { key: "C", name: "Getting-started checklist" },
];

// the checklist's steps: where each leads, and the hint it stands for
type Step = { id: string; title: string; to: string };
const stepsFor: Record<Flow, Step[]> = {
  client: [
    { id: "book", title: "Book your first clean", to: "/portal/quotes/q1" },
    {
      id: "access",
      title: "Tell us how to get in",
      to: "/portal/properties/home",
    },
    { id: "move", title: "See how to move a clean", to: "/portal/jobs/job" },
  ],
  office: [
    {
      id: "quote",
      title: "Send a Quote someone asked for",
      to: "/office/quotes/q1",
    },
    {
      id: "reschedule",
      title: "Answer a request for a new time",
      to: "/office/jobs/job-r",
    },
    {
      id: "assign",
      title: "Find a Cleaner for a Job",
      to: "/office/jobs/job-u",
    },
    { id: "schedule", title: "Look over the Schedule", to: "/office/schedule" },
  ],
};

// ---- the page --------------------------------------------------------------

export function OnboardingPrototype() {
  const search = useSearch({ from: "/prototype/onboarding" });
  const navigate = useNavigate();
  const flow: Flow = search.flow === "office" ? "office" : "client";
  const cases = casesFor(flow);
  const which = cases.find((c) => c.key === search.case) ?? cases[0]!;
  const layout = layouts.find((l) => l.key === search.layout) ?? layouts[0]!;
  const go = (over: Partial<OnboardingSearch>) =>
    void navigate({
      to: "/prototype/onboarding",
      search: { ...search, ...over },
    });

  return (
    <>
      {/* a fresh start for each case and layout */}
      <Prototype
        key={`${flow} ${which.key} ${layout.key}`}
        flow={flow}
        which={which}
        layout={layout.key}
        screen={search.screen === "quote" ? "quote" : "home"}
        go={go}
      />
      <PrototypeSwitcher
        variants={layouts}
        current={layout.key}
        onChange={(key) => go({ layout: key, screen: undefined })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-36 md:bottom-16"
      />
      <PrototypeSwitcher
        variants={cases}
        current={which.key}
        onChange={(key) => go({ case: key, screen: undefined })}
      />
    </>
  );
}

function Prototype({
  flow,
  which,
  layout,
  screen,
  go,
}: {
  flow: Flow;
  which: Case;
  layout: string;
  screen: Screen;
  go: (over: Partial<OnboardingSearch>) => void;
}) {
  const [seen, setSeen] = useState(() => new Set(which.seen));
  const [done, setDone] = useState(() => new Set<string>());
  const [booked, setBooked] = useState(false);
  // a returning person has put the checklist away
  const [listHidden, setListHidden] = useState(
    which.seen.length === allHints[flow].length,
  );
  const see = (...ids: string[]) => setSeen((s) => new Set([...s, ...ids]));
  const finish = (id: string) => setDone((d) => new Set([...d, id]));

  // the screens' own API calls, answered here: signed out they'd be refused
  const onAccept = useEffectEvent(() => {
    setBooked(true);
    finish("book");
    // after the "You're booked" toast
    setTimeout(() => go({ screen: undefined }), 300);
  });
  useLayoutEffect(() => {
    const real = window.fetch;
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("/api/payment-methods/form"))
        return json({ form: "test" });
      if (/\/api\/quotes\/mine\/q1\/accept/.test(url)) {
        onAccept();
        return json({ status: "accepted", quote });
      }
      if (url.includes("/api/quotes/mine/q1")) return json({});
      if (url.includes("/api/auth/sign-out")) return json({ success: true });
      return real(input, init);
    };
    return () => {
      window.fetch = real;
    };
  }, []);

  // every way off the prototype stays on it: a Quote link opens its Quote
  // screen, a checklist step is ticked, anything else is a toast
  useBlocker({
    shouldBlockFn: ({ next }) => {
      const path = next.pathname;
      if (path.startsWith("/prototype")) return false;
      const step = stepsFor[flow].find((s) => s.to === path);
      if (step && step.id !== "book") finish(step.id);
      if (path === "/portal/quotes/q1") go({ screen: "quote" });
      else
        showToast({
          tone: "info",
          title: step ? step.title : "Not in this prototype",
          description: `${path} isn't part of this prototype.`,
        });
      return true;
    },
    enableBeforeUnload: false,
  });

  const hints = hintsFor(flow, screen, booked).filter((h) => !seen.has(h.id));
  const steps = stepsFor[flow];
  const showList =
    layout === "C" && !listHidden && steps.some((s) => !done.has(s.id));

  // B: the screen's unseen hints as a tour, once it's drawn
  const tourIds = hints.map((h) => h.id).join(" ");
  useEffect(() => {
    if (layout !== "B" || !tourIds) return;
    const shown = hintsFor(flow, screen, booked).filter((h) =>
      tourIds.split(" ").includes(h.id),
    );
    let tour: ReturnType<typeof driver> | undefined;
    const timer = setTimeout(() => {
      const steps: DriveStep[] = shown.map((h) => ({
        element: h.where?.(),
        popover: {
          title: h.id === "welcome" ? "Welcome" : undefined,
          description: h.text,
        },
      }));
      tour = driver({
        steps,
        showProgress: steps.length > 1,
        popoverClass: "ec-tour",
        stagePadding: 6,
        stageRadius: 12,
        onDestroyed: () => see(...shown.map((h) => h.id)),
      });
      tour.drive();
    }, 400);
    return () => {
      clearTimeout(timer);
      tour?.destroy();
    };
    // once per screen and state; seeing them changes tourIds to ""
  }, [layout, tourIds, flow, screen, booked]);

  // A and C: each unseen hint as an info Notice, dismissed for good
  const notices =
    layout === "B" ? null : (
      <>
        {hints.map((h) => (
          <Notice
            key={h.id}
            action={
              <Button variant="text" size="sm" onPress={() => see(h.id)}>
                Got it
              </Button>
            }
          >
            {h.id === "welcome" ? <strong>{h.text}</strong> : h.text}
          </Notice>
        ))}
      </>
    );
  // C: the checklist is a home screen's help, its steps standing for that
  // screen's hints; A's Notices on the screens it leads to
  const onHome = flow === "office" || screen === "home";
  const help =
    layout === "C" && onHome
      ? showList && (
          <Checklist
            flow={flow}
            steps={steps}
            done={done}
            onHide={() => setListHidden(true)}
          />
        )
      : notices;

  const resetTips = () => {
    setSeen(new Set());
    setListHidden(false);
  };

  return (
    <>
      <TourStyles />
      <AppLayout
        area={flow === "office" ? "Office" : "Client"}
        nav={navOf(flow, screen)}
        account={
          <AccountMenu
            account={flow === "office" ? jennifer : mariaAccount}
            area={flow === "office" ? "office" : "portal"}
            more={(close) => (
              <Button
                variant="quiet"
                onPress={() => {
                  resetTips();
                  close();
                }}
              >
                Show tips again
              </Button>
            )}
          />
        }
        atHome={screen === "home"}
      >
        {flow === "office" ? (
          <div className="flex flex-col gap-8">
            <Heading level={1} inBar>
              Today
            </Heading>
            {help}
            <NeedsAttention
              items={which.empty ? [] : officeItems}
              empty={
                layout !== "B"
                  ? "Nothing needs you right now. When a Client asks for a Quote or a new time, or a Job needs a Cleaner, it shows up here."
                  : undefined
              }
            />
          </div>
        ) : screen === "quote" ? (
          <OfferedQuote quote={quote} paymentMethod={null} help={help} />
        ) : (
          <HomeView data={homeData(booked)} help={help} />
        )}
      </AppLayout>
    </>
  );
}

const navOf = (flow: Flow, screen: Screen): NavItem[] =>
  navFor[flow === "office" ? "office" : "portal"].map(
    ({ alsoCurrentFor: _, ...item }, i) => ({
      ...item,
      isCurrent: i === 0 && (flow === "office" || screen === "home"),
    }),
  );

function Checklist({
  flow,
  steps,
  done,
  onHide,
}: {
  flow: Flow;
  steps: Step[];
  done: Set<string>;
  onHide: () => void;
}) {
  const navigate = useNavigate();
  const left = steps.filter((s) => !done.has(s.id)).length;
  return (
    <Section
      title="Getting started"
      description={`${welcome[flow]} ${left} of ${steps.length} left.`}
      actions={
        <Button variant="text" size="sm" onPress={onHide}>
          Hide
        </Button>
      }
    >
      <List aria-label="Getting started">
        {steps.map((s) => (
          <ListItem
            key={s.id}
            id={s.id}
            textValue={s.title}
            title={s.title}
            start={
              done.has(s.id) ? (
                <IconTile icon={CircleCheck} tone="success" />
              ) : (
                <IconTile icon={Circle} />
              )
            }
            onAction={() => void navigate({ to: s.to as "/" })}
          />
        ))}
      </List>
    </Section>
  );
}

// driver.js's popover in our tokens, light and dark
function TourStyles() {
  return (
    <style>{`
      .driver-popover.ec-tour {
        background: var(--color-surface);
        color: var(--color-fg);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        font-family: inherit;
        max-width: 320px;
      }
      .ec-tour .driver-popover-title { font: inherit; font-weight: 600; font-size: 1.05rem; }
      .ec-tour .driver-popover-description { font: inherit; color: var(--color-fg); }
      .ec-tour .driver-popover-progress-text { color: var(--color-fg-muted); }
      .ec-tour .driver-popover-close-btn { color: var(--color-fg-muted); }
      .ec-tour .driver-popover-footer button {
        font: inherit; font-weight: 600; text-shadow: none; border-radius: 8px;
        padding: 6px 12px; background: var(--color-surface); color: var(--color-fg);
        border: 1px solid var(--color-border);
      }
      .ec-tour .driver-popover-footer .driver-popover-next-btn {
        background: var(--color-primary); color: var(--color-primary-fg); border-color: var(--color-primary);
      }
      .ec-tour .driver-popover-arrow-side-top { border-top-color: var(--color-surface); }
      .ec-tour .driver-popover-arrow-side-bottom { border-bottom-color: var(--color-surface); }
      .ec-tour .driver-popover-arrow-side-left { border-left-color: var(--color-surface); }
      .ec-tour .driver-popover-arrow-side-right { border-right-color: var(--color-surface); }
    `}</style>
  );
}
