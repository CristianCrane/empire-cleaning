import { formats } from "@empire-cleaning/models";
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
  Cell,
  Column,
  Row,
  Notice,
  NumberField,
  Section,
  Select,
  SelectItem,
  StatusBadge,
  Table,
  TableBody,
  TableHeader,
  TextField,
} from "@empire-cleaning/ui";
import { deleteJson, patchJson, postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { conditionLabel, dollars, formatHours } from "../format.ts";

const { formatDate, formatMoney } = formats.en;

const statusBadge: Record<AdjustmentStatus, ReactNode> = {
  applied: <StatusBadge tone="success">Added</StatusBadge>,
  reported: <StatusBadge tone="warning">To review</StatusBadge>,
  dismissed: <StatusBadge>Dismissed</StatusBadge>,
  proposed: <StatusBadge tone="info">Waiting on the client</StatusBadge>,
  approved: <StatusBadge tone="success">Approved</StatusBadge>,
  declined: <StatusBadge>Declined</StatusBadge>,
  lapsed: <StatusBadge>Not answered</StatusBadge>,
};

export function ConditionField({
  job,
  completion,
}: {
  job: OfficeJob;
  completion: JobCompletion;
}) {
  const action = useAction("The condition wasn't saved. Please try again.");
  return (
    <Select
      label="Condition reported"
      description="It's the home's condition too, for future quotes."
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

// a price before tax, in dollars, and the reason for changing it. Its
// quiet Button is Cancel, or else `extra`, another thing to do (the
// dialog's ✕ cancels then)
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
  // a quiet Button
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
        {extra ?? (
          <Button variant="quiet" onPress={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" isPending={isPending}>
          {submitLabel}
        </Button>
      </Actions>
    </Form>
  );
}

// what an Adjustment is about: the Add-on, or extra time
const whatOf = (a: AdjustmentView) =>
  a.kind === "extra_time" ? "Extra time" : a.addOnName!;

// what happened to it on the day, in short for the Table, in full when
// it's opened
const changeOf = (a: AdjustmentView) =>
  a.kind === "extra_time"
    ? `+${formatHours(a.hours!)}`
    : a.kind === "add_on_done"
      ? "Done on the day"
      : "Not done";

const fullChangeOf = (a: AdjustmentView) =>
  a.kind === "extra_time"
    ? `${a.hours} more ${a.hours === 1 ? "hour" : "hours"}, all the crew together`
    : a.kind === "add_on_done"
      ? "Done on the day, not on the quote"
      : "On the quote, not done";

// what it changes the total by, signed so a reduction reads as one
const signed = (cents: number) =>
  cents < 0 ? `−${formatMoney(-cents)}` : `+${formatMoney(cents)}`;

// whether it counts towards the price, so its price can be corrected
const counts = (a: AdjustmentView) =>
  a.status === "applied" || a.status === "approved";

/**
 * The Adjustments the Cleaner reported or the Office made, one row each:
 * what, what happened, its price and status. A row opens the Adjustment,
 * where Office Staff review an increase, or correct or remove one.
 */
export function Adjustments({ job }: { job: OfficeJob }) {
  const adjustments = job.completion!.adjustments;
  const [openId, setOpenId] = useState<string | null>(null);
  // the latest, once an action reloads the Job; gone if it was removed
  const open = adjustments.find((a) => a.id === openId);

  return (
    <Section
      title="Price changes"
      description="What the cleaner reported that was different from the quote, priced from the quote's prices. A price that goes up is only added once the client approves it."
    >
      {adjustments.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Nothing different from the quote was reported.
        </p>
      ) : (
        <Table
          aria-label="Price changes"
          onRowAction={(key) => setOpenId(String(key))}
        >
          <TableHeader>
            <Column isRowHeader>What</Column>
            <Column>Change</Column>
            <Column>Price</Column>
            <Column>Status</Column>
          </TableHeader>
          <TableBody items={adjustments}>
            {(a) => (
              <Row id={a.id}>
                <Cell>{whatOf(a)}</Cell>
                <Cell>{changeOf(a)}</Cell>
                <Cell>
                  <span className="font-semibold whitespace-nowrap tabular-nums">
                    {signed(a.totalCents)}
                  </span>
                </Cell>
                <Cell>{statusBadge[a.status]}</Cell>
              </Row>
            )}
          </TableBody>
        </Table>
      )}
      {open && (
        <AdjustmentDialog
          key={open.id}
          job={job}
          adjustment={open}
          close={() => setOpenId(null)}
        />
      )}
    </Section>
  );
}

// One Adjustment, opened: what happened, then what can be done to it, in
// this one dialog (never a dialog on a dialog). An increase to review is
// proposed to the Client or dismissed; one that counts has its price
// corrected, or is removed, after a second look.
function AdjustmentDialog({
  job,
  adjustment: a,
  close,
}: {
  job: OfficeJob;
  adjustment: AdjustmentView;
  close: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  return (
    <Dialog
      title={removing ? `Remove ${whatOf(a)}?` : whatOf(a)}
      role={removing ? "alertdialog" : "dialog"}
      isOpen
      isDismissable={!removing}
      onOpenChange={(isOpen) => !isOpen && close()}
    >
      {removing ? (
        <ConfirmRemove job={job} adjustment={a} close={close} />
      ) : (
        <>
          <div>{statusBadge[a.status]}</div>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold">What happened</dt>
            <dd>{fullChangeOf(a)}</dd>
            <dt className="font-semibold">The cleaner said</dt>
            <dd>"{a.reason}"</dd>
            {a.officeReason && (
              <>
                <dt className="font-semibold">The office said</dt>
                <dd>{a.officeReason}</dd>
              </>
            )}
            <dt className="font-semibold">Price</dt>
            <dd>
              {signed(a.totalCents)} with tax
              {a.status !== "reported" &&
                a.priceCents !== a.workedOutCents &&
                ` (worked out at ${formatMoney(Math.abs(a.workedOutCents))} before tax)`}
            </dd>
            {a.lapsesAt && (
              <>
                <dt className="font-semibold">Answer by</dt>
                <dd>{formatDate(a.lapsesAt)}, or it isn't added</dd>
              </>
            )}
          </dl>
          {a.status === "reported" ? (
            <ReviewForm job={job} adjustment={a} close={close} />
          ) : counts(a) ? (
            <CorrectForm
              job={job}
              adjustment={a}
              close={close}
              remove={() => setRemoving(true)}
            />
          ) : (
            <Actions>
              <Button variant="quiet" onPress={() => setRemoving(true)}>
                Remove
              </Button>
            </Actions>
          )}
        </>
      )}
    </Dialog>
  );
}

// an increase the Cleaner reported: propose it to the Client, at its
// worked-out price or another, or dismiss it
function ReviewForm({
  job,
  adjustment,
  close,
}: {
  job: OfficeJob;
  adjustment: AdjustmentView;
  close: () => void;
}) {
  const action = useAction("It wasn't saved. Please try again.");
  const path = `/api/jobs/${job.id}/adjustments/${adjustment.id}`;
  return (
    <>
      <p className="text-sm text-fg-muted">
        From the quote's prices, it's {formatMoney(adjustment.workedOutCents)}{" "}
        before tax. We email the client to approve it, and it's only added if
        they do.
      </p>
      <PriceForm
        label="Price before tax"
        initialCents={adjustment.workedOutCents}
        needsReason={(cents) => cents !== adjustment.workedOutCents}
        fieldErrors={action.fieldErrors}
        submitLabel="Send to the client"
        isPending={action.isPending}
        problem={action.problem}
        onCancel={close}
        onSubmit={(priceCents, reason) =>
          void action
            .run(
              () =>
                postJson(
                  `${path}/propose`,
                  priceCents === adjustment.workedOutCents
                    ? {}
                    : { priceCents, reason },
                ),
              "Sent to the client",
            )
            .then((ok) => ok && close())
        }
        extra={
          <Button
            variant="quiet"
            onPress={() =>
              void action
                .run(() => postJson(`${path}/dismiss`, {}), "Dismissed")
                .then((ok) => ok && close())
            }
          >
            Dismiss
          </Button>
        }
      />
    </>
  );
}

// where a change to a Completed Job's price goes: charged or refunded now,
// or on the Client's next weekly Bill (ADR-0016)
const settledHow = (job: OfficeJob) =>
  job.weeklyBill
    ? "goes on the client's next bill"
    : "is charged or refunded straight away";

// an Adjustment that counts: change its price, charging or refunding the
// difference, or remove it
function CorrectForm({
  job,
  adjustment,
  close,
  remove,
}: {
  job: OfficeJob;
  adjustment: AdjustmentView;
  close: () => void;
  remove: () => void;
}) {
  const action = useAction("It wasn't corrected. Please try again.");
  return (
    <>
      <p className="text-sm text-fg-muted">
        {adjustment.status === "approved"
          ? "The client approved this price, so it can only be lowered."
          : "This takes the price off the job."}{" "}
        A correction {settledHow(job)}.
      </p>
      <PriceForm
        label={
          adjustment.priceCents < 0
            ? "Amount taken off, before tax"
            : "Price before tax"
        }
        initialCents={Math.abs(adjustment.priceCents)}
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
                patchJson(`/api/jobs/${job.id}/adjustments/${adjustment.id}`, {
                  priceCents,
                  reason,
                }),
              "Price change corrected",
            )
            .then((ok) => ok && close())
        }
        extra={
          <Button variant="quiet" onPress={remove}>
            Remove
          </Button>
        }
      />
    </>
  );
}

// removing an Adjustment, once more in the same dialog
function ConfirmRemove({
  job,
  adjustment,
  close,
}: {
  job: OfficeJob;
  adjustment: AdjustmentView;
  close: () => void;
}) {
  const action = useAction("It wasn't removed. Please try again.");
  return (
    <>
      <p>
        If it changed the price, the difference {settledHow(job)}, and we email
        the client.
      </p>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={close}>
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
                "Price change removed",
              )
              .then((ok) => ok && close())
          }
        >
          Remove
        </Button>
      </Actions>
    </>
  );
}

