import { useId, type ReactNode } from "react";
import { useLoaderData } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarSync,
  CirclePlus,
  Clock,
  PiggyBank,
  Receipt as ReceiptIcon,
} from "lucide-react";
import type {
  AdjustmentView,
  CancellationTerms,
  ClientJobDetail,
  JobPayment,
} from "@empire-cleaning/models";
import {
  ActionRow,
  Actions,
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  Dialog,
  DialogTrigger,
  Heading,
  IconTile,
  Link,
  Notice,
  Section,
  StatusBadge,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { linkTo } from "../../links.ts";
import { PickAvailableTime } from "../AvailabilityPicker.tsx";
import { ChooseNewTime, costForClient } from "../RescheduleParts.tsx";
import {
  addressOf,
  adjustmentLabel,
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
} from "../format.ts";
import { Fact } from "../Fact.tsx";

// one of the Client's Jobs, from the links in their emails: while it's to come,
// moving or cancelling it; once Completed, its receipt; any extra work proposed to them
// to approve or decline; if it couldn't be charged, the way to pay; and if
// it was Cancelled (Skipped, on a plan) or No Access, what it cost
export function PortalJob() {
  const job = useLoaderData({ from: "/portal/jobs/$jobId" });
  const { completion } = job;
  const booked = !completion && !job.cancellation && !job.noAccess;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Your cleans", href: linkTo({ to: "/portal/cleans" }) },
            { label: formatDateTime(job.startsAt) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{job.serviceName}</Heading>
          {completion?.payment.unpaid ? (
            <StatusBadge tone="danger">Unpaid</StatusBadge>
          ) : completion ? (
            <StatusBadge tone="success">Done</StatusBadge>
          ) : job.cancellation ? (
            <StatusBadge>
              {job.servicePlanId && job.cancellation.by === "client"
                ? "Skipped"
                : "Cancelled"}
            </StatusBadge>
          ) : job.noAccess ? (
            <StatusBadge tone="danger">No Access</StatusBadge>
          ) : (
            <StatusBadge tone="info">Booked</StatusBadge>
          )}
        </div>
        <p className="text-fg-muted">{addressOf(job.property)}</p>
      </div>

      {/* what's needed of them first, before what the clean is */}
      {job.payment.unpaid && <Unpaid payment={job.payment} />}
      {completion?.adjustments
        .filter((a) => a.status === "proposed")
        .map((a) => (
          <Proposal key={a.id} job={job} adjustment={a} />
        ))}

      <Section title="Clean details">
        <Card className="gap-0">
          <Part>
            <JobDetails job={job} />
          </Part>
          {job.cancellation ? (
            <>
              <Cancelled job={job} />
            </>
          ) : job.noAccess ? (
            <>
              <NoAccess job={job} />
            </>
          ) : completion ? (
            <>
              <Receipt job={job} />
            </>
          ) : null}
        </Card>
      </Section>

      {booked && (
        <>
          <Reschedule job={job} />
          {job.cancelTerms && <Cancel job={job} terms={job.cancelTerms} />}
        </>
      )}
    </div>
  );
}

// The clean as its Client reads it, as their plan's page does: when, large,
// then its facts in even columns across, each an icon, a value and what the
// value is. (UX pass, #96)
function JobDetails({ job }: { job: ClientJobDetail }) {
  const { payment } = job;
  const deposit = payment.charges.find((c) => c.kind === "deposit");
  const booked = !job.completion && !job.cancellation && !job.noAccess;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <IconTile icon={CalendarClock} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-fg-muted">
            {job.servicePlanId ? "Part of your Service Plan" : "One-off clean"}
          </p>
          <p className="text-xl font-semibold text-fg">
            {formatDateTime(job.startsAt)}
          </p>
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          icon={ReceiptIcon}
          label="Price"
          value={formatMoney(payment.totalCents)}
          line="Price, tax included"
        />
        <Fact
          icon={Clock}
          label="On site"
          value={`About ${formatHours(job.hoursOnSite)}`}
          line={`On site, ${job.crewSize === 1 ? "1 cleaner" : `${job.crewSize} cleaners`}`}
        />
        <Fact
          icon={CirclePlus}
          label="Extras"
          value={job.addOns.length > 0 ? job.addOns.join(", ") : "None"}
        />
        {job.servicePlanId ? (
          <Fact
            icon={CalendarSync}
            label="Service Plan"
            value={
              <Link
                href={linkTo({
                  to: "/portal/plans/$planId",
                  params: { planId: job.servicePlanId },
                })}
              >
                See your plan
              </Link>
            }
            line="Its Deposit is held there"
          />
        ) : (
          <Fact
            icon={PiggyBank}
            label="Deposit"
            value={deposit ? formatMoney(deposit.amountCents) : "None"}
            line={deposit ? "Deposit, comes off the price" : "Deposit"}
          />
        )}
      </dl>
      {booked && (
        <p className="text-sm text-fg-muted">
          We'll email a reminder the day before.
        </p>
      )}
    </div>
  );
}

