import {
  useLoaderData,
  useNavigate,
  useRouteContext,
  useSearch,
} from "@tanstack/react-router";
import {
  CalendarDays,
  CircleCheck,
  Inbox,
  Navigation,
  Phone,
} from "lucide-react";
import type { CleanerJob, CleanerSiteVisit } from "@empire-cleaning/models";
import { catalog, HOUR_MS } from "@empire-cleaning/models";
import {
  AnswerCard,
  Button,
  ButtonLink,
  buttonStyles,
  DateTile,
  HomePage,
  IconTile,
  StatusBadge,
  type ListRow,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  clientName,
  dayOfInstant,
  formatHours,
  formatMinutes,
  jobStatusTone,
} from "../format.ts";
import { AssignmentStateBadge } from "../JobBadges.tsx";
import { type Said, useSaid, useShared } from "../words.ts";

const words = catalog({
  en: {
    nothingYet: "Nothing booked for you yet",
    byKind: "Your jobs, by kind",
    seeOffers: (n: number) => (n === 1 ? "See 1 offer" : `See ${n} offers`),
    nextAt: (when: string) => `Next ${when}`,
    waiting: (n: number) => (n === 0 ? "None right now" : "Waiting on you"),
    comingUp: "Coming up",
    doneToday: "Done today",
    now: "Now",
    crewOf: (n: number) => `crew of ${n}`,
    siteVisitFor: (client: string) => `Site visit for ${client}`,
    toSeeIt: (minutes: string) => `${minutes} to see it`,
    call: (client: string) => `Call ${client}`,
  },
  es: {
    nothingYet: "Todavía no tienes nada reservado",
    byKind: "Tus trabajos, por tipo",
    seeOffers: (n: number) => (n === 1 ? "Ver 1 oferta" : `Ver ${n} ofertas`),
    nextAt: (when: string) => `Próximo: ${when}`,
    waiting: (n: number) =>
      n === 0 ? "Ninguna por ahora" : "Esperan tu respuesta",
    comingUp: "Próximos",
    doneToday: "Terminados hoy",
    now: "Ahora",
    crewOf: (n: number) => `equipo de ${n}`,
    siteVisitFor: (client: string) => `Visita previa para ${client}`,
    toSeeIt: (minutes: string) => `${minutes} para verla`,
    call: (client: string) => `Llamar a ${client}`,
  },
});

// whether the Cleaner has Confirmed it yet, or once done, how it went: a
// trabajo, so its Spanish isn't a clean's (Terminado, not Terminada)
export function CleanerJobBadge({ job }: { job: CleanerJob }) {
  const { c, jobStatusLabel } = useShared();
  if (job.outcome) {
    return (
      <StatusBadge tone={jobStatusTone[job.outcome]}>
        {job.outcome === "completed" ? c.done : jobStatusLabel[job.outcome]}
      </StatusBadge>
    );
  }
  return (
    <AssignmentStateBadge
      state={job.assignment.status === "confirmed" ? "confirmed" : "offered"}
    />
  );
}

// a map app's directions to an address
export const directionsTo = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

// "until about 12:00 PM": the start plus its time on site
export const untilAbout = (t: Said, startsAt: string, hours: number) =>
  t.c.untilAbout(
    t.formatTime(
      new Date(Date.parse(startsAt) + hours * HOUR_MS).toISOString(),
    ),
  );

// what's theirs, in time order: a Job they hold, or a Site Visit they're
// making
type Item =
  | { kind: "job"; job: CleanerJob; startsAt: string; today: boolean }
  | {
      kind: "visit";
      visit: CleanerSiteVisit;
      startsAt: string;
      today: boolean;
    };

// "Today, 2:00 PM", or "Thu, Jan 8, 9:00 AM"
const whenOf = (t: Said, item: Item) =>
  item.today
    ? `${t.today}, ${t.formatTime(item.startsAt)}`
    : t.formatDateTime(item.startsAt);

// Your jobs' tiles that open in place, as its URL names them
export const yourJobsTiles = ["coming", "done"] as const;

