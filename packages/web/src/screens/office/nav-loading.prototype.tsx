// PROTOTYPE: throwaway. What shows while the next page loads? Today every
// route has a loader and the router has no pending UI, so a press seems to
// do nothing until the next page is ready. On made-up data at
// /prototype/nav-loading?case=&layout= (no sign-in): the Office's frame
// (the kit's AppLayout) over real TanStack nested routes whose loaders sleep
// for the case's time (router.tsx, navLoading*Route). ↑/↓ switch layouts,
// ←/→ cases. Hovering, focusing or pressing down on a link preloads its page
// (TanStack's "intent" preload, wired by hand: see usePreloadOnIntent).
// Lives only on prototype-nav-loading.
//
// A: a thin bar in the brand green across the top; the old page stays as it
//    is (nav too) until the new one shows.
// B: the nav and top bar move to the new section at once; the page shows
//    placeholder blocks shaped like its type (the route's pendingComponent).
// C: the bar, and the old page fades to half and is inert while loading.
//
// Every layout shows nothing for a load under 200ms, and says "Loading…"
// once, politely, to a screen reader.
import {
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouter,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
import {
  CalendarDays,
  CircleCheck,
  ContactRound,
  Clock,
  House,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Tag,
  User,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { catalog } from "@empire-cleaning/models";
import {
  AnswerCard,
  AppLayout,
  Avatar,
  Card,
  DateTile,
  DetailsCard,
  Fact,
  Facts,
  HomePage,
  IconTile,
  ListPage,
  type ListRow,
  type NavItem,
  PageHeader,
  RecordPage,
  Section,
  StatusBadge,
  useLanguage,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { reportUnexpected } from "../../monitoring.ts";
import { JobIcon, QuoteIcon } from "../icons.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";

// ---------------------------------------------------------------- the cases

const cases = [
  { key: "quick", name: "100ms: nothing should show", ms: 100 },
  { key: "typical", name: "800ms", ms: 800 },
  { key: "slow", name: "3s", ms: 3000 },
  {
    key: "preload",
    name: "3s; hover a nav item 3s first, then press: instant",
    ms: 3000,
  },
];

const layouts = [
  { key: "A", name: "Top progress bar" },
  { key: "B", name: "Skeleton in the page" },
  { key: "C", name: "Bar + dim the old page" },
];

export type NavLoadingSearch = { case?: string; layout?: string };

export const navLoadingSearch = (
  search: Record<string, unknown>,
): NavLoadingSearch => ({
  case: typeof search.case === "string" ? search.case : undefined,
  layout: typeof search.layout === "string" ? search.layout : undefined,
});

const caseOf = (search: NavLoadingSearch) =>
  cases.find((c) => c.key === search.case) ?? cases[1]!;

// how long the router waits before it shows anything, and the least time
// it shows it for once it does (no flash either side)
const PENDING_MS = 200;
const PENDING_MIN_MS = 400;

// the words a screen reader hears, once, as a load shows: the kit's in the
// build (uiWords), as AppLayout would say it
const words = catalog({
  en: { loading: "Loading…" },
  es: { loading: "Cargando…" },
});

// B lets the router swap in the page's skeleton after PENDING_MS (each
// route's pendingComponent); A and C keep the old page, so the router never
// shows one (Infinity). The router reads a route's pendingMs as each load
// starts, by which time the URL holds the layout, the first load's too
export function pendingByLayout(routes: { options: object }[]) {
  for (const route of routes) {
    Object.defineProperty(route.options, "pendingMs", {
      get: () =>
        new URLSearchParams(window.location.search).get("layout") === "B"
          ? PENDING_MS
          : Infinity,
    });
    Object.assign(route.options, { pendingMinMs: PENDING_MIN_MS });
  }
}

// ------------------------------------------------------------ the loaders

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

// a route's loader: its made-up data, after the case's delay, as a real
// getJson would be. Every log line is a loader run, a preload's or not
export const fakeLoad =
  <T,>(make: (params: Record<string, string>) => T) =>
  async ({
    location,
    params,
    cause,
    abortController,
  }: {
    location: { search: unknown; pathname: string };
    params: Record<string, string>;
    cause: string;
    abortController: AbortController;
  }) => {
    const { ms } = caseOf(location.search as NavLoadingSearch);
    console.info(`[nav-loading] load ${location.pathname} (${cause}) ${ms}ms`);
    await sleep(ms, abortController.signal);
    return make(params);
  };

// ---------------------------------------------------------- made-up data

const iso = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 10, day, hour + 5, minute)).toISOString();

type Job = {
  id: string;
  client: string;
  clientId: string;
  service: string;
  address: string;
  at: string;
  crew: string[];
  status: "booked" | "needs" | "done";
};

const clients = [
  {
    id: "c1",
    name: "Casey Morgan",
    email: "casey@example.com",
    phone: "(555) 201-3344",
    address: "14 Elm St, Springfield",
  },
  {
    id: "c2",
    name: "Priya Shah",
    email: "priya@example.com",
    phone: "(555) 482-1190",
    address: "220 Lake Ave, Apt 4B",
  },
  {
    id: "c3",
    name: "Harbor Dental",
    email: "office@harbordental.example",
    phone: "(555) 300-7781",
    address: "9 Wharf Rd, Suite 2",
  },
  {
    id: "c4",
    name: "Diego Alvarez",
    email: "diego@example.com",
    phone: "(555) 615-0042",
    address: "3 Birch Ct",
  },
  {
    id: "c5",
    name: "Ruth Okafor",
    email: "ruth@example.com",
    phone: "(555) 920-5512",
    address: "77 Hill Rd",
  },
  {
    id: "c6",
    name: "Maple Street Co-op",
    email: "board@maplecoop.example",
    phone: "(555) 118-6623",
    address: "500 Maple St",
  },
];

const services = [
  "Standard clean",
  "Deep clean",
  "Move-out clean",
  "Office clean",
];
const crews = [["Ana", "Luis"], ["Marta"], [], ["Ana"], ["Luis", "Marta"]];

const jobs: Job[] = Array.from({ length: 14 }, (_, i) => {
  const client = clients[i % clients.length]!;
  const crew = crews[i % crews.length]!;
  return {
    id: `j${i + 1}`,
    client: client.name,
    clientId: client.id,
    service: services[i % services.length]!,
    address: client.address,
    at: iso(15 + Math.floor(i / 3), 8 + (i % 3) * 3, i % 2 ? 30 : 0),
    crew,
    status: i < 3 ? "done" : crew.length === 0 ? "needs" : "booked",
  };
});

const quotes = clients.map((c, i) => ({
  id: `q${i + 1}`,
  client: c.name,
  service: services[(i + 1) % services.length]!,
  total: `$${(140 + i * 35).toFixed(2)}`,
  status: i % 3 === 0 ? "Asked" : i % 3 === 1 ? "Sent" : "Accepted",
}));

const staff = [
  { id: "s1", name: "Ana Torres", role: "Cleaner", hours: "32 h a week" },
  { id: "s2", name: "Luis Romero", role: "Cleaner", hours: "24 h a week" },
  { id: "s3", name: "Marta Diaz", role: "Cleaner", hours: "40 h a week" },
  { id: "s4", name: "Jennifer Crane", role: "Office", hours: "Owner" },
];

export const fakeData = {
  today: () => ({ jobs: jobs.filter((j) => j.at.startsWith("2026-11-15")) }),
  schedule: () => ({ jobs }),
  jobs: () => ({ jobs }),
  job: ({ jobId }: Record<string, string>) => ({
    job: jobs.find((j) => j.id === jobId) ?? jobs[0]!,
  }),
  quotes: () => ({ quotes }),
  clients: () => ({ clients }),
  client: ({ clientId }: Record<string, string>) => {
    const client = clients.find((c) => c.id === clientId) ?? clients[0]!;
    return { client, jobs: jobs.filter((j) => j.clientId === client.id) };
  },
  staff: () => ({ staff }),
};

// ------------------------------------------------------------- the frame

const base = "/prototype/nav-loading";

const nav: (NavItem & { path: string })[] = [
  {
    path: base,
    href: linkTo({ to: "/prototype/nav-loading", search: true }),
    label: "Today",
    icon: LayoutDashboard,
  },
  {
    path: `${base}/schedule`,
    href: linkTo({ to: "/prototype/nav-loading/schedule", search: true }),
    label: "Schedule",
    icon: CalendarDays,
  },
  {
    path: `${base}/jobs`,
    href: linkTo({ to: "/prototype/nav-loading/jobs", search: true }),
    label: "Jobs",
    icon: JobIcon,
    inMenu: true,
    group: "Work",
  },
  {
    path: `${base}/quotes`,
    href: linkTo({ to: "/prototype/nav-loading/quotes", search: true }),
    label: "Quotes",
    icon: QuoteIcon,
    inMenu: true,
    group: "Work",
  },
  {
    path: `${base}/clients`,
    href: linkTo({ to: "/prototype/nav-loading/clients", search: true }),
    label: "Clients",
    icon: ContactRound,
    inMenu: true,
    group: "People",
  },
  {
    path: `${base}/staff`,
    href: linkTo({ to: "/prototype/nav-loading/staff", search: true }),
    label: "Staff",
    icon: Users,
    inMenu: true,
    group: "People",
  },
];

// shows `on` only once it has held for `ms`: a quick load shows nothing
function useHeld(on: boolean, ms: number) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on) {
      setHeld(false);
      return;
    }
    const timer = setTimeout(() => setHeld(true), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);
  return held;
}

