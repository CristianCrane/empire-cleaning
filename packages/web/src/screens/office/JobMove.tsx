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
  dayOfInstant,
  formatClock,
  formatDateTime,
  formatDay,
  formatHours,
  timeOfDay,
} from "../format.ts";
import { useJobAction } from "./JobCompletion.tsx";

// whether the day a Job would move to has room for it, counting held hours:
// "own" on its own day, which always has; undefined while it's checked
const useRoom = (job: ScheduledJob, date: string | null) => {
  const own = date === dayOfInstant(job.startsAt);
  const [capacity, setCapacity] = useState<DayCapacity>();

  useEffect(() => {
    if (!date || own) return;
    let current = true;
    getJson<DayCapacity>(
      `/api/schedule/capacity?date=${date}&labourHours=${job.labourHours}`,
    )
      .then((found) => current && setCapacity(found))
      // moving checks again, and says why if it can't
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [date, own, job.labourHours]);

  if (own) return "own";
  return capacity?.date === date ? capacity : undefined;
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
  const room = useRoom(job, to.date ?? null);
  const unchanged =
    to.date === dayOfInstant(job.startsAt) &&
    to.time === timeOfDay(job.startsAt);
  const chosen = to.date && to.time;
  const fits = room === "own" || room?.hasRoom === true;

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
        <dd>{job.client.name}</dd>
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
      {room && room !== "own" && !room.hasRoom && (
        <Notice tone="danger">
          {formatDay(room.date)} doesn't have room: this Job needs{" "}
          {formatHours(job.labourHours)} and{" "}
          {formatHours(Math.max(room.freeHours, 0))}{" "}
          {room.freeHours === 1 ? "is" : "are"} free.
        </Notice>
      )}
      {room && room !== "own" && room.hasRoom && (
        <p className="text-sm text-fg-muted">
          {formatDay(room.date)} has {formatHours(room.freeHours)} free; this
          Job needs {formatHours(job.labourHours)}.
        </p>
      )}
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
