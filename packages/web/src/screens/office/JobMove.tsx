import { useEffect, useState } from "react";
import {
  parseDate,
  parseTime,
  type CalendarDate,
  type Time,
} from "@internationalized/date";
import type {
  DayCapacity,
  LocalDateTime,
  ScheduledJob,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  DatePicker,
  Dialog,
  DialogTrigger,
  Notice,
  TimeField,
} from "@empire-cleaning/ui";
import { getJson, postJson } from "../../api.ts";
import {
  clientName,
  dayOfInstant,
  formatClock,
  formatDateTime,
  formatDay,
  formatHours,
  formatTime,
  timeOfDay,
} from "../format.ts";
import { useJobAction } from "./JobCompletion.tsx";
import { PickFromSchedule } from "./SchedulePicker.tsx";

// whether a time a Job would move to has room for it: the hours on its day,
// counting held hours (its own day always has them), and a crew free then.
// Undefined while it's checked.
const useRoom = (job: ScheduledJob, to: Partial<LocalDateTime>) => {
  const query =
    to.date && to.time
      ? new URLSearchParams({
          date: to.date,
          time: to.time,
          labourHours: String(job.labourHours),
          crewSize: String(job.crewSize),
          jobId: job.id,
        }).toString()
      : undefined;
  const [found, setFound] = useState<{ query: string; room: DayCapacity }>();

  useEffect(() => {
    if (!query) return;
    let current = true;
    getJson<DayCapacity>(`/api/schedule/capacity?${query}`)
      .then((room) => current && setFound({ query, room }))
      // moving checks again, and says why if it can't
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [query]);

  return found && found.query === query ? found.room : undefined;
};

type MoveProps = {
  job: ScheduledJob;
  to: Partial<LocalDateTime>;
  close: () => void;
};

/**
 * The confirm step before a Job moves, so emails never go out by accident:
 * the new time, whether its day has room, and what moving does.
 */
export function ConfirmMove({ job, to, close }: MoveProps) {
  const action = useJobAction("The Job wasn't moved. Please try again.");
  const room = useRoom(job, to);
  const unchanged =
    to.date === dayOfInstant(job.startsAt) &&
    to.time === timeOfDay(job.startsAt);
  const chosen = to.date && to.time;
  const fits = room?.hasRoom === true;

  const move = async () => {
    if (
      await action.run(
        () => postJson(`/api/jobs/${job.id}/move`, to),
        "Job moved",
      )
    )
      close();
  };

  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="font-semibold">Job</dt>
        <dd>{clientName(job.client)}</dd>
        <dt className="font-semibold">From</dt>
        <dd>{formatDateTime(job.startsAt)}</dd>
        <dt className="font-semibold">To</dt>
        <dd>
          {chosen ? `${formatDay(to.date!)}, ${formatClock(to.time!)}` : "—"}
        </dd>
      </dl>
      {chosen && unchanged && (
        <p className="text-sm text-fg-muted">
          That's when it's booked. Choose a new day or start time.
        </p>
      )}
      {room && !unchanged && <RoomAt room={room} job={job} />}
      <p className="text-sm text-fg-muted">
        Every place on it is Offered afresh, so the crew each confirm the new
        time. Its reminder is reset, and the Client and the crew are emailed. It
        costs the Client nothing.
      </p>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="secondary" onPress={close}>
          Keep it
        </Button>
        <Button
          isPending={action.isPending}
          isDisabled={!chosen || unchanged || !fits}
          onPress={() => void move()}
        >
          Move Job
        </Button>
      </Actions>
    </>
  );
}

// what the time chosen has room for, or why it hasn't
function RoomAt({ room, job }: { room: DayCapacity; job: ScheduledJob }) {
  const day = formatDay(room.date);
  if (!room.hasHours) {
    return (
      <Notice tone="danger">
        {day} doesn't have room: this Job needs {formatHours(job.labourHours)}{" "}
        and {formatHours(Math.max(room.freeHours, 0))}{" "}
        {room.freeHours === 1 ? "is" : "are"} free.
      </Notice>
    );
  }
  if (!room.hasCrew) {
    const free = Math.max(room.cleaners - room.crewsBusy, 0);
    return (
      <Notice tone="danger">
        Not enough Cleaners are free at {formatTime(room.startsAt)}: this Job
        needs {job.crewSize}, and {free} of the {room.cleaners} available that
        day {free === 1 ? "is" : "are"}.
      </Notice>
    );
  }
  return (
    <p className="text-sm text-fg-muted">
      {room.date === dayOfInstant(job.startsAt)
        ? `It stays on ${day}, and a crew is free then.`
        : `${day} has ${formatHours(room.freeHours)} free; this Job needs ${formatHours(job.labourHours)}, and a crew is free then.`}
    </p>
  );
}

// Office Staff move a Job to a day and start time they choose: the Move
// action, at any width, where dragging on the Schedule isn't to hand
export function MoveJob({ job }: { job: ScheduledJob }) {
  return (
    <DialogTrigger>
      <Button variant="secondary">Move Job</Button>
      <Dialog title="Move this Job">
        {({ close }) => <ChooseTime job={job} close={close} />}
      </Dialog>
    </DialogTrigger>
  );
}

function ChooseTime({ job, close }: Omit<MoveProps, "to">) {
  const [date, setDate] = useState<CalendarDate | null>(
    parseDate(dayOfInstant(job.startsAt)),
  );
  const [time, setTime] = useState<Time | null>(
    parseTime(timeOfDay(job.startsAt)),
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker label="Day" value={date} onChange={setDate} />
        <TimeField
          label="Start time"
          description="New York time."
          value={time}
          onChange={setTime}
        />
      </div>
      <PickFromSchedule
        date={date?.toString()}
        time={time?.toString().slice(0, 5)}
        hoursOnSite={job.hoursOnSite}
        crew={{ crewSize: job.crewSize, jobId: job.id }}
        current={{
          date: dayOfInstant(job.startsAt),
          time: timeOfDay(job.startsAt),
        }}
        label="New time"
        onPick={(at) => {
          setDate(parseDate(at.date));
          setTime(parseTime(at.time));
        }}
      />
      <ConfirmMove
        job={job}
        to={{
          date: date?.toString(),
          time: time?.toString().slice(0, 5),
        }}
        close={close}
      />
    </>
  );
}
