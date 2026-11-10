import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Navigation, Phone } from "lucide-react";
import type { CleanerJob, CleanerSiteVisit } from "@empire-cleaning/models";
import { catalog, HOUR_MS } from "@empire-cleaning/models";
import {
  Button,
  buttonStyles,
  Card,
  DateTile,
  EmptyState,
  Heading,
  List,
  ListItem,
  Section,
  StatusBadge,
} from "@empire-cleaning/ui";
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
    nothingYetText:
      "Jobs you're on show here, the next one first. Jobs you can take are under Offers.",
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
    nothingYetText:
      "Aquí aparecen tus trabajos, el próximo primero. Los que puedes tomar están en Ofertas.",
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

// The Cleaner area's first screen, only what's theirs (UX pass, #96): the
// next Job large, its time first, with Directions and the way in right
// there; then the rest coming up, and what they've done today. Jobs
// offered or open to them are under Offers.
export function CleanerHome() {
  const { today, upcoming, siteVisits } = useLoaderData({ from: "/cleaner/" });
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

  return (
    <div className="flex flex-col gap-6">
      <Heading level={1} inBar>
        {t.c.yourJobs}
      </Heading>
      {next ? (
        <NextUp item={next} openJob={openJob} />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title={w.nothingYet}
          description={w.nothingYetText}
        />
      )}
      {rest.length > 0 && (
        <Section title={w.comingUp}>
          <Rows label={w.comingUp} items={rest} openJob={openJob} />
        </Section>
      )}
      {done.length > 0 && (
        <Section title={w.doneToday}>
          <Rows label={w.doneToday} items={done} openJob={openJob} />
        </Section>
      )}
    </div>
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
    <Section title={job?.started ? w.now : t.c.nextUp}>
      <Card>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <DateTile date={item.startsAt} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-3xl font-semibold text-fg tabular-nums">
              {t.formatTime(item.startsAt)}
            </p>
            <p className="text-sm text-fg-muted">
              {item.today ? t.today : t.formatDay(dayOfInstant(item.startsAt))},{" "}
              {job
                ? untilAbout(t, job.startsAt, job.hoursOnSite)
                : untilAbout(t, visit!.startsAt, visit!.minutes / 60)}
            </p>
            <p className="mt-2 text-lg font-semibold text-fg [overflow-wrap:anywhere]">
              {address}
            </p>
            <p className="text-fg-muted">
              {job
                ? [
                    job.serviceName,
                    t.c.hoursOnSite(formatHours(job.hoursOnSite)),
                    ...(others > 1 ? [w.crewOf(others)] : []),
                  ].join(" · ")
                : `${w.siteVisitFor(clientName(visit!.client))} · ${w.toSeeIt(formatMinutes(visit!.minutes))}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
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
          </div>
        </div>
      </Card>
    </Section>
  );
}

// a row each, its day and time first; a Site Visit has no page of its own
function Rows({
  label,
  items,
  openJob,
}: {
  label: string;
  items: Item[];
  openJob: (id: string) => void;
}) {
  const t = useSaid(words);
  const jobs = new Set(
    items.flatMap((i) => (i.kind === "job" ? [i.job.id] : [])),
  );
  return (
    <List
      aria-label={label}
      onAction={(id) => {
        if (jobs.has(String(id))) openJob(String(id));
      }}
    >
      {items.map((item) =>
        item.kind === "job" ? (
          <ListItem
            key={item.job.id}
            id={item.job.id}
            start={<DateTile date={item.startsAt} size="sm" />}
            title={whenOf(t, item)}
            description={`${addressOf(item.job.property)} · ${item.job.serviceName}, ${formatHours(item.job.hoursOnSite)}`}
            end={
              item.job.outcome ? <CleanerJobBadge job={item.job} /> : undefined
            }
          />
        ) : (
          <ListItem
            key={item.visit.id}
            id={item.visit.id}
            start={<DateTile date={item.startsAt} size="sm" />}
            title={whenOf(t, item)}
            description={[
              addressOf(item.visit.property),
              `${clientName(item.visit.client)}, ${item.visit.client.phone}`,
              item.visit.property.accessInstructions,
            ]
              .filter(Boolean)
              .join(" · ")}
            end={<StatusBadge tone="info">{t.siteVisit}</StatusBadge>}
          />
        ),
      )}
    </List>
  );
}
