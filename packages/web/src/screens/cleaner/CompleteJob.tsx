import { Sparkles, ClipboardList } from "lucide-react";
import { useState } from "react";
import {
  type AddOnChoice,
  type CleanerJob,
  type CompletionReport,
  type Condition,
  catalog,
  firstNameOf,
  oneStop,
  theTimeEs,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Dialog,
  Form,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  TextField,
  Fact,
  Facts,
  type Alert,
  type DialogState,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { useSaid } from "../words.ts";

const words = catalog({
  en: {
    notMarked: "The job wasn't marked done. Please try again.",
    fixDetails: "Some details need fixing.",
    marked: "Job marked done",
    title: "Mark this job done",
    howWasHome: "How was the home?",
    couldntDo: "Extras on the quote you couldn't do",
    whyNot: "Why not?",
    didMore: "Extras you did that weren't on the quote",
    whyMore: "Why? For example, the client asked",
    moreHours: "More hours, all of you together",
    moreHoursAlone: "More hours",
    leaveAt0: "Leave at 0 if the clean took about as long as planned.",
    whatTookLonger: "What took longer?",
    // who marked it done, as the reader calls them, and when
    youMarked: (time: string) => `You marked it done at ${time}. Thanks!`,
    theyMarked: (name: string, time: string) =>
      `${name} marked it done at ${time}. Thanks!`,
    markedAt: (time: string) => `Marked done at ${time}. Thanks!`,
    reported: "Reported",
    nothingToReport: "Nothing to report",
  },
  es: {
    notMarked: "El trabajo no se marcó como terminado. Vuelve a intentarlo.",
    fixDetails: "Hay que corregir algunos datos.",
    marked: "Trabajo marcado como terminado",
    title: "Marcar este trabajo como terminado",
    howWasHome: "¿Cómo estaba la casa?",
    couldntDo: "Adicionales de la cotización que no pudiste hacer",
    whyNot: "¿Por qué no?",
    didMore: "Adicionales que hiciste y no estaban en la cotización",
    whyMore: "¿Por qué? Por ejemplo, lo pidió el cliente",
    moreHours: "Horas de más, entre todos",
    moreHoursAlone: "Horas de más",
    leaveAt0: "Déjalo en 0 si la limpieza tomó más o menos lo previsto.",
    whatTookLonger: "¿Qué tomó más tiempo?",
    youMarked: (time: string) =>
      oneStop(`Lo marcaste como terminado a ${theTimeEs(time)}. ¡Gracias!`),
    theyMarked: (name: string, time: string) =>
      oneStop(
        `${name} lo marcó como terminado a ${theTimeEs(time)}. ¡Gracias!`,
      ),
    markedAt: (time: string) =>
      oneStop(`Marcado como terminado a ${theTimeEs(time)}. ¡Gracias!`),
    reported: "Lo que se informó",
    nothingToReport: "Nada que informar",
  },
});

// the reason given for each Add-on ticked, by its key
type Ticked = Record<string, string>;

// The Cleaner marks the Job Completed on site, with the Condition they found
// and anything different from the Quote: the page's next step's dialog,
// its three questions one rank. They never set prices: the Office works
// those out from the Price List, and asks the Client before charging
// anything extra (ADR-0009).
export function CompleteJob({
  job,
  ...state
}: { job: CleanerJob } & DialogState) {
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
      action.fail(undefined, { condition: t.SAY_CONDITION });
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
    <Dialog title={w.title} {...state}>
      {({ close }) => (
        <Form
          validationErrors={action.fieldErrors}
          onSubmit={(e) => {
            e.preventDefault();
            void complete(close);
          }}
        >
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

          <div className="flex flex-col gap-3">
            <NumberField
              label={job.crew.length > 1 ? w.moreHours : w.moreHoursAlone}
              description={w.leaveAt0}
              minValue={0}
              maxValue={24}
              step={0.25}
              value={extraHours}
              onChange={(hours) =>
                setExtraHours(Number.isNaN(hours) ? 0 : hours)
              }
            />
            {extraHours > 0 && (
              <TextField
                label={w.whatTookLonger}
                value={extraReason}
                onChange={setExtraReason}
                isRequired
              />
            )}
          </div>

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
    // its question a field's label, as How was the home? is: one rank
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-fg">{title}</legend>
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

// what was reported once it's Completed, first on the page, never with
// prices: who marked it done, as the reader calls them, then the home and
// what was different. Its badge says Done, so no title says it again
export function Completed({ job }: { job: CleanerJob }) {
  const completion = job.completion!;
  const t = useSaid(words);
  const { c, w } = t;
  const at = t.formatTime(completion.completedAt);
  const by = completion.completedBy;
  return (
    <Card hiddenTitle={c.done}>
      <p className="text-lg">
        {by === null
          ? w.markedAt(at)
          : by === readerOf(job)
            ? w.youMarked(at)
            : w.theyMarked(firstNameOf(by), at)}
      </p>
      <Facts>
        <Fact
          icon={Sparkles}
          label={t.condition}
          value={t.conditionLabel[completion.condition]}
        />
        <Fact
          icon={ClipboardList}
          label={w.reported}
          value={
            completion.reports.length === 0 ? (
              w.nothingToReport
            ) : (
              <ul>
                {completion.reports.map((r, i) => (
                  <li key={i}>
                    {t.adjustmentLabel(r)}: {r.reason}
                  </li>
                ))}
              </ul>
            )
          }
        />
      </Facts>
    </Card>
  );
}

// the reader's own name, as the crew holds it
export const readerOf = (job: CleanerJob) => job.crew.find((m) => m.you)?.name;

// why a Job can't be Completed yet, for a Confirmed Cleaner: an alert
export function useNotYet(job: CleanerJob): Alert | null {
  const { NOT_ALL_CONFIRMED } = useSaid(words);
  if (
    job.assignment.status !== "confirmed" ||
    job.outcome ||
    job.canComplete ||
    !job.started
  ) {
    return null;
  }
  return { key: "not yet", tone: "warning", children: NOT_ALL_CONFIRMED };
}
