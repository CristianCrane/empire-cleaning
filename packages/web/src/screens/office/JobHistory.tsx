import { firstNameOf, formats, messages } from "@empire-cleaning/models";
import {
  CalendarCheck,
  CalendarPlus,
  CalendarClock,
  CalendarX,
  CircleAlert,
  CreditCard,
  Send,
  Undo2,
  UserCheck,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
import type {
  AssignmentState,
  OfficeJob,
  RescheduleRequestStatus,
} from "@empire-cleaning/models";
import { Timeline, TimelineItem } from "@empire-cleaning/ui";
import { wasSkipped, screenWords } from "../format.ts";
import { jobStatusIcon } from "../icons.ts";

const { assignmentStateLabel, cancelledLabel } = screenWords.en;

const { formatDateTime, formatMoney } = formats.en;

const { planCancelled } = messages.en;

type Moment = {
  key: string;
  at: string;
  icon: LucideIcon;
  title: string;
  description?: string;
};

const chargeLabel = { deposit: "Deposit", balance: "Balance", fee: "Fee" };

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

// everything that happened to a Job, newest first, whole: its booking, its
// Assignments Offered, Confirmed, Released or taken off, Reschedule
// Requests and their answers (closed unanswered if the Job stopped being
// booked first), each charge and refund, a payment that didn't go through,
// and how it went or ended; who asked, did or ended it named in its title
const momentsOf = (job: OfficeJob): Moment[] => {
  const moments: Moment[] = [
    { key: "booked", at: job.bookedAt, icon: CalendarPlus, title: "Booked" },
  ];
  const charges = job.payment?.charges ?? [];
  const charged = (c: (typeof charges)[number], i: number) =>
    moments.push({
      key: `charge-${i}`,
      at: c.chargedAt,
      icon: CreditCard,
      title: `${chargeLabel[c.kind]} of ${formatMoney(c.amountCents)} charged`,
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
      title: `${request.byClient ? firstNameOf(job.client.name) : "The office"} asked to move it to ${formatDateTime(request.startsAt)}`,
      description: `From ${formatDateTime(request.fromStartsAt)}`,
    });
    if (request.answeredAt && request.status !== "pending") {
      const { icon, title } = requestAnswered[request.status];
      moments.push({
        key: "answered",
        at: request.answeredAt,
        icon,
        title,
        description: request.reason ?? undefined,
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
  }
  const { cancellation, noAccess } = job;
  if (cancellation) {
    const skipped = wasSkipped(job);
    moments.push({
      key: "cancelled",
      at: cancellation.cancelledAt,
      icon: jobStatusIcon.cancelled,
      title: `${cancelledLabel(skipped)} ${cancellation.by === "empire" ? "by us" : "by the client"}`,
      // whether it was late, which its fee is for; the plan's part in it;
      // and why, as we told the client
      description:
        [
          cancellation.late && "A late cancellation.",
          skipped && "The plan carries on.",
          cancellation.withPlan && `${planCancelled[cancellation.withPlan]}.`,
          cancellation.reason,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
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
    if (c.refundedAt) {
      moments.push({
        key: `refund-${i}`,
        at: c.refundedAt,
        icon: Undo2,
        title: `${formatMoney(c.refundedCents)} of the ${chargeLabel[c.kind].toLowerCase()} refunded`,
      });
    }
  });
  const unpaid = job.payment?.unpaid;
  if (unpaid) {
    moments.push({
      key: "unpaid",
      at: unpaid.since,
      icon: CircleAlert,
      title: `Payment of ${formatMoney(job.payment!.owedCents)} didn't go through`,
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
          description={m.description}
        />
      ))}
    </Timeline>
  );
}
