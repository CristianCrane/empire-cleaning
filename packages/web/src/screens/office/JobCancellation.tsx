import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  cancelCostForOffice,
  type CancellationTerms,
  type CancelledBy,
  type OfficeJob,
  formats,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  Notice,
  Radio,
  RadioGroup,
  TextField,
  type DialogState,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import type { CostedJob } from "../RescheduleParts.tsx";

const { formatMoney } = formats.en;

// What cancelling costs, as the Office reads it
const describeTerms = (terms: CancellationTerms, job: CostedJob) =>
  cancelCostForOffice({
    onPlan: job.servicePlanId !== null,
    late: terms.late,
    feeCents: terms.feeCents,
    fee: formatMoney(terms.feeCents),
    weeklyBill: job.weeklyBill !== null,
    refund: terms.refundCents > 0 ? formatMoney(terms.refundCents) : null,
  });

// Office Staff cancel a booked Job, for the Client (by the cancellation
// policy) or because we can't do it (always refunded in full). A plan Job
// is skipped, and the plan carries on. What each costs is said by its
// choice, or once for both when they cost the same (#521, U12)
export function CancelJob({
  job,
  isOpen,
  onOpenChange,
}: { job: OfficeJob } & DialogState) {
  const terms = job.cancelTerms!;
  const onPlan = job.servicePlanId !== null;
  const router = useRouter();
  const [by, setBy] = useState<CancelledBy>("client");
  const [reason, setReason] = useState("");
  const action = useAction("The job wasn't cancelled. Please try again.");
  const forClient = describeTerms(terms.client, job);
  const forUs = describeTerms(terms.empire, job);
  const same = forClient === forUs;

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
    <Dialog
      title="Cancel this job?"
      role="alertdialog"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      {({ close }) => (
        <>
          <RadioGroup
            label="Who's cancelling?"
            description={same ? forClient : undefined}
            value={by}
            onChange={(value) => setBy(value as CancelledBy)}
          >
            <Radio value="client" description={same ? undefined : forClient}>
              The client asked
            </Radio>
            <Radio value="empire" description={same ? undefined : forUs}>
              We can't do it
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
            {onPlan && " The cleaning plan carries on."} We email the client and
            the cleaners.
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
  );
}