// One part of the clean's card, under a rule from the one before: its
// title, what it says, and the Button(s) it leads to, kept right
function Part({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  const head = title && (
    <div className="flex flex-col gap-1">
      <Heading level={3} size={4} id={headingId} className="text-fg">
        {title}
      </Heading>
      {description && <p className="text-sm text-fg-muted">{description}</p>}
    </div>
  );
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className="flex flex-col gap-3 border-border py-5 first:pt-0 last:pb-0 not-first:border-t"
    >
      {actions ? (
        <ActionRow actions={actions}>
          {head}
          {children}
        </ActionRow>
      ) : (
        <>
          {head}
          {children}
        </>
      )}
    </section>
  );
}

// An action of its own under the clean's details, as on the plan's page: its
// title outside the card, the card's text and its Button on one row
function ActionCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section title={title}>
      <Card>
        <ActionRow actions={actions}>{children}</ActionRow>
      </Card>
    </Section>
  );
}

// The Client cancels a clean still to come, seeing first what it costs: free
// until 24 hours before, then a Late Cancellation that keeps the Deposit. A
// plan Job is skipped instead, and the plan carries on; its late fee is the
// plan's Deposit amount, charged, as the plan's own Deposit stays held.
function Cancel({
  job,
  terms,
}: {
  job: ClientJobDetail;
  terms: CancellationTerms;
}) {
  const onPlan = job.servicePlanId !== null;
  // what it costs may have changed since the page loaded
  const action = useAction(
    `Your clean wasn't ${onPlan ? "skipped" : "cancelled"}. Please try again.`,
    { reloadOnFailure: true },
  );
  const fee = formatMoney(terms.feeCents);
  const doing = onPlan ? "skipping" : "cancelling";

  const cost = onPlan
    ? terms.feeCents > 0 && !terms.late
      ? `The ${fee} fee for an earlier Late Reschedule is charged now, and skipping costs nothing more.`
      : terms.feeCents > 0
        ? `A ${fee} Late Cancellation fee, the same as your plan's Deposit, is charged to your card. Your Deposit stays held.`
        : "There's no charge."
    : terms.feeCents > 0 && !terms.late
      ? `Your ${fee} Deposit was already kept as the fee for a Late Reschedule, so cancelling costs nothing more.`
      : terms.feeCents > 0
        ? `Your ${fee} Deposit is kept as the Late Cancellation fee.`
        : terms.refundCents > 0
          ? `There's no charge, and we'll refund your ${formatMoney(terms.refundCents)} Deposit.`
          : "There's no charge.";

  const cancel = async (close: () => void) => {
    const ok = await action.run(
      () =>
        postJson(`/api/jobs/mine/${job.id}/cancel`, {
          feeCents: terms.feeCents,
        }),
      onPlan ? "Your clean is skipped" : "Your clean is cancelled",
    );
    if (ok) close();
  };

  return (
    <ActionCard
      title={onPlan ? "Need to skip this clean?" : "Need to cancel?"}
      actions={
        <DialogTrigger>
          <Button variant="secondary">
            {onPlan ? "Skip this clean" : "Cancel clean"}
          </Button>
          <Dialog
            title={onPlan ? "Skip this clean?" : "Cancel your clean?"}
            role="alertdialog"
          >
            {({ close }) => (
              <>
                <p>
                  {job.serviceName} at {addressOf(job.property)},{" "}
                  {formatDateTime(job.startsAt)}.
                </p>
                <p>
                  <strong>{cost}</strong>
                </p>
                {action.problem && (
                  <Notice tone="danger">{action.problem}</Notice>
                )}
                <Actions>
                  <Button variant="quiet" onPress={close}>
                    Keep my clean
                  </Button>
                  <Button
                    variant="danger"
                    isPending={action.isPending}
                    onPress={() => void cancel(close)}
                  >
                    {onPlan ? "Skip this clean" : "Cancel clean"}
                  </Button>
                </Actions>
              </>
            )}
          </Dialog>
        </DialogTrigger>
      }
    >
      {terms.late ? (
        <p>
          It's less than 24 hours until your clean, so {doing} it now is a Late
          Cancellation. {cost}
        </p>
      ) : terms.feeCents > 0 ? (
        <p>{cost}</p>
      ) : onPlan ? (
        <p>
          You can skip it for free until{" "}
          <strong>{formatDateTime(terms.freeUntil)}</strong>. After that, it's a
          Late Cancellation, with a fee the same as your plan's Deposit.
        </p>
      ) : (
        <p>
          You can cancel for free until{" "}
          <strong>{formatDateTime(terms.freeUntil)}</strong>
          {terms.refundCents > 0 &&
            `, and we'll refund your ${formatMoney(terms.refundCents)} Deposit`}
          . After that, it's a Late Cancellation and the Deposit is kept as the
          fee.
        </p>
      )}
      {onPlan && (
        <p>Only this clean is skipped: your Service Plan carries on.</p>
      )}
    </ActionCard>
  );
}

