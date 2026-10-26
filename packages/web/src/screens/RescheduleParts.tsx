import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
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
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, getJson, postJson } from "../api.ts";
import {
  dayOfInstant,
  formatClock,
  formatDay,
  formatMoney,
  timeOfDay,
} from "./format.ts";

// what moving a Job costs, the same rules for the Office and its Client
// (ADR-0010), told to the Client
export const costForClient = (cost: RescheduleCost, feeCents: number) => {
  switch (cost) {
    case "free":
      return "There's no charge for moving it.";
    case "free_late":
      return "It's less than 24 hours until your clean, so this is a Late Reschedule. Your first one is free, and your Deposit still counts towards the price.";
    case "late_cancellation":
      return feeCents > 0
        ? `It's less than 24 hours until your clean and you've used your free Late Reschedule, so moving it is a Late Cancellation: your ${formatMoney(feeCents)} Deposit is kept as the fee, and the full price is charged when it's done.`
        : "It's less than 24 hours until your clean. Your Deposit was already kept as the fee for an earlier Late Reschedule, so moving it costs nothing more.";
  }
};

// the same, told to Office Staff
export const costForOffice = (cost: RescheduleCost, feeCents: number) => {
  switch (cost) {
    case "free":
      return "Free.";
    case "free_late":
      return "A Late Reschedule, free as this Job's first. The Deposit still counts towards the price.";
    case "late_cancellation":
      return feeCents > 0
        ? `A second Late Reschedule, so a Late Cancellation: the ${formatMoney(feeCents)} Deposit is kept as the fee and the full price is charged on completion.`
        : "A Late Reschedule. An earlier one already kept the Deposit as the fee, so nothing more.";
  }
};

type Props = {
  job: { id: string; startsAt: string };
  terms: RescheduleTerms;
  // where the Job's reschedule endpoints are: /api/jobs/mine/:id for the
  // Client, /api/jobs/:id for the Office
  base: string;
  // the trigger button's label, and what the cost reads as
  label: string;
  describeCost: (cost: RescheduleCost, feeCents: number) => string;
  done: string;
};

// a dialog to choose a new time for a Job from those on offer, and send the
// request at the cost shown
export function ChooseNewTime(props: Props) {
  return (
    <DialogTrigger>
      <Button variant="secondary">{props.label}</Button>
      <Dialog title="Choose a new time">
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
  close,
}: Props & { close: () => void }) {
  const router = useRouter();
  const [times, setTimes] = useState<RescheduleTimes>();
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(timeOfDay(job.startsAt));
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);

  useEffect(() => {
    let current = true;
    getJson<RescheduleTimes>(`${base}/reschedule-times`)
      .then((found) => current && setTimes(found))
      .catch(
        () =>
          current &&
          setProblem("The times couldn't be loaded. Please try again."),
      );
    return () => {
      current = false;
    };
  }, [base]);

  const unchanged =
    date === dayOfInstant(job.startsAt) && time === timeOfDay(job.startsAt);

  const send = async () => {
    if (!date || !time) {
      setProblem("Choose a day and a start time");
      return;
    }
    setPending(true);
    setProblem(undefined);
    try {
      await postJson(`${base}/reschedule-request`, {
        date,
        time,
        cost: terms.cost,
      });
      showToast({ tone: "success", title: done });
      close();
      await router.invalidate();
    } catch (e) {
      setProblem(
        e instanceof ApiError && e.status === 409
          ? e.message
          : "The request wasn't sent. Please try again.",
      );
      // what it costs, or the days with room, may have changed since
      await router.invalidate();
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {!times && !problem && <p className="text-fg-muted">Finding times…</p>}
      {times && times.days.length === 0 && (
        <Notice>
          There's no day with room in the next few weeks. Please call the
          Office.
        </Notice>
      )}
      {times && times.days.length > 0 && (
        <>
          <Select
            label="Day"
            description="Only days with room for this clean are shown."
            placeholder="Choose a day"
            selectedKey={date}
            onSelectionChange={(key) =>
              setDate(key === null ? null : String(key))
            }
          >
            {times.days.map((day) => (
              <SelectItem key={day} id={day} textValue={formatDay(day)}>
                {formatDay(day)}
              </SelectItem>
            ))}
          </Select>
          <Select
            label="Start time"
            description="New York time."
            selectedKey={time}
            onSelectionChange={(key) =>
              setTime(key === null ? null : String(key))
            }
          >
            {times.times.map((t) => (
              <SelectItem key={t} id={t} textValue={formatClock(t)}>
                {formatClock(t)}
              </SelectItem>
            ))}
          </Select>
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
      {problem && <Notice tone="danger">{problem}</Notice>}
      <Actions>
        <Button variant="secondary" onPress={close}>
          Keep the current time
        </Button>
        <Button
          isPending={isPending}
          isDisabled={!times || times.days.length === 0 || unchanged}
          onPress={() => void send()}
        >
          Send request
        </Button>
      </Actions>
    </>
  );
}
