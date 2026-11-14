import { useState, type ComponentType } from "react";
import type {
  OfficeJob,
  RescheduleCost,
  RescheduleTerms,
  RescheduleTimes,
} from "@empire-cleaning/models";
import {
  catalog,
  formats,
  type Language,
  messages,
  moveCostForOffice,
  type MoveCost,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  Notice,
  Select,
  SelectItem,
  Fold,
} from "@empire-cleaning/ui";
import { getJson, postJson } from "../api.ts";
import { useLoaded } from "./load.ts";
import { useAction } from "./action.ts";
import type { TimePickerProps } from "./CalendarGrid.tsx";
import { dayOfInstant, timeOfDay } from "./format.ts";
import { useSaid } from "./words.ts";

// in the screen's language: the Office's English, the portal's its
// Client's (ADR-0025)
const words = catalog({
  en: {
    notSent: "The request wasn't sent. Please try again.",
    notLoaded: "The times didn't load. Please try again.",
    pickBoth: "Pick a day and a start time",
    onlyDays: "Only days with room for this clean are shown.",
    pickDay: "Pick a day",
    startTime: "Start time",
    onlyTimes: "New York time. Only times with cleaners free are shown.",
    dayFirst: "New York time. Pick a day first.",
    pickTime: "Pick a time",
    finding: "Finding times…",
    noDay: "There's no day with room in the next few weeks. Please call us.",
    moveTo: "Move it to",
    orList: "Or pick from a list",
    holdNew:
      "We'll hold the new time while we confirm it. Until then, the clean stays at its current time.",
    keep: "Keep the current time",
    send: "Send request",
  },
  es: {
    notSent: "No se envió la solicitud. Vuelva a intentarlo.",
    notLoaded: "No se cargaron las horas. Vuelva a intentarlo.",
    pickBoth: "Elija un día y una hora de inicio",
    onlyDays: "Solo se muestran los días con lugar para esta limpieza.",
    pickDay: "Elija un día",
    startTime: "Hora de inicio",
    onlyTimes:
      "Hora de Nueva York. Solo se muestran las horas con limpiadores libres.",
    dayFirst: "Hora de Nueva York. Elija primero un día.",
    pickTime: "Elija una hora",
    finding: "Buscando horas…",
    noDay:
      "No hay ningún día con lugar en las próximas semanas. Por favor, llámenos.",
    moveTo: "Reprogramarla para el",
    orList: "O elija de una lista",
    holdNew:
      "Le guardamos la nueva hora mientras la confirmamos. Hasta entonces, la limpieza sigue a su hora actual.",
    keep: "Mantener la hora actual",
    send: "Enviar solicitud",
  },
});

// what a Job's costs are told from, the Client's or the Office's view of it
export type CostedJob = Pick<OfficeJob, "servicePlanId" | "weeklyBill">;

// what moving it costs (moveCostForClient, moveCostForOffice), from the
// Client's or the Office's view of the Job
const moveCost = (
  lang: Language,
  cost: RescheduleCost,
  feeCents: number,
  job: CostedJob,
): MoveCost => ({
  cost,
  feeCents,
  fee: formats[lang].formatMoney(feeCents),
  onPlan: job.servicePlanId !== null,
  weeklyBill: job.weeklyBill !== null,
});

export const costForClient = (
  lang: Language,
  cost: RescheduleCost,
  feeCents: number,
  job: CostedJob,
) => messages[lang].moveCostForClient(moveCost(lang, cost, feeCents, job));

export const costForOffice = (
  cost: RescheduleCost,
  feeCents: number,
  job: CostedJob,
) => moveCostForOffice(moveCost("en", cost, feeCents, job));

type Props = {
  job: { id: string; startsAt: string; hoursOnSite: number };
  terms: RescheduleTerms;
  // where the Job's reschedule endpoints are: /api/jobs/mine/:id for the
  // Client, /api/jobs/:id for the Office
  base: string;
  // what the cost reads as
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
  // whether it's open, and told when it closes: it opens from a Button in
  // a DialogTrigger, or from code (a menu item)
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

// a dialog to choose a new time for a Job from those on offer, and send the
// request at the cost shown
export function ChooseNewTime(props: Props) {
  const { pickNewTime } = useSaid(words);
  return (
    <Dialog
      title={pickNewTime}
      size={props.size}
      isOpen={props.isOpen}
      onOpenChange={props.onOpenChange}
    >
      {({ close }) => <NewTimeForm {...props} close={close} />}
    </Dialog>
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
  const { w, day, dayAt, formatClock, formatDay, SAME_TIME } = useSaid(words);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(timeOfDay(job.startsAt));
  // what it costs, or the days with room, may have changed since
  const action = useAction(w.notSent, {
    reloadOnFailure: true,
  });

  const { value: times, failed } = useLoaded(base, () =>
    getJson<RescheduleTimes>(`${base}/reschedule-times`),
  );
  // Send waits for the times, so a problem is the send's or else theirs
  const problem = action.problem ?? (failed ? w.notLoaded : undefined);

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
      action.fail(w.pickBoth);
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
        label={day}
        description={w.onlyDays}
        placeholder={w.pickDay}
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
        label={w.startTime}
        description={date ? w.onlyTimes : w.dayFirst}
        placeholder={w.pickTime}
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
      {!times && !problem && <p className="text-fg-muted">{w.finding}</p>}
      {times && times.days.length === 0 && (
        <Notice tone="warning">{w.noDay}</Notice>
      )}
      {times && times.days.length > 0 && (
        <>
          {inline ? (
            <>
              {picker}
              {date && time && (
                <p>
                  {w.moveTo}{" "}
                  <strong>{dayAt(formatDay(date), formatClock(time))}</strong>
                </p>
              )}
              <Fold label={w.orList}>
                <div className="flex flex-col gap-4">{fields}</div>
              </Fold>
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
      <p className="text-sm text-fg-muted">{w.holdNew}</p>
      {unchanged && <Notice>{SAME_TIME}</Notice>}
      {problem && <Notice tone="danger">{problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={close}>
          {w.keep}
        </Button>
        <Button
          isPending={action.isPending}
          isDisabled={!times || times.days.length === 0 || unchanged}
          onPress={() => void send()}
        >
          {w.send}
        </Button>
      </Actions>
    </>
  );
}
