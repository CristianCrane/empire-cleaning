// PROTOTYPE: throwaway. Four takes on the Today screen's Jobs section, on
// /office?variant=A|B|C|D. Questions: what should lead to the full Schedule
// in place of the "Schedule" link, and does a one-day Schedule (locked to
// today) say "these are today's Jobs" better than a dated list?
//   A  Current: dated list, "Schedule" link in the header
//   B  Day calendar, "Week" button with a calendar icon in the header
//   C  Day calendar, the heading itself links to the Schedule
//   D  Day agenda: a time rail with a "Now" line, a full-width link below
import type { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { Today } from "@empire-cleaning/models";
import {
  ButtonLink,
  Heading,
  Link,
  List,
  ListItem,
  Section,
} from "@empire-cleaning/ui";
import { ArrowRight, CalendarDays, ChevronRight } from "lucide-react";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { JobBadge } from "./Dashboard.tsx";
import { ScheduleCalendar } from "./ScheduleCalendar.tsx";
import { SiteVisitBadge } from "./SiteVisitParts.tsx";
import {
  addressOf,
  cleanTypeLabel,
  clientName,
  formatDay,
  formatHours,
  formatMinutes,
  formatTime,
} from "../format.ts";

const variants = [
  { key: "A", name: "Current" },
  { key: "B", name: "Day calendar, Week button" },
  { key: "C", name: "Day calendar, heading links" },
  { key: "D", name: "Day agenda, link below" },
];

type Props = { today: Today; current: ReactNode };

export function TodaySchedulePrototype({ today, current }: Props) {
  const { variant = "A" } = useSearch({ from: "/office/" });
  const navigate = useNavigate({ from: "/office/" });
  return (
    <>
      {variant === "A" && current}
      {variant === "B" && <VariantB today={today} />}
      {variant === "C" && <VariantC today={today} />}
      {variant === "D" && <VariantD today={today} />}
      <PrototypeSwitcher
        variants={variants}
        current={variant}
        onChange={(key) =>
          navigate({ search: { variant: key }, replace: true })
        }
      />
    </>
  );
}

const schedule = linkTo({ to: "/office/schedule" });
const hoursLine = (today: Today) =>
  [
    `${formatHours(today.staffHours)} available`,
    `${formatHours(today.bookedHours)} booked`,
  ].join(" · ");

// today on the Schedule's own calendar: Jobs open on click; nothing moves
// from here (dropping is a no-op in the prototype)
function DayCalendar({ today }: { today: Today }) {
  return <ScheduleCalendar days={[today]} onDrop={() => {}} />;
}

// B: a plain "Today's Schedule" header with a Week button beside it
function VariantB({ today }: { today: Today }) {
  return (
    <Section
      title="Today's Schedule"
      description={`${formatDay(today.date)} · ${hoursLine(today)}`}
      actions={
        <ButtonLink href={schedule} variant="secondary" size="sm">
          <CalendarDays aria-hidden size={16} />
          Week
        </ButtonLink>
      }
    >
      <DayCalendar today={today} />
    </Section>
  );
}

// C: the heading is the way to the Schedule, so there's no button at all
function VariantC({ today }: { today: Today }) {
  return (
    <section aria-labelledby="today-schedule" className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <Heading level={2} size={3} id="today-schedule">
          <Link
            href={schedule}
            className="inline-flex items-center gap-1 text-fg no-underline hover:underline"
          >
            Today's Schedule
            <ChevronRight aria-hidden size={20} />
          </Link>
        </Heading>
        <p className="text-sm text-fg-muted">
          {formatDay(today.date)} · {hoursLine(today)}
        </p>
      </header>
      <DayCalendar today={today} />
    </section>
  );
}

// D: the day as an agenda down a time rail, a "Now" line between what's
// done and what's next, and a full-width link to the week at the end
function VariantD({ today }: { today: Today }) {
  const navigate = useNavigate();
  const now = new Date().toISOString();
  const entries = [
    ...today.jobs.map((job) => ({
      key: `job ${job.id}`,
      at: job.startsAt,
      title: clientName(job.client),
      description: [
        addressOf(job.property),
        cleanTypeLabel[job.cleanType],
        `crew of ${job.crewSize}, ${formatHours(job.hoursOnSite)} on site`,
      ].join(" · "),
      end: <JobBadge job={job} />,
      open: () =>
        navigate({ to: "/office/jobs/$jobId", params: { jobId: job.id } }),
    })),
    ...today.siteVisits.map((visit) => ({
      key: `visit ${visit.id}`,
      at: visit.startsAt,
      title: `Site Visit · ${clientName(visit.client)}`,
      description: [
        addressOf(visit.property),
        visit.visitor?.name,
        formatMinutes(visit.minutes),
      ].join(" · "),
      end: <SiteVisitBadge status={visit.status} />,
      open: () =>
        navigate({
          to: "/office/site-visits/$visitId",
          params: { visitId: visit.id },
        }),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const nowAt = entries.findIndex((e) => e.at > now);

  const nowLine = (
    <li
      key="now"
      aria-label={`Now, ${formatTime(now)}`}
      className="flex items-center gap-3 py-1"
    >
      <span className="w-16 shrink-0 text-right text-xs font-semibold text-danger-strong">
        Now
      </span>
      <span className="h-0.5 flex-1 rounded-full bg-danger" />
    </li>
  );

  return (
    <Section
      title="Today's Jobs"
      description={`${formatDay(today.date)} · ${hoursLine(today)}`}
    >
      {entries.length === 0 ? (
        <p className="text-sm text-fg-muted">No Jobs today.</p>
      ) : (
        <ol className="flex flex-col">
          {entries.flatMap((entry, i) => [
            ...(i === nowAt ? [nowLine] : []),
            <li key={entry.key} className="flex gap-3">
              <span className="w-16 shrink-0 pt-3 text-right text-sm font-semibold tabular-nums">
                {formatTime(entry.at)}
              </span>
              <div className="flex-1 border-s-2 border-border ps-3 pb-2">
                <List aria-label={entry.title} onAction={entry.open}>
                  <ListItem
                    id={entry.key}
                    title={entry.title}
                    description={entry.description}
                    end={entry.end}
                  />
                </List>
              </div>
            </li>,
          ])}
          {nowAt === -1 && nowLine}
        </ol>
      )}
      <Link
        href={schedule}
        className="flex min-h-touch items-center justify-center gap-2 rounded-lg border border-border font-semibold no-underline hover:bg-surface-sunken"
      >
        See the rest of the week
        <ArrowRight aria-hidden size={18} />
      </Link>
    </Section>
  );
}
