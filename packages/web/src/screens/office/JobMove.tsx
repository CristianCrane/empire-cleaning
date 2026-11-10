import { useState } from "react";
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
import { whyNoRoom, formats, messages } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  DatePicker,
  Dialog,
  Notice,
  TimeField,
} from "@empire-cleaning/ui";
import { getJson, postJson } from "../../api.ts";
import { useLoaded } from "../load.ts";
import { clientName, dayOfInstant, timeOfDay, timeOfField } from "../format.ts";
import { useAction } from "../action.ts";
import { PickFromSchedule } from "./SchedulePicker.tsx";

const { SAME_TIME } = messages.en;

const { formatClock, formatDateTime, formatDay } = formats.en;

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
  // moving checks again, and says why if it can't
  return useLoaded(query, () =>
    getJson<DayCapacity>(`/api/schedule/capacity?${query}`),
  ).value;
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
  const action = useAction("The job wasn't moved. Please try again.");
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
        <p className="text-sm text-fg-muted">{SAME_TIME}</p>
      )}
      {room && !unchanged && <RoomAt room={room} job={job} />}
      <p className="text-sm text-fg-muted">
        Its cleaners are asked to confirm the new time, and we'll email them and
        the client. It's free for the client.
      </p>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={close}>
          Keep it
        </Button>
        <Button
          isPending={action.isPending}
          isDisabled={!chosen || unchanged || !fits}
          onPress={() => void move()}
        >
          Move job
        </Button>
      </Actions>
    </>
  );
}

// what the time chosen has room for, or why it hasn't
function RoomAt({ room, job }: { room: DayCapacity; job: ScheduledJob }) {
  const day = formatDay(room.date);
  if (!room.hasRoom) {
    return <Notice tone="danger">{whyNoRoom(room)}</Notice>;
  }
  return (
    <p className="text-sm text-fg-muted">
      {room.date === dayOfInstant(job.startsAt)
        ? `There's room then.`
        : `There's room on ${day} then.`}
    </p>
  );
}

// Office Staff move a Job to a day and start time they choose: the Move
// action, at any width, where dragging on the Schedule isn't to hand
export function MoveJob({
  job,
  isOpen,
  onOpenChange,
}: {
  job: ScheduledJob;
  // whether it's open, and told when it closes
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Dialog
      title="Move this job"
      size="wide"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      {({ close }) => <ChooseTime job={job} close={close} />}
    </Dialog>
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
        time={timeOfField(time)}
        hoursOnSite={job.hoursOnSite}
        crew={{
          labourHours: job.labourHours,
          crewSize: job.crewSize,
          jobId: job.id,
        }}
        current={{
          date: dayOfInstant(job.startsAt),
          time: timeOfDay(job.startsAt),
        }}
        label="New time"
        inline
        onPick={(at) => {
          setDate(parseDate(at.date));
          setTime(parseTime(at.time));
        }}
      />
      <ConfirmMove
        job={job}
        to={{
          date: date?.toString(),
          time: timeOfField(time),
        }}
        close={close}
      />
    </>
  );
}