// The Cleaner area's first screen, a Home (docs/ux.md, Screen types), only
// what's theirs (UX pass, #96): the next Job large, its time first, with
// Directions and the way in right there; then tiles for the rest coming
// up, what they've done today, and Offers, the Jobs offered or open to them
export function CleanerHome() {
  const { today, upcoming, siteVisits, offers } = useLoaderData({
    from: "/cleaner/",
  });
  const { account } = useRouteContext({ from: "/cleaner" });
  const { open } = useSearch({ from: "/cleaner/" });
  const navigate = useNavigate();
  const t = useSaid(words);
  const { w } = t;
  const openJob = (id: string) =>
    navigate({ to: "/cleaner/jobs/$jobId", params: { jobId: id } });

  const confirmed = (job: CleanerJob) => job.assignment.status === "confirmed";
  const items: Item[] = [
    ...today.filter(confirmed).map((job) => ({
      kind: "job" as const,
      job,
      startsAt: job.startsAt,
      today: true,
    })),
    ...siteVisits.today.map((visit) => ({
      kind: "visit" as const,
      visit,
      startsAt: visit.startsAt,
      today: true,
    })),
    ...upcoming.filter(confirmed).map((job) => ({
      kind: "job" as const,
      job,
      startsAt: job.startsAt,
      today: false,
    })),
    ...siteVisits.upcoming.map((visit) => ({
      kind: "visit" as const,
      visit,
      startsAt: visit.startsAt,
      today: false,
    })),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const done = items.filter((i) => i.kind === "job" && i.job.outcome);
  const [next, ...rest] = items.filter(
    (i) => !(i.kind === "job" && i.job.outcome),
  );

  const offersHref = linkTo({ to: "/cleaner/offers" });

  return (
    <HomePage
      greet={account.name}
      answer={
        next ? (
          <NextUp item={next} openJob={openJob} />
        ) : (
          <AnswerCard
            tile={<IconTile icon={CircleCheck} tone="success" size="lg" />}
            headline={w.nothingYet}
            actions={
              offers > 0 && (
                <ButtonLink href={offersHref}>{w.seeOffers(offers)}</ButtonLink>
              )
            }
          />
        )
      }
      tilesLabel={w.byKind}
      tiles={[
        {
          id: "coming",
          icon: CalendarDays,
          label: w.comingUp,
          count: rest.length,
          hint: rest[0] && w.nextAt(whenOf(t, rest[0])),
          rows: rest.map((item) => rowOf(t, item, openJob)),
        },
        {
          id: "done",
          icon: CircleCheck,
          label: w.doneToday,
          count: done.length,
          rows: done.map((item) => rowOf(t, item, openJob)),
        },
        {
          id: "offers",
          icon: Inbox,
          label: t.c.offers,
          hint: `${offers} · ${w.waiting(offers)}`,
          href: offersHref,
        },
      ]}
      open={open}
      onOpen={(id) =>
        void navigate({
          to: "/cleaner",
          search: {
            open: yourJobsTiles.find((tile) => tile === id),
          },
          replace: true,
        })
      }
    />
  );
}

// the next thing, large: its time first, then where, with directions and
// the way in in the same place every time
function NextUp({
  item,
  openJob,
}: {
  item: Item;
  openJob: (id: string) => void;
}) {
  const job = item.kind === "job" ? item.job : null;
  const visit = item.kind === "visit" ? item.visit : null;
  const property = job?.property ?? visit!.property;
  const others = job?.crew.filter((m) => m.status === "confirmed").length ?? 0;
  const address = addressOf(property);
  const t = useSaid(words);
  const { w } = t;

  return (
    <AnswerCard
      tile={<DateTile date={item.startsAt} />}
      label={job?.started ? w.now : t.c.nextUp}
      headline={
        <span className="tabular-nums">{t.formatTime(item.startsAt)}</span>
      }
      lines={[
        `${item.today ? t.today : t.formatDay(dayOfInstant(item.startsAt))}, ${
          job
            ? untilAbout(t, job.startsAt, job.hoursOnSite)
            : untilAbout(t, visit!.startsAt, visit!.minutes / 60)
        }`,
        address,
        job
          ? [
              job.serviceName,
              t.c.hoursOnSite(formatHours(job.hoursOnSite)),
              ...(others > 1 ? [w.crewOf(others)] : []),
            ].join(" · ")
          : `${w.siteVisitFor(clientName(visit!.client))} · ${w.toSeeIt(formatMinutes(visit!.minutes))}`,
      ]}
      actions={
        <>
          <a
            className={buttonStyles({ variant: "secondary" })}
            href={directionsTo(address)}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation aria-hidden size={18} />
            {t.c.directions}
          </a>
          {job ? (
            <Button onPress={() => openJob(job.id)}>{t.c.openJob}</Button>
          ) : (
            <a
              className={buttonStyles({ variant: "primary" })}
              href={`tel:${visit!.client.phone}`}
            >
              <Phone aria-hidden size={18} />
              {w.call(clientName(visit!.client))}
            </a>
          )}
        </>
      }
    />
  );
}

// a row each (DatedItem), its day and time first, then where; a Site Visit
// has no page of its own
const rowOf = (t: Said, item: Item, openJob: (id: string) => void): ListRow =>
  item.kind === "job"
    ? {
        id: item.job.id,
        at: item.startsAt,
        title: addressOf(item.job.property),
        description: `${item.job.serviceName}, ${formatHours(item.job.hoursOnSite)}`,
        badges: [
          item.job.outcome && <CleanerJobBadge key="outcome" job={item.job} />,
        ],
        onOpen: () => openJob(item.job.id),
      }
    : {
        id: item.visit.id,
        at: item.startsAt,
        title: addressOf(item.visit.property),
        description: [
          `${clientName(item.visit.client)}, ${item.visit.client.phone}`,
          item.visit.property.accessInstructions,
        ]
          .filter(Boolean)
          .join(" · "),
        badges: [
          <StatusBadge key="visit" tone="info">
            {t.siteVisit}
          </StatusBadge>,
        ],
      };
