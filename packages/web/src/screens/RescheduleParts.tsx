import {
  useEffect,
  useState,
  type ComponentType,
  type ReactElement,
} from "react";
import type {
  RescheduleCost,
  RescheduleTerms,
  RescheduleTimes,
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
import { useAction } from "./action.ts";
import type { TimePickerProps } from "./CalendarGrid.tsx";
import {
  dayOfInstant,
  formatClock,
  formatDay,
  formatMoney,
  timeOfDay,
} from "./format.ts";

// What moving a Job costs, the same rules for the Office and its Client
// (ADR-0010), told to the Client. A plan Job has no Deposit of its own: its
// fee is the plan's Deposit amount, charged with the price.
export const costForClient = (
  cost: RescheduleCost,
  feeCents: number,
  onPlan = false,
) => {
  switch (cost) {
    case "free":
      return "There's no charge for moving it.";
    case "free_late":
      return onPlan
        ? "It's less than 24 hours until your clean, so this is a Late Reschedule. Your first one is free."
        : "It's less than 24 hours until your clean, so this is a Late Reschedule. Your first one is free, and your Deposit still counts towards the price.";
    case "late_cancellation":
      return feeCents === 0
        ? onPlan
          ? "It's less than 24 hours until your clean. An earlier Late Reschedule already made the fee due, so moving it costs nothing more."
          : "It's less than 24 hours until your clean. Your Deposit was already kept as the fee for an earlier Late Reschedule, so moving it costs nothing more."
        : onPlan
          ? `It's less than 24 hours until your clean and you've used your free Late Reschedule, so moving it is a Late Cancellation, with a ${formatMoney(feeCents)} fee (the same as your plan's Deposit), charged with the price when it's done.`
          : `It's less than 24 hours until your clean and you've used your free Late Reschedule, so moving it is a Late Cancellation: your ${formatMoney(feeCents)} Deposit is kept as the fee, and the full price is charged when it's done.`;
  }
};

// the same, told to Office Staff
export const costForOffice = (
  cost: RescheduleCost,
  feeCents: number,
  onPlan = false,
) => {
  switch (cost) {
    case "free":
      return "Free.";
    case "free_late":
      return onPlan
        ? "A Late Reschedule, free as this Job's first."
        : "A Late Reschedule, free as this Job's first. The Deposit still counts towards the price.";
    case "late_cancellation":
      return feeCents === 0
        ? "A Late Reschedule. An earlier one already made the fee due, so nothing more."
        : onPlan
          ? `A second Late Reschedule, so a Late Cancellation: a ${formatMoney(feeCents)} fee, the plan's Deposit amount, is charged with the price on completion.`
          : `A second Late Reschedule, so a Late Cancellation: the ${formatMoney(feeCents)} Deposit is kept as the fee and the full price is charged on completion.`;
  }
};

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
      <Dialog title="Choose a new time" size={props.size}>
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
  const [times, setTimes] = useState<RescheduleTimes>();
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(timeOfDay(job.startsAt));
  // what it costs, or the days with room, may have changed since
  const action = useAction("The request wasn't sent. Please try again.", {
    reloadOnFailure: true,
  });

  useEffect(() => {
    let current = true;
    getJson<RescheduleTimes>(`${base}/reschedule-times`)
      .then((found) => current && setTimes(found))
      .catch(
        () =>
          current &&
          action.fail("The times couldn't be loaded. Please try again."),
      );
    return () => {
      current = false;
    };
  }, [base]);

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
      action.fail("Choose a day and a start time");
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
        placeholder="Choose a day"
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
            ? "New York time. Only times with a crew free are shown."
            : "New York time. Choose a day first."
        }
        placeholder="Choose a time"
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
      {!times && !action.problem && (
        <p className="text-fg-muted">Finding times…</p>
      )}
      {times && times.days.length === 0 && (
        <Notice tone="warning">
          There's no day with room in the next few weeks. Please call the
          Office.
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
                  Or choose from a list
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
        The new time is held while the Office confirms it. Until then, the clean
        stays booked for its current time.
      </p>
      {unchanged && <Notice>That's when the clean is already booked.</Notice>}
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
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
