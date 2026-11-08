import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { CalendarX } from "lucide-react";
import {
  CANCELLATION_CUTOFF_HOURS,
  cancelCostForOffice,
  type CancellationTerms,
  type CancelledBy,
  type JobPayment,
  type OfficeJob,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  IconAction,
  Notice,
  Radio,
  RadioGroup,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import {
  cancelledLabel,
  formatDateTime,
  formatMoney,
  jobStatusLabel,
  wasSkipped,
} from "../format.ts";
import { useAction } from "../action.ts";
import type { CostedJob } from "../RescheduleParts.tsx";

// What cancelling costs, in a sentence, then how a plan Job's fee is
// taken: charged to the saved card, or on the Bill for the Job's week
// (ADR-0016)
const describeTerms = (terms: CancellationTerms, job: CostedJob) => {
  const onPlan = job.servicePlanId !== null;
  return [
    cancelCostForOffice({
      onPlan,
      late: terms.late,
      feeCents: terms.feeCents,
      fee: formatMoney(terms.feeCents),
    }),
    onPlan &&
      terms.feeCents > 0 &&
      `The fee ${job.weeklyBill ? "goes on that week's bill" : "is charged"}.`,
    !onPlan &&
      terms.refundCents > 0 &&
      `The ${formatMoney(terms.refundCents)} deposit is refunded.`,
  ]
    .filter(Boolean)
    .join(" ");
};

// Office Staff cancel a booked Job, for the Client (by the cancellation
// policy) or because Empire Cleaning can't do it (always refunded in full).
// A plan Job is skipped, and the plan carries on.
export function CancelJob({ job }: { job: OfficeJob }) {
  const terms = job.cancelTerms!;
  const onPlan = job.servicePlanId !== null;
  const router = useRouter();
  const [by, setBy] = useState<CancelledBy>("client");
  const [reason, setReason] = useState("");
  const action = useAction("The job wasn't cancelled. Please try again.");

  const cancel = async (close: () => void) => {
    const ok = await action.run(
      () =>
        postJson(`/api/jobs/${job.id}/cancel`, {
          by,
          feeCents: terms[by].feeCents,
          reason: by === "empire" ? reason : null,
        }),
      "Job cancelled",
    );
    if (ok) close();
    // the cost may have changed since the page loaded: show it as it is now
    else await router.invalidate();
  };

  return (
    <DialogTrigger>
      <IconAction icon={CalendarX} label="Cancel job" danger />
      <Dialog title="Cancel this job?" role="alertdialog">
        {({ close }) => (
          <>
            <RadioGroup
              label="Who's cancelling?"
              value={by}
              onChange={(value) => setBy(value as CancelledBy)}
            >
              <Radio
                value="client"
                description={describeTerms(terms.client, job)}
              >
                The client asked
              </Radio>
              <Radio
                value="empire"
                description={describeTerms(terms.empire, job)}
              >
                Empire Cleaning can't do it
              </Radio>
            </RadioGroup>
            {by === "empire" && (
              <TextField
                label="Why? (the client sees this)"
                value={reason}
                onChange={setReason}
                multiline
              />
            )}
            <p className="text-sm text-fg-muted">
              It comes off the schedule.
              {onPlan && " The cleaning plan carries on."} We email the client
              and the cleaners.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() => void cancel(close)}
              >
                Cancel job
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// the money on a Job that didn't happen: its fee, if any, and what's been
// paid, billed weekly or refunded. A failed charge is a Notice above, with its retry.
export function FeeMoney({
  feeCents,
  payment,
}: {
  feeCents: number;
  payment: JobPayment;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
      <dt className="font-semibold">Fee</dt>
      <dd>{feeCents > 0 ? formatMoney(feeCents) : "None"}</dd>
      <dt className="font-semibold">Paid</dt>
      <dd>{formatMoney(payment.paidCents)}</dd>
      {payment.billedCents !== 0 && (
        <>
          <dt className="font-semibold">On weekly bills</dt>
          <dd>{formatMoney(payment.billedCents)}</dd>
        </>
      )}
      {payment.owedCents !== 0 && (
        <>
          <dt className="font-semibold">
            {payment.owedCents > 0 ? "Still owed" : "Still to refund"}
          </dt>
          <dd>{formatMoney(Math.abs(payment.owedCents))}</dd>
        </>
      )}
    </dl>
  );
}

// how a Job that didn't happen ended, in a title and a sentence: Cancelled
// (a plan Job the Client cancelled is Skipped) or No Access; null otherwise
export const howItEnded = (
  job: OfficeJob,
): { title: string; at: string; description: string } | null => {
  const { cancellation, noAccess } = job;
  if (cancellation) {
    const skipped = wasSkipped(job);
    const why =
      cancellation.by === "empire"
        ? "By Empire Cleaning, refunded in full"
        : cancellation.late
          ? "By the client, a late cancellation"
          : `By the client, more than ${CANCELLATION_CUTOFF_HOURS} hours ahead`;
    return {
      title: `${cancelledLabel(skipped)} ${formatDateTime(cancellation.cancelledAt)}`,
      at: cancellation.cancelledAt,
      description: [
        `${why}${skipped ? "; the plan carries on" : ""}.`,
        cancellation.reason,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }
  if (noAccess) {
    return {
      title: `${jobStatusLabel.no_access} ${formatDateTime(noAccess.recordedAt)}`,
      at: noAccess.recordedAt,
      description: `${noAccess.recordedBy ? `${noAccess.recordedBy.name} said` : "The cleaner said"}: "${noAccess.reason}" Charged like a late cancellation.`,
    };
  }
  return null;
};