// The Client asks to move a clean still to come, seeing first what it costs
// (ADR-0010); while the request is pending, they can withdraw it
function Reschedule({ job }: { job: ClientJobDetail }) {
  const action = useAction("Your request wasn't withdrawn. Please try again.");
  const request = job.rescheduleRequest;
  const onPlan = job.servicePlanId !== null;

  if (request?.status === "pending") {
    return (
      <ActionCard
        title="Moving your clean"
        actions={
          <Button
            variant="secondary"
            isPending={action.pending === "withdraw"}
            onPress={() =>
              void action.run(
                () =>
                  postJson(
                    `/api/jobs/mine/${job.id}/reschedule-request/withdraw`,
                  ),
                "Request withdrawn",
                "withdraw",
              )
            }
          >
            Withdraw request
          </Button>
        }
      >
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <p>
          You've asked to move it to{" "}
          <strong>{formatDateTime(request.startsAt)}</strong>. That time is held
          for you while the Office confirms it. Until then, your clean stays
          booked for {formatDateTime(job.startsAt)}.
        </p>
        <p>{costForClient(request.cost, request.feeCents, onPlan)}</p>
      </ActionCard>
    );
  }

  const terms = job.rescheduleTerms;
  if (!terms) return null;
  return (
    <ActionCard
      title="Need another time?"
      actions={
        <ChooseNewTime
          job={job}
          terms={terms}
          base={`/api/jobs/mine/${job.id}`}
          label="Choose a new time"
          describeCost={(cost, feeCents) =>
            costForClient(cost, feeCents, onPlan)
          }
          done="Request sent"
          Picker={PickAvailableTime}
        />
      }
    >
      {request?.status === "turned_down" && (
        <Notice>
          We couldn't move it to {formatDateTime(request.startsAt)}.
          {request.reason && ` ${request.reason}`}
        </Notice>
      )}
      {terms.cost === "free" ? (
        <p>
          You can move it for free until{" "}
          <strong>{formatDateTime(terms.freeUntil)}</strong>. After that, it's a
          Late Reschedule, and only one per clean is free.
        </p>
      ) : (
        <p>{costForClient(terms.cost, terms.feeCents, onPlan)}</p>
      )}
    </ActionCard>
  );
}

// what's been refunded so far, and what's still on its way
function Refund({ payment }: { payment: JobPayment }) {
  const refunded = payment.charges.reduce((sum, c) => sum + c.refundedCents, 0);
  const card = payment.paymentMethod ?? "card";
  return (
    <>
      {refunded > 0 && (
        <p>
          We've refunded {formatMoney(refunded)} to your {card}. It can take a
          few days to reach you.
        </p>
      )}
      {payment.owedCents < 0 && (
        <p>
          We're refunding {formatMoney(-payment.owedCents)} to your {card}.
        </p>
      )}
    </>
  );
}

// after a clean that didn't happen: a plan carries on; otherwise, book again
function WhatNext({ job }: { job: ClientJobDetail }) {
  return job.servicePlanId ? (
    <ButtonLink
      href={linkTo({
        to: "/portal/plans/$planId",
        params: { planId: job.servicePlanId },
      })}
    >
      See your Service Plan
    </ButtonLink>
  ) : (
    <ButtonLink href={linkTo({ to: "/portal/request" })}>
      Request a Quote
    </ButtonLink>
  );
}

