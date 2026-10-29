import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Ban } from "lucide-react";
import type {
  CancellationTerms,
  CancelledBy,
  JobPayment,
  OfficeJob,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Notice,
  Radio,
  RadioGroup,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { formatDateTime, formatMoney } from "../format.ts";
import { useAction } from "../action.ts";

// What cancelling costs, in a sentence. A plan Job has no Deposit of its
// own: its fee is the plan's Deposit amount, charged to the saved card.
export const describeTerms = (terms: CancellationTerms, onPlan = false) =>
  onPlan
    ? terms.late
      ? `It's a Late Cancellation: a ${formatMoney(terms.feeCents)} fee, the plan's Deposit amount, is charged. The plan's Deposit stays held.`
      : terms.feeCents > 0
        ? `The ${formatMoney(terms.feeCents)} fee for a Late Reschedule is charged.`
        : "It's free."
    : terms.late
      ? `It's a Late Cancellation: the ${formatMoney(terms.feeCents)} Deposit is kept as the fee.`
      : terms.feeCents > 0
        ? `The ${formatMoney(terms.feeCents)} Deposit was already kept as the fee for a Late Reschedule, and isn't refunded.`
        : terms.refundCents > 0
          ? `It's free: the ${formatMoney(terms.refundCents)} Deposit is refunded.`
          : "It's free.";

// Office Staff cancel a booked Job, for the Client (by the cancellation
// policy) or because Empire Cleaning can't do it (always refunded in full).
// A plan Job is skipped, and the plan carries on.
export function CancelJob({ job }: { job: OfficeJob }) {
  const terms = job.cancelTerms!;
  const onPlan = job.servicePlanId !== null;
  const router = useRouter();
  const [by, setBy] = useState<CancelledBy>("client");
  const [reason, setReason] = useState("");
  const action = useAction("The Job wasn't cancelled. Please try again.");

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
      <Button variant="danger-text" size="sm">
        <Ban aria-hidden size={16} />
        Cancel Job
      </Button>
      <Dialog title="Cancel this Job?" role="alertdialog">
        {({ close }) => (
          <>
            <RadioGroup
              label="Who's cancelling?"
              value={by}
              onChange={(value) => setBy(value as CancelledBy)}
            >
              <Radio
                value="client"
                description={describeTerms(terms.client, onPlan)}
              >
                The Client asked
              </Radio>
              <Radio
                value="empire"
                description={describeTerms(terms.empire, onPlan)}
              >
                Empire Cleaning can't do it
              </Radio>
            </RadioGroup>
            {by === "empire" && (
              <TextField
                label="Why? (told to the Client)"
                value={reason}
                onChange={setReason}
                multiline
              />
            )}
            <p className="text-sm text-fg-muted">
              It comes off the Schedule.
              {onPlan && " The Service Plan carries on."} The Client and its
              crew are emailed.
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
                Cancel Job
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// the money on a Job that didn't happen: its fee, if any, and what's been
// paid or refunded. A failed charge is a Notice above, with its retry.
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
    const skipped = job.servicePlanId !== null && cancellation.by === "client";
    const why =
      cancellation.by === "empire"
        ? "By Empire Cleaning, refunded in full"
        : cancellation.late
          ? "By the Client, a Late Cancellation"
          : "By the Client, more than 24 hours ahead";
    return {
      title: `${skipped ? "Skipped" : "Cancelled"} ${formatDateTime(cancellation.cancelledAt)}`,
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
      title: `No Access ${formatDateTime(noAccess.recordedAt)}`,
      at: noAccess.recordedAt,
      description: `${noAccess.recordedBy ? `${noAccess.recordedBy.name} said` : "The Cleaner said"}: "${noAccess.reason}" Charged like a Late Cancellation.`,
    };
  }
  return null;
};