export function NavLoadingFrame() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as NavLoadingSearch;
  const layout = layouts.find((l) => l.key === search.layout)?.key ?? "A";
  const kase = caseOf(search).key;
  const lang = useLanguage();

  // a navigation under way: the router's own status, pending from the
  // press until the new page's loaders are done
  const loading = useRouterState({ select: (s) => s.status === "pending" });
  const shown = useHeld(loading, PENDING_MS);

  // which section is current: the one being opened at once in B, the one
  // on show (the resolved location) in A and C, where the old page stays
  const pending = useLocation({ select: (l) => l.pathname });
  const resolved = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  });
  const pathname = layout === "B" ? pending : resolved;
  const items = nav.map(({ path, ...item }) => ({
    ...item,
    isCurrent:
      path === base
        ? pathname === base || pathname === `${base}/`
        : pathname === path || pathname.startsWith(`${path}/`),
  }));

  const preload = usePreloadOnIntent();
  const bar = layout === "A" || layout === "C";
  const dim = layout === "C" && shown;

  return (
    <div {...preload}>
      {bar && <ProgressBar active={shown} />}
      <AppLayout
        area="Office"
        nav={items}
        foot={() => (
          <div className="flex items-center gap-3 px-3">
            <User aria-hidden size={20} className="shrink-0 text-fg-muted" />
            <div className="flex min-w-0 flex-col">
              <span className="font-semibold">Jennifer Crane</span>
              <span className="truncate text-sm text-fg-muted">
                jen@example.com
              </span>
            </div>
          </div>
        )}
      >
        <div
          inert={dim}
          className={`transition-opacity duration-200 motion-reduce:transition-none ${dim ? "opacity-50" : ""}`}
        >
          <Outlet />
        </div>
      </AppLayout>
      {/* said once as a load shows, and emptied (silently) as it ends */}
      <div role="status" className="sr-only">
        {shown ? words[lang].loading : ""}
      </div>
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(key) =>
          void navigate({
            to: ".",
            search: (s: NavLoadingSearch) => ({ ...s, layout: key }),
            replace: true,
          })
        }
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-36 md:bottom-16"
      />
      <PrototypeSwitcher
        variants={cases}
        current={kase}
        onChange={(key) =>
          void navigate({
            to: ".",
            search: (s: NavLoadingSearch) => ({ ...s, case: key }),
            replace: true,
          })
        }
      />
    </div>
  );
}