// a plan Job the Client skipped: its fee, if late, was charged as its own,
// and the plan's Deposit stays held
function skippedFee(
  cancellation: NonNullable<ClientJobDetail["cancellation"]>,
) {
  const fee = formatMoney(cancellation.feeCents);
  return cancellation.late && cancellation.feeCents > 0
    ? `It was skipped less than 24 hours before it was due, so it's a Late Cancellation, with a ${fee} fee: the same as your plan's Deposit, which stays held.`
    : cancellation.feeCents > 0
      ? `The ${fee} fee for an earlier Late Reschedule was still to pay.`
      : "There was no charge for skipping it.";
}

function Cancelled({ job }: { job: ClientJobDetail }) {
  const cancellation = job.cancellation!;
  const skipped = job.servicePlanId !== null && cancellation.by === "client";
  return (
    <Part
      title={skipped ? "Skipped" : "Cancelled"}
      description={`${skipped ? "Skipped" : "Cancelled"} ${formatDateTime(cancellation.cancelledAt)}.`}
      actions={<WhatNext job={job} />}
    >
      {cancellation.by === "empire" ? (
        <p>
          We're sorry: we had to cancel this clean.
          {cancellation.reason && ` ${cancellation.reason}`} You haven't been
          charged anything for it.
        </p>
      ) : skipped ? (
        <p>{skippedFee(cancellation)}</p>
      ) : cancellation.late && cancellation.feeCents > 0 ? (
        <p>
          It was cancelled less than 24 hours before it was due, so your{" "}
          {formatMoney(cancellation.feeCents)} Deposit was kept as the Late
          Cancellation fee.
        </p>
      ) : cancellation.feeCents > 0 ? (
        <p>
          Your {formatMoney(cancellation.feeCents)} Deposit was already kept as
          the fee for a Late Reschedule, so there was nothing more to pay.
        </p>
      ) : (
        <p>There was no charge for cancelling.</p>
      )}
      {job.servicePlanId && <p>Your Service Plan carries on as usual.</p>}
      <Refund payment={cancellation.payment} />
    </Part>
  );
}

function NoAccess({ job }: { job: ClientJobDetail }) {
  const noAccess = job.noAccess!;
  return (
    <Part title="We couldn't get in" actions={<WhatNext job={job} />}>
      <p>
        Our team came at {formatDateTime(noAccess.recordedAt)}, but couldn't get
        in: "{noAccess.reason}".
      </p>
      {noAccess.feeCents > 0 &&
        (job.servicePlanId ? (
          <p>
            As with a Late Cancellation, there's a{" "}
            {formatMoney(noAccess.feeCents)} fee: the same as your plan's
            Deposit, which stays held.
          </p>
        ) : (
          <p>
            As with a Late Cancellation, your {formatMoney(noAccess.feeCents)}{" "}
            Deposit was kept as the fee.
          </p>
        ))}
      <Refund payment={noAccess.payment} />
      <p>
        {job.servicePlanId
          ? "Your Service Plan carries on. Before your next clean, please "
          : "Before booking again, please "}
        <Link
          href={linkTo({
            to: "/portal/properties/$propertyId",
            params: { propertyId: job.property.id },
          })}
        >
          check your Access Instructions
        </Link>
        .
      </p>
    </Part>
  );
}

// A charge that failed: what it was, and the way to fix it. Saving a card
// tries it again. Red, as it's already late. (UX pass, #96)
function Unpaid({ payment }: { payment: JobPayment }) {
  return (
    <Notice
      tone="danger"
      action={
        <ButtonLink
          variant="danger-text"
          href={linkTo({ to: "/portal/payment-method" })}
        >
          Update Payment Method
        </ButtonLink>
      }
    >
      <p>
        <strong>Payment needed.</strong> We couldn't charge{" "}
        {formatMoney(payment.owedCents)} to your{" "}
        {payment.paymentMethod ?? "card"}. We'll try again as soon as you save a
        card.
      </p>
    </Notice>
  );
}

