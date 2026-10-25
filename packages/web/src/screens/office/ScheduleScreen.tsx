import { useState } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ScheduleDay } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  DatePicker,
  Form,
  Heading,
  List,
  ListItem,
  StatusBadge,
} from "@empire-cleaning/ui";
import { scheduleRange } from "./schedule-range.ts";
import {
  addDays,
  addressOf,
  cleanTypeLabel,
  formatDay,
  formatHours,
  formatTime,
} from "../format.ts";

// the booked Jobs and free Staff hours for a range of days, a week at a time
// unless Office Staff choose other dates
export function ScheduleScreen() {
  const days = useLoaderData({ from: "/office/schedule" });
  const { from, to } = scheduleRange(useSearch({ from: "/office/schedule" }));
  const navigate = useNavigate({ from: "/office/schedule" });
  const length = days.length;

  const show = (range: { from: string; to: string }) =>
    navigate({ search: range });

  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Schedule</Heading>
      <Range
        key={`${from} ${to}`}
        from={from}
        to={to}
        onShow={show}
        onMove={(by) =>
          show({
            from: addDays(from, by * length),
            to: addDays(to, by * length),
          })
        }
        length={length}
      />
      <ol className="flex flex-col gap-4" aria-label="Days">
        {days.map((day) => (
          <li key={day.date}>
            <Day day={day} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Range({
  from,
  to,
  length,
  onShow,
  onMove,
}: {
  from: string;
  to: string;
  length: number;
  onShow: (range: { from: string; to: string }) => void;
  onMove: (by: number) => void;
}) {
  const [start, setStart] = useState<CalendarDate | null>(parseDate(from));
  const [end, setEnd] = useState<CalendarDate | null>(parseDate(to));
  const span = length === 7 ? "week" : `${length} days`;

  return (
    <Card>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          if (start && end)
            onShow({ from: start.toString(), to: end.toString() });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker label="From" value={start} onChange={setStart} />
          <DatePicker
            label="To"
            value={end}
            onChange={setEnd}
            minValue={start ?? undefined}
          />
        </div>
        <Actions>
          <Button
            variant="quiet"
            aria-label={`Previous ${span}`}
            onPress={() => onMove(-1)}
          >
            <ChevronLeft aria-hidden size={18} />
            Previous
          </Button>
          <Button
            variant="quiet"
            aria-label={`Next ${span}`}
            onPress={() => onMove(1)}
          >
            Next
            <ChevronRight aria-hidden size={18} />
          </Button>
          <Button type="submit" variant="secondary">
            Show these dates
          </Button>
        </Actions>
      </Form>
    </Card>
  );
}

const capacityOf = (day: ScheduleDay) => {
  if (day.freeHours < 0)
    return <StatusBadge tone="danger">Overbooked</StatusBadge>;
  if (day.staffHours === 0) return <StatusBadge>Nobody available</StatusBadge>;
  if (day.freeHours === 0)
    return <StatusBadge tone="warning">Full</StatusBadge>;
  return null;
};

function Day({ day }: { day: ScheduleDay }) {
  return (
    <Card
      title={formatDay(day.date)}
      description={[
        `${formatHours(day.staffHours)} available`,
        `${formatHours(day.bookedHours)} booked`,
        day.freeHours < 0
          ? `${formatHours(-day.freeHours)} over`
          : `${formatHours(day.freeHours)} free`,
      ].join(" · ")}
      actions={capacityOf(day)}
    >
      {day.jobs.length > 0 ? (
        <List aria-label={`Jobs on ${formatDay(day.date)}`}>
          {day.jobs.map((job) => (
            <ListItem
              key={job.id}
              id={job.id}
              textValue={`${formatTime(job.startsAt)} ${job.client.name}`}
              title={`${formatTime(job.startsAt)} · ${job.client.name}`}
              description={[
                addressOf(job.property),
                cleanTypeLabel[job.cleanType],
                `${formatHours(job.labourHours)} Labour Hours`,
                `crew of ${job.crewSize}, ${formatHours(job.hoursOnSite)} on site`,
              ].join(" · ")}
            />
          ))}
        </List>
      ) : (
        <p className="text-sm text-fg-muted">No Jobs booked.</p>
      )}
      {day.available.length > 0 && (
        <p className="text-sm text-fg-muted">
          Available:{" "}
          {day.available
            .map((c) => `${c.name} (${formatHours(c.hours)})`)
            .join(", ")}
        </p>
      )}
    </Card>
  );
}