// TanStack's defaultPreload "intent" only works through its own <Link>;
// the kit's links are react-aria's, so it does nothing for them. This does
// what TanStack's Link does, for every link in the frame (the sidebar, the
// ☰ menu, which React portals but still bubbles here, crumbs, tiles):
// hover 50ms, focus, or press down, and the page's loaders start. A press
// then reuses the preload, done or still running.
function usePreloadOnIntent() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hrefOf = (e: SyntheticEvent) => {
    const href = (e.target as Element)
      .closest?.("a[href]")
      ?.getAttribute("href");
    return href?.startsWith("/") ? href : undefined;
  };
  const preload = (href: string) =>
    void router
      .preloadRoute({ href } as Parameters<typeof router.preloadRoute>[0])
      .catch(reportUnexpected);
  return {
    onPointerOver: (e: React.PointerEvent) => {
      const href = hrefOf(e);
      if (!href || e.pointerType === "touch") return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => preload(href), 50);
    },
    onPointerOut: (e: React.PointerEvent) => {
      if (hrefOf(e)) clearTimeout(timer.current);
    },
    onFocus: (e: React.FocusEvent) => {
      const href = hrefOf(e);
      if (href) preload(href);
    },
    onPointerDown: (e: React.PointerEvent) => {
      const href = hrefOf(e);
      if (href) preload(href);
    },
  };
}