export function UndoCompletion({ job }: { job: OfficeJob }) {
  const action = useAction("It wasn't undone. Please try again.");
  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <Undo2 aria-hidden size={16} />
        Mark not done
      </Button>
      <Dialog title="Mark this job not done?" role="alertdialog">
        {({ close }) => (
          <>
            <p>
              For a job marked done by mistake. It goes back to booked, its
              price changes are removed, and{" "}
              {job.weeklyBill
                ? "what its bills charged comes off the client's next bill"
                : "everything paid except the deposit is refunded"}
              . We email the client, and the cleaner can mark it done again.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() =>
                  void action
                    .run(
                      () => deleteJson(`/api/jobs/${job.id}/completion`),
                      "Marked not done",
                    )
                    .then((ok) => ok && close())
                }
              >
                Mark not done
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
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
          <dt className="font-semibold">Price changes</dt>
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
      {payment.billedCents !== 0 && (
        <>
          <dt className="font-semibold">On weekly bills</dt>
          <dd>{formatMoney(payment.billedCents)}</dd>
        </>
      )}
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
  const action = useAction("It wasn't tried again. Please try again.");
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="text"
        size="sm"
        isPending={action.isPending}
        onPress={() =>
          void action.run(
            () => postJson(`/api/jobs/${job.id}/balance/retry`),
            "Payment taken",
          )
        }
      >
        <CreditCard aria-hidden size={16} />
        Try the payment again
      </Button>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
    </div>
  );
}
