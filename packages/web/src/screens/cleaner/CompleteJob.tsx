import { useState } from "react";
import {
  type AddOnChoice,
  type CleanerJob,
  type CompletionReport,
  type Condition,
  catalog,
  oneStop,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  Section,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { useSaid } from "../words.ts";

const words = catalog({
  en: {
    notMarked: "The job wasn't marked done. Please try again.",
    fixDetails: "Some details need fixing.",
    sayHow: "Say how the home was",
    marked: "Job marked done",
    title: "Mark this job done",
    intro:
      "Tell us how it went. If anything was different from the quote, the office sorts out the price with the client.",
    howWasHome: "How was the home?",
    couldntDo: "Extras on the quote you couldn't do",
    whyNot: "Why not?",
    didMore: "Extras you did that weren't on the quote",
    whyMore: "Why? For example, the client asked",
    moreTime: "More time",
    moreHours: "More hours, all of you together",
    leaveAt0: "Leave at 0 if the clean took about as long as planned.",
    whatTookLonger: "What took longer?",
    markedAt: (time: string, by: string) =>
      `Marked done at ${time}${by}. Thank you!`,
    reported: "Reported",
    nothingDifferent: "Nothing different from the quote",
  },
  es: {
    notMarked: "El trabajo no se marcó como terminado. Vuelve a intentarlo.",
    fixDetails: "Hay que corregir algunos datos.",
    sayHow: "Di cómo estaba la casa",
    marked: "Trabajo marcado como terminado",
    title: "Marcar este trabajo como terminado",
    intro:
      "Cuéntanos cómo te fue. Si algo fue distinto de la cotización, la oficina arregla el precio con el cliente.",
    howWasHome: "¿Cómo estaba la casa?",
    couldntDo: "Adicionales de la cotización que no pudiste hacer",
    whyNot: "¿Por qué no?",
    didMore: "Adicionales que hiciste y no estaban en la cotización",
    whyMore: "¿Por qué? Por ejemplo, lo pidió el cliente",
    moreTime: "Más tiempo",
    moreHours: "Horas de más, entre todos",
    leaveAt0: "Déjalo en 0 si la limpieza tomó más o menos lo previsto.",
    whatTookLonger: "¿Qué tomó más tiempo?",
    markedAt: (time: string, by: string) =>
      oneStop(
        `Marcado como terminado a ${time.startsWith("1:") ? "la" : "las"} ${time}${by}. ¡Gracias!`,
      ),
    reported: "Lo que informaste",
    nothingDifferent: "Nada distinto de la cotización",
  },
});

// the reason given for each Add-on ticked, by its key
type Ticked = Record<string, string>;

// The Cleaner marks the Job Completed on site, with the Condition they found
// and anything different from the Quote. They never set prices: the Office
// works those out from the Price List, and asks the Client before charging
// anything extra (ADR-0009).
export function CompleteJob({ job }: { job: CleanerJob }) {
  const [condition, setCondition] = useState<Condition | null>(null);
  const [notDone, setNotDone] = useState<Ticked>({});
  const [done, setDone] = useState<Ticked>({});
  const [extraHours, setExtraHours] = useState(0);
  const [extraReason, setExtraReason] = useState("");
  const t = useSaid(words);
  const { c, w } = t;
  const action = useAction(w.notMarked, { fieldsProblem: w.fixDetails });

  const reports = (): CompletionReport[] => [
    ...Object.entries(notDone).map(([addOnKey, reason]) => ({
      kind: "add_on_not_done" as const,
      addOnKey,
      reason,
    })),
    ...Object.entries(done).map(([addOnKey, reason]) => ({
      kind: "add_on_done" as const,
      addOnKey,
      reason,
    })),
    ...(extraHours > 0
      ? [
          {
            kind: "extra_time" as const,
            hours: extraHours,
            reason: extraReason,
          },
        ]
      : []),
  ];

  const complete = async (close: () => void) => {
    if (!condition) {
      action.fail(undefined, { condition: w.sayHow });
      return;
    }
    const ok = await action.run(
      () =>
        postJson(`/api/assignments/mine/${job.id}/complete`, {
          condition,
          reports: reports(),
        }),
      w.marked,
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button>{c.markDone}</Button>
      <Dialog title={w.title}>
        {({ close }) => (
          <Form
            validationErrors={action.fieldErrors}
            onSubmit={(e) => {
              e.preventDefault();
              void complete(close);
            }}
          >
            <p className="text-fg-muted">{w.intro}</p>
            <RadioGroup
              label={w.howWasHome}
              name="condition"
              value={condition}
              onChange={(value) => setCondition(value as Condition)}
              isRequired
            >
              {(["light", "moderate", "heavy"] as const).map((c) => (
                <Radio key={c} value={c}>
                  {t.conditionLabel[c]}
                </Radio>
              ))}
            </RadioGroup>

            {job.reportable.quoted.length > 0 && (
              <AddOnReports
                title={w.couldntDo}
                addOns={job.reportable.quoted}
                ticked={notDone}
                onChange={setNotDone}
                reasonLabel={w.whyNot}
              />
            )}
            {job.reportable.others.length > 0 && (
              <AddOnReports
                title={w.didMore}
                addOns={job.reportable.others}
                ticked={done}
                onChange={setDone}
                reasonLabel={w.whyMore}
              />
            )}

            <fieldset className="flex flex-col gap-3">
              <Heading level={3}>{w.moreTime}</Heading>
              <NumberField
                label={w.moreHours}
                description={w.leaveAt0}
                minValue={0}
                maxValue={24}
                step={0.25}
                value={extraHours}
                onChange={(hours) =>
                  setExtraHours(Number.isNaN(hours) ? 0 : hours)
                }
                className="max-w-xs"
              />
              {extraHours > 0 && (
                <TextField
                  label={w.whatTookLonger}
                  value={extraReason}
                  onChange={setExtraReason}
                  isRequired
                />
              )}
            </fieldset>

            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                {c.goBack}
              </Button>
              <Button type="submit" isPending={action.isPending}>
                {c.markDone}
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

function AddOnReports({
  title,
  addOns,
  ticked,
  onChange,
  reasonLabel,
}: {
  title: string;
  addOns: AddOnChoice[];
  ticked: Ticked;
  onChange: (next: Ticked) => void;
  reasonLabel: string;
}) {
  const toggle = (key: string, on: boolean) => {
    const next = { ...ticked };
    if (on) next[key] = "";
    else delete next[key];
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <Heading level={3}>{title}</Heading>
      {addOns.map((addOn) => (
        <div key={addOn.key} className="flex flex-col gap-2">
          <Checkbox
            isSelected={addOn.key in ticked}
            onChange={(on) => toggle(addOn.key, on)}
          >
            {addOn.name}
          </Checkbox>
          {addOn.key in ticked && (
            <TextField
              label={reasonLabel}
              aria-label={`${reasonLabel} (${addOn.name})`}
              value={ticked[addOn.key]}
              onChange={(reason) =>
                onChange({ ...ticked, [addOn.key]: reason })
              }
              isRequired
              className="ps-9"
            />
          )}
        </div>
      ))}
    </fieldset>
  );
}

// what the Cleaner reported once it's Completed, never with prices
export function Completed({ job }: { job: CleanerJob }) {
  const completion = job.completion!;
  const t = useSaid(words);
  const { c, w } = t;
  return (
    <Section title={c.done}>
      <Card>
        <p>
          {w.markedAt(
            t.formatTime(completion.completedAt),
            c.by(completion.completedBy),
          )}
        </p>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">{t.condition}</dt>
          <dd>{t.conditionLabel[completion.condition]}</dd>
          <dt className="font-semibold">{w.reported}</dt>
          <dd>
            {completion.reports.length === 0 ? (
              w.nothingDifferent
            ) : (
              <ul>
                {completion.reports.map((r, i) => (
                  <li key={i}>
                    {t.adjustmentLabel(r)}: {r.reason}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </dl>
      </Card>
    </Section>
  );
}

// why a Job can't be Completed yet, for a Confirmed Cleaner
export function NotYet({ job }: { job: CleanerJob }) {
  const { NOT_ALL_CONFIRMED } = useSaid(words);
  if (
    job.assignment.status !== "confirmed" ||
    job.outcome ||
    job.canComplete ||
    !job.started
  ) {
    return null;
  }
  return <Notice tone="warning">{NOT_ALL_CONFIRMED}</Notice>;
}
