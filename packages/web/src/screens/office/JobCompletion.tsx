import { formats, messages } from "@empire-cleaning/models";
import { useState, type ReactNode } from "react";
import {
  CreditCard,
  Undo2,
  ClipboardList,
  MessageSquareText,
  Building2,
  Banknote,
  CalendarClock,
  Receipt,
  CircleAlert,
  FileText,
  Files,
} from "lucide-react";
import type {
  AdjustmentStatus,
  AdjustmentView,
  Condition,
  OfficeJob,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  Form,
  Cell,
  Column,
  Row,
  Notice,
  NumberField,
  Section,
  StatusBadge,
  Table,
  TableBody,
  TableHeader,
  TextField,
  Fact,
  Facts,
  Fold,
  Link,
  List,
  ListItem,
  type DialogState,
  type PageAction,
  Card,
  useWide,
} from "@empire-cleaning/ui";
import { deleteJson, patchJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { dollars, formatHours } from "../format.ts";
import { ConditionField } from "./PropertyFields.tsx";

const { formatDate, formatMoney } = formats.en;

const { feeName } = messages.en;

// a price change the Cleaner reported, waiting on the Office: the Job's
// badge and its row's both say so
export const TO_REVIEW = "To review";

const statusBadge: Record<AdjustmentStatus, ReactNode> = {
  applied: <StatusBadge tone="success">Added</StatusBadge>,
  reported: <StatusBadge tone="warning">{TO_REVIEW}</StatusBadge>,
  dismissed: <StatusBadge>Dismissed</StatusBadge>,
  proposed: <StatusBadge tone="info">Waiting on the client</StatusBadge>,
  approved: <StatusBadge tone="success">Approved</StatusBadge>,
  declined: <StatusBadge>Declined</StatusBadge>,
  lapsed: <StatusBadge>Not answered</StatusBadge>,
};

// a Job that won't happen: cancelled, or the crew couldn't get in
export const wontHappen = (job: {
  status: OfficeJob["status"];
}): job is { status: "cancelled" | "no_access" } =>
  job.status === "cancelled" || job.status === "no_access";

// a Job's fee by what it's for, "Late cancellation fee": only a Job that
// won't happen has one (balance.ts)
export const feeNameOf = (job: { status: OfficeJob["status"] }) =>
  wontHappen(job) ? feeName[job.status] : "Fee";

// the price changes the Cleaner reported that the Office hasn't reviewed
export const toReviewOf = (job: OfficeJob) =>
  job.completion?.adjustments.filter((a) => a.status === "reported") ?? [];

// Office Staff correct the condition the Cleaner reported, which is the
// home's too, opened from the Job's header
export function CorrectCondition({
  job,
  ...state
}: { job: OfficeJob } & DialogState) {
  const reported = job.completion!.condition;
  const [condition, setCondition] = useState<Condition>(reported);
  const action = useAction("The condition wasn't saved. Please try again.");
  return (
    <Dialog
      title="Correct the condition"
      {...state}
      onOpenChange={(isOpen) => {
        // each time it opens, it starts from what's recorded
        if (isOpen) setCondition(reported);
        state.onOpenChange(isOpen);
      }}
    >
      {({ close }) => (
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            void action
              .run(
                () =>
                  patchJson(`/api/jobs/${job.id}/completion`, { condition }),
                "Condition corrected",
              )
              .then((ok) => ok && close());
          }}
        >
          <ConditionField value={condition} onChange={setCondition} />
          <p className="text-sm text-fg-muted">
            It's the place's condition too, for future quotes.
          </p>
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
          <Actions>
            <Button variant="quiet" onPress={close}>
              Cancel
            </Button>
            <Button type="submit" isPending={action.isPending}>
              Save
            </Button>
          </Actions>
        </Form>
      )}
    </Dialog>
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
export const whatOf = (a: AdjustmentView) =>
  a.kind === "extra_time" ? "More time" : a.addOnName!;

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
 * The Adjustments the Cleaner reported or the Office made (WEB-6), a part
 * of their own after How it went, one row each: what, what happened, its
 * price and status, a Table from md and rows on a phone (docs/ux.md, an
 * Office list), the status under the rest. A row opens the Adjustment,
 * where Office Staff review an increase, or correct or remove one.
 */
export function Adjustments({ job }: { job: OfficeJob }) {
  const adjustments = job.completion?.adjustments ?? [];
  const wide = useWide();
  const [openId, setOpenId] = useState<string | null>(null);
  // the latest, once an action reloads the Job; gone if it was removed
  const open = adjustments.find((a) => a.id === openId);
  if (adjustments.length === 0) return null;

  return (
    <Section title="Price changes">
      {!wide ? (
        <List
          aria-label="Price changes"
          items={adjustments}
          onAction={(key) => setOpenId(String(key))}
        >
          {(a) => (
            <ListItem
              id={a.id}
              title={whatOf(a)}
              description={`${changeOf(a)}, ${signed(a.totalCents)}`}
              end={statusBadge[a.status]}
            />
          )}
        </List>
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
          isOpen
          onOpenChange={(isOpen) => !isOpen && setOpenId(null)}
        />
      )}
    </Section>
  );
}

// One Adjustment, opened: what happened, then what can be done to it, in
// this one dialog (never a dialog on a dialog). An increase to review is
// proposed to the Client or dismissed; one that counts has its price
// corrected, or is removed, after a second look. Opened from its row, or
// as the page's Review
export function AdjustmentDialog({
  job,
  adjustment: a,
  isOpen,
  onOpenChange,
}: {
  job: OfficeJob;
  adjustment: AdjustmentView;
} & DialogState) {
  const [removing, setRemoving] = useState(false);
  const close = () => {
    setRemoving(false);
    onOpenChange(false);
  };
  return (
    <Dialog
      title={removing ? `Remove ${whatOf(a)}?` : whatOf(a)}
      role={removing ? "alertdialog" : "dialog"}
      isOpen={isOpen}
      isDismissable={!removing}
      onOpenChange={(open) => !open && close()}
    >
      {removing ? (
        <ConfirmRemove job={job} adjustment={a} close={close} />
      ) : (
        <>
          <div>{statusBadge[a.status]}</div>
          <Facts>
            <Fact
              icon={ClipboardList}
              label="What happened"
              value={fullChangeOf(a)}
            />
            <Fact
              icon={MessageSquareText}
              label="The cleaner said"
              value={`"${a.reason}"`}
            />
            {a.officeReason && (
              <Fact
                icon={Building2}
                label="The office said"
                value={a.officeReason}
              />
            )}
            <Fact
              icon={Banknote}
              label="Price"
              value={`${signed(a.totalCents)} with tax`}
              line={
                a.status !== "reported" && a.priceCents !== a.workedOutCents
                  ? `Worked out at ${formatMoney(Math.abs(a.workedOutCents))} before tax`
                  : undefined
              }
            />
            {a.lapsesAt && (
              <Fact
                icon={CalendarClock}
                label="Answer by"
                value={formatDate(a.lapsesAt)}
                line="Answer by then, or it isn't added"
              />
            )}
          </Facts>
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

// for a Job marked done by mistake: opened from the Job's header
export function UndoCompletion({
  job,
  ...state
}: { job: OfficeJob } & DialogState) {
  const action = useAction("It wasn't undone. Please try again.");
  return (
    <Dialog title="Mark this job not done?" role="alertdialog" {...state}>
      {({ close }) => (
        <>
          <p>
            For a job marked done by mistake. It goes back to booked, its price
            changes are removed, and{" "}
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
  );
}

// What a Job's money comes to, one line a fact (WEB-6, #493): its price,
// "Price" before the day and after it ("Price so far" while a price change
// waits, as it isn't in it yet), said with how it was paid once paid in
// full; else what's paid, named the deposit when that's all it is; each
// weekly Bill it's on, linked; what's still to go on a Bill; refunded;
// still owed or to refund; how it's worked out, folded. Once it didn't
// happen, its fee and what was refunded. Nothing, no part. Each charge is
// in its History, and a failed one an alert above
export function JobMoney({ job }: { job: OfficeJob }) {
  const payment = job.payment;
  if (!payment) return null;
  const { paidCents: paid, owedCents: owed } = payment;
  // how it was paid, when the card is known: " by Visa ending 4242"
  const by = payment.paymentMethod ? ` by ${payment.paymentMethod}` : "";
  const refunded = payment.charges.reduce((sum, c) => sum + c.refundedCents, 0);
  // what it came to once over: its price, or what not happening cost
  const due = job.completion
    ? payment.totalCents
    : ((job.cancellation ?? job.noAccess)?.feeCents ?? 0);
  const fee = feeNameOf(job);
  // a fee with no Charge of its own was kept from the Deposit
  const kept = !payment.charges.some((c) => c.kind === "fee");
  // a price change still waiting isn't in the price yet: it says so, so a
  // paid price doesn't read as the last word (those that count are in it)
  const waiting = job.completion?.adjustments.some(
    (a) => a.status === "reported" || a.status === "proposed",
  );
  const price = waiting ? "Price so far" : "Price";
  // what's paid, by what it was: the Deposit, while that's all that's kept
  const paidAs = payment.charges
    .filter((c) => c.amountCents > c.refundedCents)
    .every((c) => c.kind === "deposit")
    ? "Deposit, paid"
    : "Paid";
  // what's still to go on a weekly Bill: its week's before that's made,
  // the next one's after (docs/ux-log.md, #244)
  const toBill = job.weeklyBill && owed > 0 && !payment.unpaid;
  const dueFact = (line?: string) =>
    job.completion ? (
      <Fact
        key="due"
        icon={Receipt}
        label="Price"
        value={formatMoney(due)}
        line={line ?? `${price}, tax included`}
      />
    ) : (
      <Fact
        key="due"
        icon={Receipt}
        label="Fee"
        value={formatMoney(due)}
        line={line ?? fee}
      />
    );
  const facts =
    job.status === "booked"
      ? [
          <Fact
            key="price"
            icon={Receipt}
            label="Price"
            value={formatMoney(payment.totalCents)}
            line="Price, tax included"
          />,
          paid > 0 && (
            <Fact
              key="deposit"
              icon={CreditCard}
              label="Deposit"
              value={formatMoney(paid)}
              line={`Deposit, paid${by}`}
            />
          ),
        ]
      : [
          // paid in full, it's said once: what it came to, and how it was
          // paid
          due > 0 && due === paid
            ? dueFact(
                job.completion
                  ? `${price}, paid${by}`
                  : kept
                    ? `${fee}, kept from the deposit`
                    : `${fee}, paid${by}`,
              )
            : due > 0 && dueFact(),
          paid > 0 && paid !== due && (
            <Fact
              key="paid"
              icon={CreditCard}
              label="Paid"
              value={formatMoney(paid)}
              line={`${paidAs}${by}`}
            />
          ),
          ...payment.bills
            .filter((b) => b.cents !== b.refundedCents)
            .map((b) => (
              <Fact
                key={b.id}
                icon={Files}
                label="On a weekly bill"
                value={formatMoney(b.cents - b.refundedCents)}
                line={
                  <Link
                    href={linkTo({
                      to: "/office/bills/$billId",
                      params: { billId: b.id },
                    })}
                  >
                    On bill {b.number}
                  </Link>
                }
              />
            )),
          refunded > 0 && (
            <Fact
              key="refunded"
              icon={Undo2}
              label="Refunded"
              value={formatMoney(refunded)}
              line={job.cancellation ? "Deposit refunded" : "Refunded"}
            />
          ),
          toBill ? (
            <Fact
              key="owed"
              icon={Files}
              label="To bill"
              value={formatMoney(owed)}
              line={
                payment.bills.length === 0
                  ? "Goes on that week's bill"
                  : "Goes on the next bill"
              }
            />
          ) : (
            owed !== 0 && (
              <Fact
                key="owed"
                icon={owed > 0 ? CircleAlert : Undo2}
                label={owed > 0 ? "Still owed" : "To refund"}
                value={formatMoney(Math.abs(owed))}
              />
            )
          ),
        ];
  const shown = facts.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <Section title="Money">
      <Card>
        <Facts>{shown}</Facts>
        {job.completion && payment.totalCents !== payment.quotedCents && (
          <Fold label="How it's worked out">
            <Facts>
              <Fact
                icon={FileText}
                label="Quoted"
                value={formatMoney(payment.quotedCents)}
              />
              {payment.adjustmentsCents !== 0 && (
                <Fact
                  icon={ClipboardList}
                  label="Price changes"
                  value={formatMoney(payment.adjustmentsCents)}
                />
              )}
            </Facts>
          </Fold>
        )}
      </Card>
    </Section>
  );
}

// charges what a Job owes again, after a failed charge: a Balance, or the
// fee of a plan Job that didn't happen. The page's next step while it's
// Unpaid; a retry that fails is a Toast (WEB-5)
export function useRetryCharge(job: OfficeJob): PageAction {
  const action = useAction("It wasn't tried again. Please try again.", {
    toast: true,
  });
  return {
    label: "Try the payment again",
    icon: CreditCard,
    isPending: action.isPending,
    onAction: () =>
      void action.run(
        () => postJson(`/api/jobs/${job.id}/balance/retry`),
        "Payment taken",
      ),
  };
}
