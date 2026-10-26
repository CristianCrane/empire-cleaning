import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type {
  CancellationTerms,
  CancelledBy,
  JobPayment,
  OfficeJob,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Notice,
  Radio,
  RadioGroup,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { formatDate, formatDateTime, formatMoney } from "../format.ts";
import { useJobAction } from "./JobCompletion.tsx";

// what cancelling costs, in a sentence
export const describeTerms = (terms: CancellationTerms) =>
  terms.late
    ? `It's a Late Cancellation: the ${formatMoney(terms.feeCents)} Deposit is kept as the fee.`
    : terms.feeCents > 0
      ? `The ${formatMoney(terms.feeCents)} Deposit was already kept as the fee for a Late Reschedule, and isn't refunded.`
      : terms.refundCents > 0
        ? `It's free: the ${formatMoney(terms.refundCents)} Deposit is refunded.`
        : "It's free.";

// Office Staff cancel a booked Job, for the Client (by the cancellation
// policy) or because Empire Cleaning can't do it (always refunded in full)
export function CancelJob({ job }: { job: OfficeJob }) {
  const terms = job.cancelTerms!;
  const router = useRouter();
  const [by, setBy] = useState<CancelledBy>("client");
  const [reason, setReason] = useState("");
  const action = useJobAction("The Job wasn't cancelled. Please try again.");

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
    <Card
      title="Cancelling"
      description={`The Client can cancel for free until ${formatDateTime(terms.client.freeUntil)}.`}
    >
      <Actions>
        <DialogTrigger>
          <Button variant="secondary">Cancel Job</Button>
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
                    description={describeTerms(terms.client)}
                  >
                    The Client asked
                  </Radio>
                  <Radio
                    value="empire"
                    description={describeTerms(terms.empire)}
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
                  It comes off the Schedule. The Client and everyone with a
                  place on it are emailed.
                </p>
                {action.problem && (
                  <Notice tone="danger">{action.problem}</Notice>
                )}
                <Actions>
                  <Button variant="secondary" onPress={close}>
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
      </Actions>
    </Card>
  );
}

const chargeLabel = { deposit: "Deposit", balance: "Balance" };

// the money on a Job that didn't happen
function FeePayment({
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
      <dt className="font-semibold">Charges</dt>
      <dd>
        <ul>
          {payment.charges.map((c, i) => (
            <li key={i}>
              {chargeLabel[c.kind]} {formatMoney(c.amountCents)},{" "}
              {formatDate(c.chargedAt)}
              {c.refundedCents > 0 &&
                ` (${formatMoney(c.refundedCents)} refunded)`}
            </li>
          ))}
        </ul>
      </dd>
      <dt className="font-semibold">Paid</dt>
      <dd>{formatMoney(payment.paidCents)}</dd>
      {payment.owedCents < 0 && (
        <>
          <dt className="font-semibold">Still to refund</dt>
          <dd>{formatMoney(-payment.owedCents)}</dd>
        </>
      )}
    </dl>
  );
}

// how a Cancelled Job was cancelled, and its money
export function CancelledCard({ job }: { job: OfficeJob }) {
  const cancellation = job.cancellation!;
  const why =
    cancellation.by === "empire"
      ? "By Empire Cleaning, refunded in full"
      : cancellation.late
        ? "By the Client, a Late Cancellation"
        : "By the Client, more than 24 hours ahead";
  return (
    <Card
      title="Cancelled"
      description={`${formatDateTime(cancellation.cancelledAt)}. ${why}.`}
    >
      {cancellation.reason && <p>{cancellation.reason}</p>}
      <FeePayment
        feeCents={cancellation.feeCents}
        payment={cancellation.payment}
      />
    </Card>
  );
}

// what the Cleaner said when they couldn't get in, and the money
export function NoAccessCard({ job }: { job: OfficeJob }) {
  const noAccess = job.noAccess!;
  return (
    <Card
      title="No Access"
      description={`${formatDateTime(noAccess.recordedAt)}${noAccess.recordedBy ? ` by ${noAccess.recordedBy.name}` : ""}. Charged like a Late Cancellation.`}
    >
      <p>"{noAccess.reason}"</p>
      <FeePayment feeCents={noAccess.feeCents} payment={noAccess.payment} />
    </Card>
  );
}
