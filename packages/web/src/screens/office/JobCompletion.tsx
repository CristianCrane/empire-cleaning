import { useState, type ReactNode } from "react";
import { CreditCard, Undo2 } from "lucide-react";
import type {
  AdjustmentStatus,
  AdjustmentView,
  Condition,
  JobCompletion,
  JobPayment,
  OfficeJob,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Form,
  List,
  ListItem,
  Notice,
  NumberField,
  Section,
  Select,
  SelectItem,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { deleteJson, patchJson, postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import {
  adjustmentLabel,
  conditionLabel,
  dollars,
  formatDate,
  formatDateTime,
  formatMoney,
} from "../format.ts";

export const statusBadge: Record<AdjustmentStatus, ReactNode> = {
  applied: <StatusBadge tone="success">Applied</StatusBadge>,
  reported: <StatusBadge tone="info">To review</StatusBadge>,
  dismissed: <StatusBadge>Dismissed</StatusBadge>,
  proposed: <StatusBadge tone="warning">Waiting on the Client</StatusBadge>,
  approved: <StatusBadge tone="success">Approved</StatusBadge>,
  declined: <StatusBadge>Declined</StatusBadge>,
  lapsed: <StatusBadge>Lapsed</StatusBadge>,
};

export const describeAdjustment = (a: AdjustmentView) =>
  [
    `"${a.reason}"`,
    a.officeReason && `Office: ${a.officeReason}`,
    a.lapsesAt && `lapses ${formatDate(a.lapsesAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");

export function ConditionField({
  job,
  completion,
}: {
  job: OfficeJob;
  completion: JobCompletion;
}) {
  const action = useAction("The Condition wasn't saved. Please try again.");
  return (
    <Select
      label="Condition reported"
      description="It's the home's Condition too, for future Quotes."
      selectedKey={completion.condition}
      onSelectionChange={(key) =>
        void action.run(
          () =>
            patchJson(`/api/jobs/${job.id}/completion`, {
              condition: key as Condition,
            }),
          "Condition corrected",
        )
      }
      className="max-w-xs"
    >
      {(["light", "moderate", "heavy"] as const).map((c) => (
        <SelectItem key={c} id={c}>
          {conditionLabel[c]}
        </SelectItem>
      ))}
    </Select>
  );
}

// a price before tax, in dollars, and the reason for changing it
function PriceForm({
  label,
  initialCents,
  needsReason,
  fieldErrors,
  submitLabel,
  onSubmit,
  extra,
  isPending,
  problem,
  onCancel,
}: {
  label: string;
  initialCents: number;
  needsReason: (cents: number) => boolean;
  fieldErrors: Record<string, string>;
  submitLabel: string;
  onSubmit: (priceCents: number, reason: string) => void;
  extra?: ReactNode;
  isPending: boolean;
  problem?: string;
  onCancel: () => void;
}) {
  const [price, setPrice] = useState(initialCents / 100);
  const [reason, setReason] = useState("");
  const cents = Math.round((Number.isNaN(price) ? 0 : price) * 100);

  return (
    <Form
      validationErrors={fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(cents, reason);
      }}
    >
      <NumberField
        label={label}
        name="priceCents"
        minValue={0}
        formatOptions={dollars}
        value={price}
        onChange={setPrice}
      />
      {needsReason(cents) && (
        <TextField
          label="Reason for the change"
          name="reason"
          value={reason}
          onChange={setReason}
          isRequired
        />
      )}
      {problem && <Notice tone="danger">{problem}</Notice>}
      <Actions>
        <Button variant="secondary" onPress={onCancel}>
          Cancel
        </Button>
        {extra}
        <Button type="submit" isPending={isPending}>
          {submitLabel}
        </Button>
      </Actions>
    </Form>
  );
}

// an increase the Cleaner reported: propose it to the Client, at its
// worked-out price or another, or dismiss it
export function Review({
  job,
  adjustment,
}: {
  job: OfficeJob;
  adjustment: AdjustmentView;
}) {
  const action = useAction("It wasn't saved. Please try again.");
  const label = adjustmentLabel(adjustment);

  return (
    <DialogTrigger>
      <Button size="sm" aria-label={`Review ${label}`}>
        Review
      </Button>
      <Dialog title={`Review: ${label}`}>
        {({ close }) => (
          <>
            <p>
              The Cleaner said: "{adjustment.reason}". Worked out from the Price
              List, it's {formatMoney(adjustment.workedOutCents)} before tax.
              The Client is emailed to approve it, and it's only charged if they
              do.
            </p>
            <PriceForm
              label="Price before tax"
              initialCents={adjustment.workedOutCents}
              needsReason={(cents) => cents !== adjustment.workedOutCents}
              fieldErrors={action.fieldErrors}
              submitLabel="Propose to the Client"
              isPending={action.isPending}
              problem={action.problem}
              onCancel={close}
              onSubmit={(priceCents, reason) =>
                void action
                  .run(
                    () =>
                      postJson(
                        `/api/jobs/${job.id}/adjustments/${adjustment.id}/propose`,
                        priceCents === adjustment.workedOutCents
                          ? {}
                          : { priceCents, reason },
                      ),
                    "Proposed to the Client",
                  )
                  .then((ok) => ok && close())
              }
              extra={
                <Button
                  variant="secondary"
                  onPress={() =>
                    void action
                      .run(
                        () =>
                          postJson(
                            `/api/jobs/${job.id}/adjustments/${adjustment.id}/dismiss`,
                            {},
                          ),
                        "Dismissed",
                      )
                      .then((ok) => ok && close())
                  }
                >
                  Dismiss
                </Button>
              }
            />
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// an Adjustment that counts: change its price, charging or refunding the
// difference
export function Correct({
  job,
  adjustment,
}: {
  job: OfficeJob;
  adjustment: AdjustmentView;
}) {
  const action = useAction("It wasn't corrected. Please try again.");
  const label = adjustmentLabel(adjustment);
  const current = Math.abs(adjustment.priceCents);

  return (
    <DialogTrigger>
      <Button variant="quiet" size="sm" aria-label={`Correct ${label}`}>
        Correct
      </Button>
      <Dialog title={`Correct: ${label}`}>
        {({ close }) => (
          <>
            <p>
              {adjustment.status === "approved"
                ? "The Client approved this price, so it can only be lowered."
                : "This takes the price off the Job."}{" "}
              The difference is charged or refunded straight away.
            </p>
            <PriceForm
              label={
                adjustment.priceCents < 0
                  ? "Amount taken off, before tax"
                  : "Price before tax"
              }
              initialCents={current}
              needsReason={() => true}
              fieldErrors={action.fieldErrors}
              submitLabel="Save"
              isPending={action.isPending}
              problem={action.problem}
              onCancel={close}
              onSubmit={(priceCents, reason) =>
                void action
                  .run(
                    () =>
                      patchJson(
                        `/api/jobs/${job.id}/adjustments/${adjustment.id}`,
                        { priceCents, reason },
                      ),
                    "Adjustment corrected",
                  )
                  .then((ok) => ok && close())
              }
            />
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

export function RemoveAdjustment({
  job,
  adjustment,
}: {
  job: OfficeJob;
  adjustment: AdjustmentView;
}) {
  const action = useAction("It wasn't removed. Please try again.");
  const label = adjustmentLabel(adjustment);

  return (
    <DialogTrigger>
      <Button variant="quiet" size="sm" aria-label={`Remove ${label}`}>
        Remove
      </Button>
      <Dialog title={`Remove ${label}?`} role="alertdialog">
        {({ close }) => (
          <>
            <p>
              If it changed the price, the difference is charged or refunded
              straight away, and the Client is emailed.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() =>
                  void action
                    .run(
                      () =>
                        deleteJson(
                          `/api/jobs/${job.id}/adjustments/${adjustment.id}`,
                        ),
                      "Adjustment removed",
                    )
                    .then((ok) => ok && close())
                }
              >
                Remove
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

export function UndoCompletion({ job }: { job: OfficeJob }) {
  const action = useAction("The completion wasn't undone. Please try again.");
  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <Undo2 aria-hidden size={16} />
        Undo completion
      </Button>
      <Dialog title="Undo this completion?" role="alertdialog">
        {({ close }) => (
          <>
            <p>
              For a Job marked Completed by mistake. It goes back to booked, its
              Adjustments are removed, and everything charged except the Deposit
              is refunded. The Client is emailed, and the Cleaner can complete
              it again.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() =>
                  void action
                    .run(
                      () => deleteJson(`/api/jobs/${job.id}/completion`),
                      "Completion undone",
                    )
                    .then((ok) => ok && close())
                }
              >
                Undo completion
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// the Adjustments the Cleaner reported or the Office made: Office Staff
// review increases, and correct or remove any
export function Adjustments({ job }: { job: OfficeJob }) {
  const adjustments = job.completion!.adjustments;
  return (
    <Section
      title="Adjustments"
      description="Priced from the Price List the Quote used. Increases are only charged once the Client approves them."
    >
      {adjustments.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Nothing different from the Quote was reported.
        </p>
      ) : (
        <List aria-label="Adjustments">
          {adjustments.map((a) => (
            <ListItem
              key={a.id}
              id={a.id}
              title={`${adjustmentLabel(a)}: ${formatMoney(a.totalCents)}`}
              description={describeAdjustment(a)}
              end={
                <>
                  {statusBadge[a.status]}
                  {a.status === "reported" && (
                    <Review job={job} adjustment={a} />
                  )}
                  {(a.status === "applied" || a.status === "approved") && (
                    <Correct job={job} adjustment={a} />
                  )}
                  <RemoveAdjustment job={job} adjustment={a} />
                </>
              }
            />
          ))}
        </List>
      )}
    </Section>
  );
}

// a Completed Job's money, tax included. Each charge is in its History, and
// a failed one is a Notice above, with its retry.
export function JobMoney({ payment }: { payment: JobPayment }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
      <dt className="font-semibold">Quoted</dt>
      <dd>{formatMoney(payment.quotedCents)}</dd>
      {payment.adjustmentsCents !== 0 && (
        <>
          <dt className="font-semibold">Adjustments</dt>
          <dd>{formatMoney(payment.adjustmentsCents)}</dd>
        </>
      )}
      <dt className="font-semibold">Total</dt>
      <dd>{formatMoney(payment.totalCents)}, tax included</dd>
      <dt className="font-semibold">Paid</dt>
      <dd>
        {formatMoney(payment.paidCents)}
        {payment.paymentMethod && ` by ${payment.paymentMethod}`}
      </dd>
      {payment.owedCents !== 0 && (
        <>
          <dt className="font-semibold">
            {payment.owedCents > 0 ? "Still owed" : "To refund"}
          </dt>
          <dd>{formatMoney(Math.abs(payment.owedCents))}</dd>
        </>
      )}
    </dl>
  );
}

// charges what a Job owes again, after a failed charge: a Balance, or the
// fee of a plan Job that didn't happen
export function RetryCharge({ job }: { job: OfficeJob }) {
  const action = useAction("It wasn't retried. Please try again.");
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="text"
        size="sm"
        isPending={action.isPending}
        onPress={() =>
          void action.run(
            () => postJson(`/api/jobs/${job.id}/balance/retry`),
            "Charged",
          )
        }
      >
        <CreditCard aria-hidden size={16} />
        Try the charge again
      </Button>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
    </div>
  );
}
