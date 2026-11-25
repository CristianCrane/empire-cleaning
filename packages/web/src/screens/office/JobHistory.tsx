import { firstNameOf, formats, messages } from "@empire-cleaning/models";
import {
  CalendarCheck,
  CalendarPlus,
  CalendarClock,
  CalendarX,
  CircleAlert,
  ShieldAlert,
  CircleCheck,
  CircleX,
  CreditCard,
  MessageSquareText,
  Send,
  Undo2,
  UserCheck,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
import type {
  AdjustmentStatus,
  AssignmentState,
  OfficeJob,
  RescheduleRequestStatus,
} from "@empire-cleaning/models";
import { Timeline, TimelineItem } from "@empire-cleaning/ui";
import { wasSkipped, screenWords } from "../format.ts";
import { jobStatusIcon } from "../icons.ts";
import { feeNameOf, whatOf, wontHappen } from "./JobCompletion.tsx";

const { assignmentStateLabel, cancelledLabel } = screenWords.en;

const { formatDateTime, formatMoney } = formats.en;

const { planCancelled } = messages.en;

type Moment = {
  key: string;
  at: string;
  icon: LucideIcon;
  title: string;
};

const chargeLabel = { deposit: "Deposit", balance: "Balance" };

// an Assignment answered: its icon; its title is who and what they did,
// "Cory confirmed"
const assignmentAnswered: Record<
  Exclude<AssignmentState, "offered">,
  { icon: LucideIcon }
> = {
  confirmed: { icon: UserCheck },
  released: { icon: UserMinus },
  taken_off: { icon: UserMinus },
};

// a Reschedule Request answered, or closed unanswered
const requestAnswered: Record<
  Exclude<RescheduleRequestStatus, "pending">,
  { icon: LucideIcon; title: string }
> = {
  confirmed: { icon: CalendarCheck, title: "Moved" },
  turned_down: { icon: CalendarX, title: "Move turned down" },
  closed: { icon: CalendarX, title: "Move request closed" },
  withdrawn: { icon: CalendarX, title: "Move withdrawn by the client" },
};

// a price change ended: the client's answer, none in time, or the Office's
// dismissal
type Ended = Extract<
  AdjustmentStatus,
  "approved" | "declined" | "lapsed" | "dismissed"
>;
const adjustmentEnded: Record<Ended, { icon: LucideIcon; title: string }> = {
  approved: {
    icon: CircleCheck,
    title: "The client approved the price change",
  },
  declined: { icon: CircleX, title: "The client declined the price change" },
  lapsed: { icon: CircleX, title: "The client didn't answer the price change" },
  dismissed: { icon: CircleX, title: "Price change dismissed" },
};
const ended = (status: AdjustmentStatus): status is Ended =>
  status in adjustmentEnded;

// everything that happened to a Job, newest first, whole: its booking, its
// Assignments Offered, Confirmed, Released or taken off, Reschedule
// Requests and their answers (closed unanswered if the Job stopped being
// booked first), each charge and refund, a payment that didn't go through,
// each price change reported, sent, answered or dismissed, and how it went
// or ended; who asked, did or ended it named in its title
const momentsOf = (job: OfficeJob): Moment[] => {
  const moments: Moment[] = [
    { key: "booked", at: job.bookedAt, icon: CalendarPlus, title: "Booked" },
  ];
  const charges = job.payment?.charges ?? [];
  // a fee by what it's for, as Money names it: "Late cancellation fee"
  const chargeName = (c: (typeof charges)[number]) =>
    c.kind === "fee" ? feeNameOf(job) : chargeLabel[c.kind];
  const charged = (c: (typeof charges)[number], i: number) =>
    moments.push({
      key: `charge-${i}`,
      at: c.chargedAt,
      icon: CreditCard,
      title: `${chargeName(c)} of ${formatMoney(c.amountCents)} charged`,
    });
  // a Deposit follows its booking
  charges.forEach((c, i) => c.kind === "deposit" && charged(c, i));
  for (const a of job.assignments) {
    moments.push({
      key: `offered-${a.id}`,
      at: a.offeredAt,
      icon: Send,
      title: `Offered to ${a.staff.name}`,
    });
    if (a.answeredAt && a.status !== "offered") {
      const { icon } = assignmentAnswered[a.status];
      moments.push({
        key: `answered-${a.id}`,
        at: a.answeredAt,
        icon,
        title: `${a.staff.name} ${assignmentStateLabel[a.status].toLowerCase()}`,
      });
    }
  }
  const request = job.rescheduleRequest;
  if (request) {
    moments.push({
      key: "asked",
      at: request.requestedAt,
      icon: CalendarClock,
      title: `${request.byClient ? firstNameOf(job.client.name) : "The office"} asked to move it from ${formatDateTime(request.fromStartsAt)} to ${formatDateTime(request.startsAt)}`,
    });
    if (request.answeredAt && request.status !== "pending") {
      const { icon, title } = requestAnswered[request.status];
      moments.push({
        key: "answered",
        at: request.answeredAt,
        icon,
        title: request.reason ? `${title}: ${request.reason}` : title,
      });
    }
  }
  if (job.completion) {
    moments.push({
      key: "completed",
      at: job.completion.completedAt,
      icon: jobStatusIcon.completed,
      title: job.completion.completedBy
        ? `Done by ${job.completion.completedBy.name}`
        : "Done",
    });
    // each price change: reported by whoever marked it done, then sent to
    // the client and answered, or dismissed, when it was
    const by = job.completion.completedBy?.name ?? "The cleaner";
    job.completion.adjustments.forEach((a) => {
      const what = whatOf(a);
      moments.push({
        key: `reported-${a.id}`,
        at: a.reportedAt,
        icon: MessageSquareText,
        title: `${by} reported a price change: ${what}`,
      });
      if (a.proposedAt) {
        moments.push({
          key: `proposed-${a.id}`,
          at: a.proposedAt,
          icon: Send,
          title: `Price change sent to the client: ${what}`,
        });
      }
      const at = a.answeredAt ?? a.dismissedAt;
      if (at && ended(a.status)) {
        const { icon, title } = adjustmentEnded[a.status];
        moments.push({
          key: `ended-${a.id}`,
          at,
          icon,
          title: `${title}: ${what}`,
        });
      }
    });
  }
  const { cancellation, noAccess } = job;
  if (cancellation) {
    const skipped = wasSkipped(job);
    // whether it was late, which its fee is for; the plan's part in it;
    // and why, as we told the client: after the title's colon, as an
    // entry's second line is only its time
    const why = [
      cancellation.late && "A late cancellation.",
      skipped && "The plan carries on.",
      cancellation.withPlan && `${planCancelled[cancellation.withPlan]}.`,
      cancellation.reason,
    ]
      .filter(Boolean)
      .join(" ");
    const title = `${cancelledLabel(skipped)} ${cancellation.by === "empire" ? "by us" : "by the client"}`;
    moments.push({
      key: "cancelled",
      at: cancellation.cancelledAt,
      icon: jobStatusIcon.cancelled,
      title: why ? `${title}: ${why}` : title,
    });
  }
  if (noAccess) {
    moments.push({
      key: "no-access",
      at: noAccess.recordedAt,
      icon: jobStatusIcon.no_access,
      title: `${noAccess.recordedBy?.name ?? "The crew"} couldn't get in`,
    });
  }
  // the rest of the money last, as each follows what it's for: a Balance
  // or fee its ending, a refund its cancelling
  charges.forEach((c, i) => {
    if (c.kind !== "deposit") charged(c, i);
    c.refunds.forEach((r, j) =>
      moments.push({
        key: `refund-${i}-${j}`,
        at: r.refundedAt,
        icon: Undo2,
        // all of it back at once reads as the charge did
        title:
          r.amountCents === c.amountCents
            ? `${chargeName(c)} of ${formatMoney(r.amountCents)} refunded`
            : `${formatMoney(r.amountCents)} of the ${formatMoney(c.amountCents)} ${chargeName(c).toLowerCase()} refunded`,
      }),
    );
  });
  const unpaid = job.payment?.unpaid;
  if (unpaid) {
    moments.push({
      key: "unpaid",
      at: unpaid.since,
      icon: unpaid.kind === "approve" ? ShieldAlert : CircleAlert,
      // named as its charge would be once it goes through: what's owed once
      // done is the Balance, once it didn't happen its fee
      title: `${
        job.status === "completed"
          ? chargeLabel.balance
          : wontHappen(job)
            ? feeNameOf(job)
            : "Payment"
      } of ${formatMoney(job.payment!.owedCents)} ${
        // their bank wanting them to approve it took nothing, and isn't a
        // failure (#534 Q7)
        unpaid.kind === "approve"
          ? `needs ${firstNameOf(job.client.name)}'s approval`
          : "didn't go through"
      }`,
    });
  }
  // newest first; of two at the same moment, the later told first: a
  // Deposit just over its booking, under what followed; a Balance over
  // Done; a refund over its cancelling
  return moments
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.at.localeCompare(a.m.at) || b.i - a.i)
    .map(({ m }) => m);
};

// the Job's story, newest first, as a Timeline, for its Record's History
export function JobHistory({ job }: { job: OfficeJob }) {
  const moments = momentsOf(job);
  return (
    <Timeline aria-label="History, newest first">
      {moments.map((m) => (
        <TimelineItem
          key={m.key}
          icon={m.icon}
          title={m.title}
          when={formatDateTime(m.at)}
        />
      ))}
    </Timeline>
  );
}