// A thin brand-green bar across the very top: it creeps towards the end
// while the page loads, runs to the end as it shows, then fades. With
// reduced motion it's a still bar, there or not
function ProgressBar({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<"idle" | "start" | "grow" | "done">(
    "idle",
  );
  useEffect(() => {
    if (active) {
      setPhase("start");
      const t = setTimeout(() => setPhase("grow"), 20);
      return () => clearTimeout(t);
    }
    setPhase((p) => (p === "idle" ? "idle" : "done"));
  }, [active]);
  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => setPhase("idle"), 450);
    return () => clearTimeout(t);
  }, [phase]);
  if (phase === "idle") return null;
  const style =
    phase === "start"
      ? { width: "0%", transition: "none" }
      : phase === "grow"
        ? {
            width: "85%",
            transition: "width 8s cubic-bezier(0.08, 0.7, 0.2, 1)",
          }
        : {
            width: "100%",
            opacity: 0,
            transition: "width 150ms ease-out, opacity 250ms 150ms",
          };
  return (
    <div
      aria-hidden
      data-testid="progress-bar"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]"
    >
      <div
        className="h-full bg-primary motion-reduce:!w-full motion-reduce:!transition-none"
        style={style}
      />
    </div>
  );
}

// ------------------------------------------------------------ skeletons

