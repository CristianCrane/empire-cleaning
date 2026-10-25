import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type {
  AddOnChoice,
  CleanerJob,
  CompletionReport,
  Condition,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Form,
  Heading,
  Notice,
  NumberField,
  Radio,
  RadioGroup,
  TextField,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { adjustmentLabel, conditionLabel, formatTime } from "../format.ts";

// the reason given for each Add-on ticked, by its key
type Ticked = Record<string, string>;

// The Cleaner marks the Job Completed on site, with the Condition they found
// and anything different from the Quote. They never set prices: the Office
// works those out from the Price List, and asks the Client before charging
// anything extra (ADR-0009).
export function CompleteJob({ job }: { job: CleanerJob }) {
  const router = useRouter();
  const [condition, setCondition] = useState<Condition | null>(null);
  const [notDone, setNotDone] = useState<Ticked>({});
  const [done, setDone] = useState<Ticked>({});
  const [extraHours, setExtraHours] = useState(0);
  const [extraReason, setExtraReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);

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

  const complete = async () => {
    if (!condition) {
      setFieldErrors({ condition: "Say how the home was" });
      return;
    }
    setPending(true);
    setProblem(undefined);
    setFieldErrors({});
    try {
      await postJson(`/api/assignments/mine/${job.id}/complete`, {
        condition,
        reports: reports(),
      });
      showToast({ tone: "success", title: "Job Completed" });
      await router.invalidate();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setFieldErrors(e.fieldErrors);
        setProblem("Some details need fixing.");
      } else {
        setProblem(
          e instanceof ApiError && e.status === 409
            ? e.message
            : "The Job wasn't marked Completed. Please try again.",
        );
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Card
      title="Complete this Job"
      description="When you've finished, tell us how it went. If anything was different from the Quote, the Office will sort out the price with the Client."
    >
      <Form
        validationErrors={fieldErrors}
        onSubmit={(e) => {
          e.preventDefault();
          void complete();
        }}
      >
        <RadioGroup
          label="How was the home?"
          name="condition"
          value={condition}
          onChange={(value) => setCondition(value as Condition)}
          isRequired
        >
          {(["light", "moderate", "heavy"] as const).map((c) => (
            <Radio key={c} value={c}>
              {conditionLabel[c]}
            </Radio>
          ))}
        </RadioGroup>

        {job.reportable.quoted.length > 0 && (
          <AddOnReports
            title="Add-ons on the Quote you couldn't do"
            addOns={job.reportable.quoted}
            ticked={notDone}
            onChange={setNotDone}
            reasonLabel="Why not?"
          />
        )}
        {job.reportable.others.length > 0 && (
          <AddOnReports
            title="Add-ons you did that weren't on the Quote"
            addOns={job.reportable.others}
            ticked={done}
            onChange={setDone}
            reasonLabel="Why? For example, the Client asked"
          />
        )}

        <fieldset className="flex flex-col gap-3">
          <Heading level={3}>Extra time</Heading>
          <NumberField
            label="Extra hours, all of you together"
            description="Leave at 0 if the clean took about as long as planned."
            minValue={0}
            maxValue={24}
            step={0.25}
            value={extraHours}
            onChange={(hours) => setExtraHours(Number.isNaN(hours) ? 0 : hours)}
            className="max-w-xs"
          />
          {extraHours > 0 && (
            <TextField
              label="What took longer?"
              value={extraReason}
              onChange={setExtraReason}
              isRequired
            />
          )}
        </fieldset>

        {problem && <Notice tone="danger">{problem}</Notice>}
        <Actions>
          <Button type="submit" isPending={isPending}>
            Mark Completed
          </Button>
        </Actions>
      </Form>
    </Card>
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
  return (
    <Card title="Completed">
      <p>
        Marked Completed at {formatTime(completion.completedAt)}
        {completion.completedBy && ` by ${completion.completedBy}`}. Thank you!
      </p>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">Condition</dt>
        <dd>{conditionLabel[completion.condition]}</dd>
        <dt className="font-semibold">Reported</dt>
        <dd>
          {completion.reports.length === 0 ? (
            "Nothing different from the Quote"
          ) : (
            <ul>
              {completion.reports.map((r, i) => (
                <li key={i}>
                  {adjustmentLabel(r)}: {r.reason}
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
    </Card>
  );
}

// why a Job can't be Completed yet, for a Confirmed Cleaner
export function NotYet({ job }: { job: CleanerJob }) {
  if (
    job.assignment.status !== "confirmed" ||
    job.outcome ||
    job.canComplete ||
    !job.started
  ) {
    return null;
  }
  return (
    <Notice>
      Not everyone on this Job has Confirmed their place, so it can't be marked
      Completed yet. Please call the Office.
    </Notice>
  );
}