// Extra work the Office has proposed, which is only charged if they
// approve: a yellow alert to answer it, its one action opening the answer.
// (UX pass, #96)
function Proposal({
  job,
  adjustment,
}: {
  job: ClientJobDetail;
  adjustment: AdjustmentView;
}) {
  const action = useAction("Your answer wasn't saved. Please try again.");
  const path = `/api/jobs/mine/${job.id}/adjustments/${adjustment.id}`;
  const answer = async (to: "approve" | "decline", close: () => void) => {
    const ok = await action.run(
      () => postJson(`${path}/${to}`),
      to === "approve" ? "Approved" : "Declined",
      to,
    );
    if (ok) close();
  };

  return (
    <Notice
      tone="warning"
      action={
        <DialogTrigger>
          <Button variant="text">Review</Button>
          <Dialog title="Please approve extra work">
            {({ close }) => (
              <>
                <p>
                  Our team did more than was quoted:{" "}
                  <strong>{adjustmentLabel(adjustment)}</strong> ("
                  {adjustment.reason}").
                  {adjustment.officeReason && ` ${adjustment.officeReason}.`}
                </p>
                <p>
                  It comes to{" "}
                  <strong>{formatMoney(adjustment.totalCents)}</strong>, tax
                  included, charged to your card only if you approve it. If we
                  don't hear from you by {formatDate(adjustment.lapsesAt!)}, we
                  won't charge it.
                </p>
                {action.problem && (
                  <Notice tone="danger">{action.problem}</Notice>
                )}
                <Actions>
                  <Button
                    variant="quiet"
                    isPending={action.pending === "decline"}
                    onPress={() => void answer("decline", close)}
                  >
                    Decline
                  </Button>
                  <Button
                    isPending={action.pending === "approve"}
                    onPress={() => void answer("approve", close)}
                  >
                    Approve {formatMoney(adjustment.totalCents)}
                  </Button>
                </Actions>
              </>
            )}
          </Dialog>
        </DialogTrigger>
      }
    >
      <p>
        <strong>Please approve extra work.</strong>{" "}
        {adjustmentLabel(adjustment)}, {formatMoney(adjustment.totalCents)}.
        Please answer by {formatDate(adjustment.lapsesAt!)}.
      </p>
    </Notice>
  );
}

const chargeLabel = { deposit: "Deposit", balance: "Charged", fee: "Fee" };

function Receipt({ job }: { job: ClientJobDetail }) {
  const { payment, adjustments, completedAt } = job.completion!;
  const counted = adjustments.filter(
    (a) => a.status === "applied" || a.status === "approved",
  );
  const notCharged = adjustments.filter(
    (a) => a.status === "declined" || a.status === "lapsed",
  );

  return (
    <Part
      title="Your receipt"
      description={`Done ${formatDateTime(completedAt)}. Prices include tax.`}
    >
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
        <dt>Quoted price</dt>
        <dd className="text-end">{formatMoney(payment.quotedCents)}</dd>
        {counted.map((a) => (
          <div key={a.id} className="contents">
            <dt>{adjustmentLabel(a)}</dt>
            <dd className="text-end">{formatMoney(a.totalCents)}</dd>
          </div>
        ))}
        <dt className="font-semibold">Total</dt>
        <dd className="text-end font-semibold">
          {formatMoney(payment.totalCents)}
        </dd>
        {payment.rescheduleFeeCents > 0 && (
          <>
            <dt>
              Late Reschedule fee
              {!job.servicePlanId && " (your Deposit, kept)"}
            </dt>
            <dd className="text-end">
              {formatMoney(payment.rescheduleFeeCents)}
            </dd>
          </>
        )}
        {payment.charges.map((c, i) => (
          <div key={i} className="contents">
            <dt>
              {chargeLabel[c.kind]} {formatDate(c.chargedAt)}
              {c.refundedCents > 0 &&
                `, ${formatMoney(c.refundedCents)} refunded`}
            </dt>
            <dd className="text-end">
              {formatMoney(c.amountCents - c.refundedCents)}
            </dd>
          </div>
        ))}
        <dt className="font-semibold">Paid</dt>
        <dd className="text-end font-semibold">
          {formatMoney(payment.paidCents)}
        </dd>
      </dl>
      {notCharged.length > 0 && (
        <p className="text-sm text-fg-muted">
          Not charged:{" "}
          {notCharged
            .map(
              (a) =>
                `${adjustmentLabel(a)} (${a.status === "declined" ? "you declined it" : "not answered in time"})`,
            )
            .join("; ")}
          .
        </p>
      )}
      {payment.paymentMethod && (
        <p className="text-sm text-fg-muted">
          Charged to your {payment.paymentMethod}.
        </p>
      )}
    </Part>
  );
}