// one placeholder block: shimmering, unless motion is reduced
function Bone({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block rounded-md bg-neutral-subtle motion-safe:animate-pulse ${className}`}
    />
  );
}

function SkeletonRows({ count, dated }: { count: number; dated?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <Bone
            className={dated ? "size-10 rounded-md" : "size-10 rounded-full"}
          />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className={`h-4 ${i % 2 ? "w-1/2" : "w-2/3"}`} />
            <Bone className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// a List's: its title (known before its data), the Tabs' line, rows
export function ListSkeleton({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4" data-testid="skeleton">
      <PageHeader title={title} inBar />
      <div className="flex gap-4 border-b border-border pb-2">
        <Bone className="h-6 w-20" />
        <Bone className="h-6 w-24" />
        <Bone className="h-6 w-16" />
      </div>
      <SkeletonRows count={6} />
    </div>
  );
}

// a Record's: the crumbs, its title, the details card's lead and facts,
// a part below
export function RecordSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="skeleton">
      <div className="flex flex-col gap-4">
        <Bone className="h-4 w-40" />
        <Bone className="h-9 w-64 max-w-full" />
      </div>
      <Card>
        <div className="flex items-center gap-4">
          <Bone className="size-14 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="h-3 w-24" />
            <Bone className="h-6 w-1/2" />
            <Bone className="h-4 w-1/3" />
          </div>
        </div>
        <div className="grid gap-x-6 gap-y-4 border-t border-border pt-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Bone className="size-5" />
              <div className="flex flex-1 flex-col gap-2">
                <Bone className="h-4 w-3/4" />
                <Bone className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <SkeletonRows count={2} dated />
    </div>
  );
}

// a Home's: the greeting, its answer card, the tiles
export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="skeleton">
      <Bone className="h-9 w-48" />
      <Card>
        <div className="flex items-center gap-6">
          <Bone className="size-20 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="h-4 w-24" />
            <Bone className="h-8 w-1/2" />
            <Bone className="h-4 w-1/3" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Bone key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// a Calendar's: its title, a week of days
export function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-4" data-testid="skeleton">
      <PageHeader title="Schedule" inBar />
      <Bone className="h-10 w-64 max-w-full" />
      <div className="grid gap-3 md:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Bone className="h-5 w-12" />
            <Bone className="h-16 rounded-lg" />
            {i % 2 === 0 && <Bone className="h-16 rounded-lg" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- the pages

const toJob = (id: string) =>
  ({
    to: "/prototype/nav-loading/jobs/$jobId",
    params: { jobId: id },
    search: true,
  }) as const;
const toClient = (id: string) =>
  ({
    to: "/prototype/nav-loading/clients/$clientId",
    params: { clientId: id },
    search: true,
  }) as const;

const statusOf = (job: Job) =>
  job.status === "done" ? (
    <StatusBadge tone="neutral">Done</StatusBadge>
  ) : job.status === "needs" ? (
    <StatusBadge tone="warning">Needs cleaners</StatusBadge>
  ) : (
    <StatusBadge tone="success">Staffed</StatusBadge>
  );

const jobRow = (job: Job, open: () => void): ListRow => ({
  id: job.id,
  at: job.at,
  title: job.client,
  description: [job.service, job.address, job.crew.join(", ")]
    .filter(Boolean)
    .join(" · "),
  status: { badge: statusOf(job), plain: job.status === "booked" },
  onOpen: open,
});

export function TodayPage() {
  const { jobs: today } = useLoaderData({ strict: false }) as ReturnType<
    typeof fakeData.today
  >;
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const first = today.find((j) => j.status === "needs");
  return (
    <HomePage
      greet="Jennifer Crane"
      answer={
        first ? (
          <AnswerCard
            tile={<IconTile icon={JobIcon} tone="warning" size="lg" />}
            label="First up"
            headline={first.client}
            lines={[`${first.service} needs cleaners`]}
          />
        ) : (
          <AnswerCard
            tile={<IconTile icon={CircleCheck} tone="success" size="lg" />}
            headline="Nothing needs you"
          />
        )
      }
      tilesLabel="Today at a glance"
      open={open}
      onOpen={setOpen}
      tiles={[
        {
          id: "today",
          icon: CalendarDays,
          label: "On today",
          count: today.length,
          rows: today.map((j) => jobRow(j, () => void navigate(toJob(j.id)))),
        },
        {
          id: "jobs",
          icon: JobIcon,
          label: "Jobs",
          hint: `${jobs.length} booked`,
          href: linkTo({ to: "/prototype/nav-loading/jobs", search: true }),
        },
        {
          id: "clients",
          icon: ContactRound,
          label: "Clients",
          hint: `${clients.length} clients`,
          href: linkTo({ to: "/prototype/nav-loading/clients", search: true }),
        },
      ]}
    />
  );
}

export function SchedulePage() {
  const { jobs: all } = useLoaderData({ strict: false }) as ReturnType<
    typeof fakeData.schedule
  >;
  const navigate = useNavigate();
  const days = Array.from({ length: 7 }, (_, i) => iso(15 + i, 0));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Schedule" inBar />
      <p className="text-lg font-semibold">Nov 15 – 21, 2026</p>
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((day) => {
          const on = all.filter((j) => j.at.slice(0, 10) === day.slice(0, 10));
          return (
            <section key={day} className="flex flex-col gap-2">
              <DateTile date={day} size="sm" />
              {on.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => void navigate(toJob(j.id))}
                  className="rounded-md border border-border bg-surface p-2 text-left text-sm hover:bg-surface-sunken"
                >
                  <span className="block font-semibold">{j.client}</span>
                  <span className="block text-fg-muted">{j.service}</span>
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function JobsPage() {
  const { jobs: all } = useLoaderData({ strict: false }) as ReturnType<
    typeof fakeData.jobs
  >;
  const navigate = useNavigate();
  const [tab, setTab] = useState("upcoming");
  const upcoming = all.filter((j) => j.status !== "done");
  const done = all.filter((j) => j.status === "done");
  return (
    <ListPage
      title="Jobs"
      tabs={[
        {
          id: "upcoming",
          label: "Upcoming",
          count: upcoming.length,
          none: "None",
        },
        { id: "done", label: "Done", count: done.length, none: "None" },
      ]}
      tab={tab}
      onTabChange={setTab}
      items={tab === "done" ? done : upcoming}
      row={(j) => jobRow(j, () => void navigate(toJob(j.id)))}
      empty={{ icon: JobIcon, title: "No jobs yet" }}
    />
  );
}

export function JobPage() {
  const { job } = useLoaderData({ strict: false }) as ReturnType<
    typeof fakeData.job
  >;
  return (
    <RecordPage
      trail={[
        {
          label: "Jobs",
          href: linkTo({ to: "/prototype/nav-loading/jobs", search: true }),
        },
        { label: job.client },
      ]}
      title={job.service}
      status={statusOf(job)}
      details={
        <DetailsCard
          label="Job details"
          tile={<DateTile date={job.at} />}
          title={job.client}
          line={job.service}
        >
          <Facts>
            <Fact icon={MapPin} label="Address" value={job.address} />
            <Fact
              icon={Users}
              label="Crew"
              value={job.crew.join(", ") || "No one yet"}
            />
            <Fact icon={Clock} label="Time on site" value="3 h 30 min" />
            <Fact icon={Tag} label="Price" value="$185.00" />
          </Facts>
        </DetailsCard>
      }
    />
  );
}

export function QuotesPage() {
  const { quotes: all } = useLoaderData({ strict: false }) as ReturnType<
    typeof fakeData.quotes
  >;
  const [tab, setTab] = useState("open");
  return (
    <ListPage
      title="Quotes"
      tabs={[
        { id: "open", label: "Open", count: all.length, none: "None" },
        { id: "closed", label: "Closed", count: 0, none: "None closed" },
      ]}
      tab={tab}
      onTabChange={setTab}
      items={tab === "open" ? all : []}
      row={(q) => ({
        id: q.id,
        title: q.client,
        description: `${q.service} · ${q.total}`,
        start: <IconTile icon={QuoteIcon} />,
        status: {
          badge: <StatusBadge tone="info">{q.status}</StatusBadge>,
          plain: false,
        },
      })}
      empty={{ icon: QuoteIcon, title: "No quotes yet" }}
    />
  );
}

export function ClientsPage() {
  const { clients: all } = useLoaderData({ strict: false }) as ReturnType<
    typeof fakeData.clients
  >;
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  return (
    <ListPage
      title="Clients"
      tabs={[{ id: "all", label: "All", count: all.length, none: "None" }]}
      tab={tab}
      onTabChange={setTab}
      items={all}
      row={(c) => ({
        id: c.id,
        title: c.name,
        description: c.address,
        start: <Avatar />,
        onOpen: () => void navigate(toClient(c.id)),
      })}
      empty={{ icon: ContactRound, title: "No clients yet" }}
    />
  );
}

export function ClientPage() {
  const { client, jobs: theirs } = useLoaderData({
    strict: false,
  }) as ReturnType<typeof fakeData.client>;
  const navigate = useNavigate();
  return (
    <RecordPage
      trail={[
        {
          label: "Clients",
          href: linkTo({ to: "/prototype/nav-loading/clients", search: true }),
        },
        { label: client.name },
      ]}
      title={client.name}
      details={
        <DetailsCard label="Contact details">
          <Facts>
            <Fact icon={Mail} label="Email" value={client.email} />
            <Fact icon={Phone} label="Phone" value={client.phone} />
            <Fact icon={House} label="Home" value={client.address} />
          </Facts>
        </DetailsCard>
      }
    >
      <Section title="Jobs">
        <div className="flex flex-col gap-2">
          {theirs.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => void navigate(toJob(j.id))}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left hover:bg-surface-sunken"
            >
              <DateTile date={j.at} size="sm" />
              <span className="flex-1">
                <span className="block font-semibold">{j.service}</span>
                <span className="block text-sm text-fg-muted">{j.address}</span>
              </span>
              {statusOf(j)}
            </button>
          ))}
        </div>
      </Section>
    </RecordPage>
  );
}

export function StaffPage() {
  const { staff: all } = useLoaderData({ strict: false }) as ReturnType<
    typeof fakeData.staff
  >;
  const [tab, setTab] = useState("all");
  return (
    <ListPage
      title="Staff"
      tabs={[{ id: "all", label: "Active", count: all.length, none: "None" }]}
      tab={tab}
      onTabChange={setTab}
      items={all}
      row={(s) => ({
        id: s.id,
        title: s.name,
        description: `${s.role} · ${s.hours}`,
        start: <Avatar />,
      })}
      empty={{ icon: Sparkles, title: "No staff yet" }}
    />
  );
}
