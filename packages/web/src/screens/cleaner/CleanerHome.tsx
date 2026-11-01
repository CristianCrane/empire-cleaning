import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Navigation, Phone } from "lucide-react";
import type { CleanerJob, CleanerSiteVisit } from "@empire-cleaning/models";
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
  formatDateTime,
  formatDay,
  formatHours,
  formatMinutes,
  formatTime,
} from "../format.ts";

// whether the Cleaner has taken their place yet, or once done, that it is
export function PlaceBadge({ job }: { job: CleanerJob }) {
  if (job.outcome === "completed") {
    return <StatusBadge tone="success">Completed</StatusBadge>;
  }
  if (job.outcome === "no_access") {
    return <StatusBadge tone="danger">No Access</StatusBadge>;
  }
  return job.assignment.status === "confirmed" ? (
    <StatusBadge tone="success">Confirmed</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Offered</StatusBadge>
  );
}

// a map app's directions to an address
export const directionsTo = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

// "until about 12:00 PM": the start plus its time on site
export const untilAbout = (startsAt: string, hours: number) =>
  `until about ${formatTime(new Date(Date.parse(startsAt) + hours * 3_600_000).toISOString())}`;

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
const whenOf = (item: Item) =>
  item.today
    ? `Today, ${formatTime(item.startsAt)}`
    : formatDateTime(item.startsAt);

// The Cleaner area's first screen, only what's theirs (UX pass, #96): the
// next Job large, its time first, with Directions and the way in right
// there; then the rest coming up, and what they've done today. Places
// offered or open to them are under Offers.
export function CleanerHome() {
  const { today, upcoming, siteVisits } = useLoaderData({ from: "/cleaner/" });
  const navigate = useNavigate();
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
        Your Jobs
      </Heading>
      {next ? (
        <NextUp item={next} openJob={openJob} />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="Nothing booked for you yet"
          description="Jobs you're on show here, the next one first. Places you can take are under Offers."
        />
      )}
      {rest.length > 0 && (
        <Section title="Coming up">
          <Rows label="Coming up" items={rest} openJob={openJob} />
        </Section>
      )}
      {done.length > 0 && (
        <Section title="Done today">
          <Rows label="Done today" items={done} openJob={openJob} />
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

  return (
    <Section title={job?.started ? "Now" : "Next up"}>
      <Card>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <DateTile date={item.startsAt} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-3xl font-semibold text-fg tabular-nums">
              {formatTime(item.startsAt)}
            </p>
            <p className="text-sm text-fg-muted">
              {item.today ? "Today" : formatDay(dayOfInstant(item.startsAt))},{" "}
              {job
                ? untilAbout(job.startsAt, job.hoursOnSite)
                : untilAbout(visit!.startsAt, visit!.minutes / 60)}
            </p>
            <p className="mt-2 text-lg font-semibold text-fg [overflow-wrap:anywhere]">
              {address}
            </p>
            <p className="text-fg-muted">
              {job
                ? `${job.serviceName} · ${formatHours(job.hoursOnSite)} on site${
                    others > 1 ? ` · crew of ${others}` : ""
                  }`
                : `Site Visit for ${clientName(visit!.client)} · ${formatMinutes(visit!.minutes)} to see it`}
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
              Directions
            </a>
            {job ? (
              <Button onPress={() => openJob(job.id)}>Open Job</Button>
            ) : (
              <a
                className={buttonStyles({ variant: "primary" })}
                href={`tel:${visit!.client.phone}`}
              >
                <Phone aria-hidden size={18} />
                Call {clientName(visit!.client)}
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
            title={whenOf(item)}
            description={`${addressOf(item.job.property)} · ${item.job.serviceName}, ${formatHours(item.job.hoursOnSite)}`}
            end={item.job.outcome ? <PlaceBadge job={item.job} /> : undefined}
          />
        ) : (
          <ListItem
            key={item.visit.id}
            id={item.visit.id}
            start={<DateTile date={item.startsAt} size="sm" />}
            title={whenOf(item)}
            description={[
              addressOf(item.visit.property),
              `${clientName(item.visit.client)}, ${item.visit.client.phone}`,
              item.visit.property.accessInstructions,
            ]
              .filter(Boolean)
              .join(" · ")}
            end={<StatusBadge tone="info">Site Visit</StatusBadge>}
          />
        ),
      )}
    </List>
  );
}
