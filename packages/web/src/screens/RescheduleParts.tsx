import { useState, type ComponentType, type ReactElement } from "react";
import type {
  OfficeJob,
  RescheduleCost,
  RescheduleTerms,
  RescheduleTimes,
} from "@empire-cleaning/models";
import {
  moveCostForClient,
  moveCostForOffice,
  SAME_TIME,
  type MoveCost,
  formats,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Notice,
  Select,
  SelectItem,
} from "@empire-cleaning/ui";
import { getJson, postJson } from "../api.ts";
import { useLoaded } from "./load.ts";
import { useAction } from "./action.ts";
import type { TimePickerProps } from "./CalendarGrid.tsx";
import { dayOfInstant, timeOfDay } from "./format.ts";

const { formatClock, formatDay, formatMoney } = formats.en;

// what a Job's costs are told from, the Client's or the Office's view of it
export type CostedJob = Pick<OfficeJob, "servicePlanId" | "weeklyBill">;

// what moving it costs (moveCostForClient, moveCostForOffice), from the
// Client's or the Office's view of the Job
const moveCost = (
  cost: RescheduleCost,
  feeCents: number,
  job: CostedJob,
): MoveCost => ({
  cost,
  feeCents,
  fee: formatMoney(feeCents),
  onPlan: job.servicePlanId !== null,
  weeklyBill: job.weeklyBill !== null,
});

export const costForClient = (
  cost: RescheduleCost,
  feeCents: number,
  job: CostedJob,
) => moveCostForClient(moveCost(cost, feeCents, job));

export const costForOffice = (
  cost: RescheduleCost,
  feeCents: number,
  job: CostedJob,
) => moveCostForOffice(moveCost(cost, feeCents, job));

type Props = {
  job: { id: string; startsAt: string; hoursOnSite: number };
  terms: RescheduleTerms;
  // where the Job's reschedule endpoints are: /api/jobs/mine/:id for the
  // Client, /api/jobs/:id for the Office
  base: string;
  // the trigger button's label, and what the cost reads as
  label: string;
  describeCost: (cost: RescheduleCost, feeCents: number) => string;
  done: string;
  // the calendar to pick from: the Schedule for the Office, open times for
  // the Client
  Picker: ComponentType<TimePickerProps>;
  // the Picker sits in the dialog itself (the Client's month), the day and
  // time fields under it as the keyboard path; otherwise it opens its own
  // (the Office's Schedule)
  inline?: boolean;
  // the dialog's width: wide for a Picker that shows the Schedule in place
  size?: "md" | "wide";
  // what opens it, e.g. an IconAction; a Button with the label otherwise
  trigger?: ReactElement;
};

// a dialog to choose a new time for a Job from those on offer, and send the
// request at the cost shown
export function ChooseNewTime(props: Props) {
  return (
    <DialogTrigger>
      {props.trigger ?? <Button variant="secondary">{props.label}</Button>}
      <Dialog title="Pick a new time" size={props.size}>
        {({ close }) => <NewTimeForm {...props} close={close} />}
      </Dialog>
    </DialogTrigger>
  );
}

function NewTimeForm({
  job,
  terms,
  base,
  describeCost,
  done,
  Picker,
  inline = false,
  close,
}: Props & { close: () => void }) {
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(timeOfDay(job.startsAt));
  // what it costs, or the days with room, may have changed since
  const action = useAction("The request wasn't sent. Please try again.", {
    reloadOnFailure: true,
  });

  const { value: times, failed } = useLoaded(base, () =>
    getJson<RescheduleTimes>(`${base}/reschedule-times`),
  );
  // Send waits for the times, so a problem is the send's or else theirs
  const problem =
    action.problem ??
    (failed ? "The times didn't load. Please try again." : undefined);

  const unchanged =
    date === dayOfInstant(job.startsAt) && time === timeOfDay(job.startsAt);
  // the start times on offer on the day chosen: each day has its own, as a
  // crew may be free at some and not others
  const timesOn = (day: string | null) =>
    times?.days.find((d) => d.date === day)?.times ?? [];
  // a day chosen keeps the start time only if it's on offer there
  const choose = (day: string | null, at = time) => {
    setDate(day);
    setTime(at && timesOn(day).includes(at) ? at : null);
  };

  const send = async () => {
    if (!date || !time) {
      action.fail("Pick a day and a start time");
      return;
    }
    const ok = await action.run(
      () =>
        postJson(`${base}/reschedule-request`, {
          date,
          time,
          cost: terms.cost,
        }),
      done,
    );
    if (ok) close();
  };

  // the day and start time as fields: the Office's way, and the Client's
  // keyboard path
  const fields = (
    <>
      <Select
        label="Day"
        description="Only days with room for this clean are shown."
        placeholder="Pick a day"
        selectedKey={date}
        onSelectionChange={(key) => choose(key === null ? null : String(key))}
      >
        {(times?.days ?? []).map(({ date: day }) => (
          <SelectItem key={day} id={day} textValue={formatDay(day)}>
            {formatDay(day)}
          </SelectItem>
        ))}
      </Select>
      <Select
        label="Start time"
        description={
          date
            ? "New York time. Only times with cleaners free are shown."
            : "New York time. Pick a day first."
        }
        placeholder="Pick a time"
        isDisabled={!date}
        selectedKey={time}
        onSelectionChange={(key) => setTime(key === null ? null : String(key))}
      >
        {timesOn(date).map((t) => (
          <SelectItem key={t} id={t} textValue={formatClock(t)}>
            {formatClock(t)}
          </SelectItem>
        ))}
      </Select>
    </>
  );
  const picker = (
    <Picker
      date={date ?? undefined}
      time={time ?? undefined}
      hoursOnSite={job.hoursOnSite}
      current={{
        date: dayOfInstant(job.startsAt),
        time: timeOfDay(job.startsAt),
      }}
      limits={times?.days}
      onPick={(at) => choose(at.date, at.time)}
    />
  );

  return (
    <>
      {!times && !problem && <p className="text-fg-muted">Finding times…</p>}
      {times && times.days.length === 0 && (
        <Notice tone="warning">
          There's no day with room in the next few weeks. Please call us.
        </Notice>
      )}
      {times && times.days.length > 0 && (
        <>
          {inline ? (
            <>
              {picker}
              {date && time && (
                <p>
                  Move it to{" "}
                  <strong>
                    {formatDay(date)} at {formatClock(time)}
                  </strong>
                </p>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-primary">
                  Or pick from a list
                </summary>
                <div className="mt-3 flex flex-col gap-4">{fields}</div>
              </details>
            </>
          ) : (
            <>
              {fields}
              {picker}
            </>
          )}
        </>
      )}
      <p>
        <strong>{describeCost(terms.cost, terms.feeCents)}</strong>
      </p>
      <p className="text-sm text-fg-muted">
        We'll hold the new time while we confirm it. Until then, the clean stays
        at its current time.
      </p>
      {unchanged && <Notice>{SAME_TIME}</Notice>}
      {problem && <Notice tone="danger">{problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={close}>
          Keep the current time
        </Button>
        <Button
          isPending={action.isPending}
          isDisabled={!times || times.days.length === 0 || unchanged}
          onPress={() => void send()}
        >
          Send request
        </Button>
      </Actions>
    </>
  );
}
