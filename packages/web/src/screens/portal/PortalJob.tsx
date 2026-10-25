import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import type {
  AdjustmentView,
  ClientJobDetail,
  JobPayment,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  Heading,
  Notice,
  StatusBadge,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  adjustmentLabel,
  cleanTypeLabel,
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
} from "../format.ts";

// one of the Client's Jobs, from the links in their receipt and approval
// emails: once Completed, its receipt; any extra work proposed to them to
// approve or decline; and if it couldn't be charged, the way to pay
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
          ) : (
            <StatusBadge tone="success">Booked</StatusBadge>
          )}
        </div>
        <p className="text-fg-muted">
          {addressOf(job.property)} · {formatDateTime(job.startsAt)}
        </p>
      </div>

      {!completion ? (
        <Card title="Your clean">
          <p>
            About {formatHours(job.hoursOnSite)} on site, with a crew of{" "}
            {job.crewSize}. We'll email a reminder the day before.
          </p>
        </Card>
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
