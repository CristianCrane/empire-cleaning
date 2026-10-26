import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import type {
  AdjustmentView,
  CancellationTerms,
  ClientJobDetail,
  JobPayment,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  Dialog,
  DialogTrigger,
  Heading,
  Link,
  Notice,
  StatusBadge,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { ChooseNewTime, costForClient } from "../RescheduleParts.tsx";
import {
  addressOf,
  adjustmentLabel,
  cleanTypeLabel,
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
} from "../format.ts";

// one of the Client's Jobs, from the links in their emails: while it's to come,
// moving or cancelling it; once Completed, its receipt; any extra work proposed to them
// to approve or decline; if it couldn't be charged, the way to pay; and if
// it was Cancelled or No Access, what happened to their Deposit
export function PortalJob() {
  const job = useLoaderData({ from: "/portal/jobs/$jobId" });
  const { completion } = job;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Home", href: linkTo({ to: "/portal" }) },
            { label: formatDateTime(job.startsAt) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{cleanTypeLabel[job.cleanType]}</Heading>
          {completion?.payment.unpaid ? (
            <StatusBadge tone="danger">Unpaid</StatusBadge>
          ) : completion ? (
            <StatusBadge tone="success">Done</StatusBadge>
          ) : job.cancellation ? (
            <StatusBadge>Cancelled</StatusBadge>
          ) : job.noAccess ? (
            <StatusBadge tone="danger">No Access</StatusBadge>
          ) : (
            <StatusBadge tone="success">Booked</StatusBadge>
          )}
        </div>
        <p className="text-fg-muted">
          {addressOf(job.property)} · {formatDateTime(job.startsAt)}
        </p>
      </div>

      {job.cancellation ? (
        <Cancelled job={job} />
      ) : job.noAccess ? (
        <NoAccess job={job} />
      ) : !completion ? (
        <>
          <Card title="Your clean">
            <p>
              About {formatHours(job.hoursOnSite)} on site, with a crew of{" "}
              {job.crewSize}. We'll email a reminder the day before.
            </p>
          </Card>
          <Reschedule job={job} />
          {job.cancelTerms && <Cancel job={job} terms={job.cancelTerms} />}
        </>
      ) : (
        <>
          {completion.payment.unpaid && (
            <Unpaid job={job} payment={completion.payment} />
          )}
          {completion.adjustments
            .filter((a) => a.status === "proposed")
            .map((a) => (
              <Proposal key={a.id} job={job} adjustment={a} />
            ))}
          <Receipt job={job} />
        </>
      )}
    </div>
  );
}

// The Client cancels a clean still to come, seeing first what it costs: free
// until 24 hours before, then a Late Cancellation that keeps the Deposit
function Cancel({
  job,
  terms,
}: {
  job: ClientJobDetail;
  terms: CancellationTerms;
}) {
  const router = useRouter();
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);

  const cost =
    terms.feeCents > 0 && !terms.late
      ? `Your ${formatMoney(terms.feeCents)} Deposit was already kept as the fee for a Late Reschedule, so cancelling costs nothing more.`
      : terms.feeCents > 0
        ? `Your ${formatMoney(terms.feeCents)} Deposit is kept as the Late Cancellation fee.`
        : terms.refundCents > 0
          ? `There's no charge, and we'll refund your ${formatMoney(terms.refundCents)} Deposit.`
          : "There's no charge.";

  const cancel = async (close: () => void) => {
    setPending(true);
    setProblem(undefined);
    try {
      await postJson(`/api/jobs/mine/${job.id}/cancel`, {
        feeCents: terms.feeCents,
      });
      showToast({ tone: "success", title: "Your clean is cancelled" });
      close();
      await router.invalidate();
    } catch (e) {
      setProblem(
        e instanceof ApiError && e.status === 409
          ? e.message
          : "Your clean wasn't cancelled. Please try again.",
      );
      // what it costs may have changed since the page loaded
      await router.invalidate();
    } finally {
      setPending(false);
    }
  };

  return (
    <Card title="Need to cancel?">
      {terms.late ? (
        <p>
          It's less than 24 hours until your clean, so cancelling now is a Late
          Cancellation. {cost}
        </p>
      ) : terms.feeCents > 0 ? (
        <p>{cost}</p>
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
      <Actions>
        <DialogTrigger>
          <Button variant="secondary">Cancel clean</Button>
          <Dialog title="Cancel your clean?" role="alertdialog">
            {({ close }) => (
              <>
                <p>
                  {cleanTypeLabel[job.cleanType]} at {addressOf(job.property)},{" "}
                  {formatDateTime(job.startsAt)}.
                </p>
                <p>
                  <strong>{cost}</strong>
                </p>
                {problem && <Notice tone="danger">{problem}</Notice>}
                <Actions>
                  <Button variant="secondary" onPress={close}>
                    Keep my clean
                  </Button>
                  <Button
                    variant="danger"
                    isPending={isPending}
                    onPress={() => void cancel(close)}
                  >
                    Cancel clean
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

// The Client asks to move a clean still to come, seeing first what it costs
// (ADR-0010); while the request is pending, they can withdraw it
function Reschedule({ job }: { job: ClientJobDetail }) {
  const action = useJobAction(
    "Your request wasn't withdrawn. Please try again.",
  );
  const request = job.rescheduleRequest;

  if (request?.status === "pending") {
    return (
      <Card title="Moving your clean">
        <p>
          You've asked to move it to{" "}
          <strong>{formatDateTime(request.startsAt)}</strong>. That time is held
          for you while the Office confirms it. Until then, your clean stays
          booked for {formatDateTime(job.startsAt)}.
        </p>
        <p>{costForClient(request.cost, request.feeCents)}</p>
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <Button
            variant="secondary"
            isPending={action.isPending === "withdraw"}
            onPress={() =>
              void action.run(
                "withdraw",
                `/api/jobs/mine/${job.id}/reschedule-request/withdraw`,
                "Request withdrawn",
              )
            }
          >
            Withdraw request
          </Button>
        </Actions>
      </Card>
    );
  }

  const terms = job.rescheduleTerms;
  if (!terms) return null;
  return (
    <Card title="Need another time?">
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
        <p>{costForClient(terms.cost, terms.feeCents)}</p>
      )}
      <Actions>
        <ChooseNewTime
          job={job}
          terms={terms}
          base={`/api/jobs/mine/${job.id}`}
          label="Choose a new time"
          describeCost={costForClient}
          done="Request sent"
        />
      </Actions>
    </Card>
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

const bookAgain = (
  <Actions>
    <ButtonLink href={linkTo({ to: "/portal/request" })}>
      Request a Quote
    </ButtonLink>
  </Actions>
);

function Cancelled({ job }: { job: ClientJobDetail }) {
  const cancellation = job.cancellation!;
  return (
    <Card
      title="Cancelled"
      description={`Cancelled ${formatDateTime(cancellation.cancelledAt)}.`}
    >
      {cancellation.by === "empire" ? (
        <p>
          We're sorry: we had to cancel this clean.
          {cancellation.reason && ` ${cancellation.reason}`} You haven't been
          charged anything for it.
        </p>
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
      <Refund payment={cancellation.payment} />
      {bookAgain}
    </Card>
  );
}

function NoAccess({ job }: { job: ClientJobDetail }) {
  const noAccess = job.noAccess!;
  return (
    <Card title="We couldn't get in">
      <p>
        Our team came at {formatDateTime(noAccess.recordedAt)}, but couldn't get
        in: "{noAccess.reason}".
      </p>
      {noAccess.feeCents > 0 && (
        <p>
          As with a Late Cancellation, your {formatMoney(noAccess.feeCents)}{" "}
          Deposit was kept as the fee.
        </p>
      )}
      <Refund payment={noAccess.payment} />
      <p>
        Before booking again, please{" "}
        <Link href={linkTo({ to: "/portal/details" })}>
          check your Access Instructions
        </Link>
        .
      </p>
      {bookAgain}
    </Card>
  );
}

// runs an action on the Job, then reloads it
const useJobAction = (fallback: string) => {
  const router = useRouter();
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState<string>();

  const run = async (which: string, path: string, done: string) => {
    setPending(which);
    setProblem(undefined);
    try {
      await postJson(path);
      showToast({ tone: "success", title: done });
      await router.invalidate();
    } catch (e) {
      setProblem(
        e instanceof ApiError && e.status === 409 ? e.message : fallback,
      );
    } finally {
      setPending(undefined);
    }
  };
  return { run, problem, isPending };
};

function Unpaid({
  job,
  payment,
}: {
  job: ClientJobDetail;
  payment: JobPayment;
}) {
  const action = useJobAction("We couldn't try again. Please try later.");
  return (
    <Card title="Payment needed">
      <Notice tone="danger">
        We couldn't charge {formatMoney(payment.owedCents)} to your{" "}
        {payment.paymentMethod ?? "card"}. Please update your Payment Method:
        we'll try again as soon as you save it.
      </Notice>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button
          variant="secondary"
          isPending={action.isPending === "retry"}
          onPress={() =>
            void action.run(
              "retry",
              `/api/jobs/mine/${job.id}/balance/retry`,
              "Payment taken",
            )
          }
        >
          Try the same card again
        </Button>
        <ButtonLink href={linkTo({ to: "/portal/payment-method" })}>
          Update Payment Method
        </ButtonLink>
      </Actions>
    </Card>
  );
}

// extra work the Office has proposed, which is only charged if they approve
function Proposal({
  job,
  adjustment,
}: {
  job: ClientJobDetail;
  adjustment: AdjustmentView;
}) {
  const action = useJobAction("Your answer wasn't saved. Please try again.");
  const path = `/api/jobs/mine/${job.id}/adjustments/${adjustment.id}`;

  return (
    <Card title="Please approve extra work">
      <p>
        Our team did more than was quoted:{" "}
        <strong>{adjustmentLabel(adjustment)}</strong> ("{adjustment.reason}").
        {adjustment.officeReason && ` ${adjustment.officeReason}.`}
      </p>
      <p>
        It comes to <strong>{formatMoney(adjustment.totalCents)}</strong>, tax
        included, charged to your card only if you approve it. If we don't hear
        from you by {formatDate(adjustment.lapsesAt!)}, we won't charge it.
      </p>
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button
          variant="secondary"
          isPending={action.isPending === "decline"}
          onPress={() =>
            void action.run("decline", `${path}/decline`, "Declined")
          }
        >
          Decline
        </Button>
        <Button
          isPending={action.isPending === "approve"}
          onPress={() =>
            void action.run("approve", `${path}/approve`, "Approved")
          }
        >
          Approve {formatMoney(adjustment.totalCents)}
        </Button>
      </Actions>
    </Card>
  );
}

const chargeLabel = { deposit: "Deposit", balance: "Charged" };

function Receipt({ job }: { job: ClientJobDetail }) {
  const { payment, adjustments, completedAt } = job.completion!;
  const counted = adjustments.filter(
    (a) => a.status === "applied" || a.status === "approved",
  );
  const notCharged = adjustments.filter(
    (a) => a.status === "declined" || a.status === "lapsed",
  );

  return (
    <Card
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
            <dt>Late Reschedule fee (your Deposit, kept)</dt>
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
    </Card>
  );
}
