import { ContactRound, CalendarClock, CalendarCheck } from "lucide-react";
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
  Fact,
  Facts,
  FieldRow,
  type DialogState,
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

// what moving a Job to a time can do: whether a time is chosen, whether it's
// where the Job is now, and whether its day has room (undefined while it's
// checked). One per dialog, so its room is asked for once
const useMove = (job: ScheduledJob, to: Partial<LocalDateTime>) => {
  const room = useRoom(job, to);
  const unchanged =
    to.date === dayOfInstant(job.startsAt) &&
    to.time === timeOfDay(job.startsAt);
  const chosen = !!(to.date && to.time);
  return {
    room,
    unchanged,
    chosen,
    canMove: chosen && !unchanged && room?.hasRoom === true,
  };
};

type Move = ReturnType<typeof useMove>;

/**
 * The confirm step before a Job moves, so emails never go out by accident:
 * the new time, whether its day has room, and what moving does.
 */
export function ConfirmMove({ job, to, close }: MoveProps) {
  const move = useMove(job, to);
  return (
    <>
      <MoveFacts job={job} to={to} />
      <MoveCheck job={job} move={move} />
      <MoveActions job={job} to={to} move={move} close={close} />
    </>
  );
}

// the Job, and the time it moves from and, unless fields above say it, to
function MoveFacts({ job, to }: { job: ScheduledJob; to?: MoveProps["to"] }) {
  return (
    <Facts>
      <Fact icon={ContactRound} label="Job" value={clientName(job.client)} />
      <Fact
        icon={CalendarClock}
        label="From"
        value={formatDateTime(job.startsAt)}
      />
      {to && (
        <Fact
          icon={CalendarCheck}
          label="To"
          value={
            to.date && to.time
              ? `${formatDay(to.date)}, ${formatClock(to.time)}`
              : "—"
          }
        />
      )}
    </Facts>
  );
}

// whether the time chosen is where the Job is now, or has room for it
function MoveCheck({ job, move }: { job: ScheduledJob; move: Move }) {
  if (move.chosen && move.unchanged) {
    return <p className="text-sm text-fg-muted">{SAME_TIME}</p>;
  }
  return move.room && !move.unchanged ? (
    <RoomAt room={move.room} job={job} />
  ) : null;
}

// what moving does, and the Buttons: Move job only once it can
function MoveActions({ job, to, move, close }: MoveProps & { move: Move }) {
  const action = useAction("The job wasn't moved. Please try again.");
  const moveJob = async () => {
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
          isDisabled={!move.canMove}
          onPress={() => void moveJob()}
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
}: { job: ScheduledJob } & DialogState) {
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

// the day and start time first, each with the job's own until changed, and
// under them whether it can move then: in the first view, so a greyed Move
// job says why. The week to pick from follows, then the Job and its time
// now, read before the Buttons (the fields say where it moves to)
function ChooseTime({ job, close }: Omit<MoveProps, "to">) {
  const [date, setDate] = useState<CalendarDate | null>(
    parseDate(dayOfInstant(job.startsAt)),
  );
  const [time, setTime] = useState<Time | null>(
    parseTime(timeOfDay(job.startsAt)),
  );
  const to = { date: date?.toString(), time: timeOfField(time) };
  const move = useMove(job, to);

  return (
    <>
      <FieldRow>
        <DatePicker label="Day" value={date} onChange={setDate} />
        <TimeField label="Start time" value={time} onChange={setTime} />
      </FieldRow>
      <MoveCheck job={job} move={move} />
      <PickFromSchedule
        date={to.date}
        time={to.time}
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
      <MoveFacts job={job} />
      <MoveActions job={job} to={to} move={move} close={close} />
    </>
  );
}
