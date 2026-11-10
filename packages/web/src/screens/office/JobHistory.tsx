import { formats } from "@empire-cleaning/models";
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  CreditCard,
  DoorClosed,
  Send,
  UserCheck,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
import type {
  AssignmentState,
  OfficeJob,
  RescheduleRequestStatus,
} from "@empire-cleaning/models";
import { Section, Timeline, TimelineItem } from "@empire-cleaning/ui";
import {
  assignmentStateLabel,
  cancelledLabel,
  jobStatusLabel,
  wasSkipped,
} from "../format.ts";

const { formatDate, formatDateTime, formatMoney } = formats.en;

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

// everything that happened to a Job, newest first: its Assignments Offered,
// Confirmed, Released or taken off, Reschedule Requests and their answers
// (closed unanswered if the Job stopped being booked first), each
// charge, and how it went or ended
const momentsOf = (job: OfficeJob): Moment[] => {
  const moments: Moment[] = [];
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
      title: `${request.byClient ? "The client" : "The office"} asked to move it`,
      description: `${formatDateTime(request.fromStartsAt)} to ${formatDateTime(request.startsAt)}`,
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
  const payment =
    job.completion?.payment ??
    job.cancellation?.payment ??
    job.noAccess?.payment;
  payment?.charges.forEach((c, i) =>
    moments.push({
      key: `charge-${i}`,
      at: c.chargedAt,
      icon: CreditCard,
      title: `${chargeLabel[c.kind]} of ${formatMoney(c.amountCents)} charged`,
      description:
        c.refundedCents > 0
          ? `${formatMoney(c.refundedCents)} refunded`
          : undefined,
    }),
  );
  if (job.completion) {
    moments.push({
      key: "completed",
      at: job.completion.completedAt,
      icon: CircleCheck,
      title: jobStatusLabel.completed,
      description: job.completion.completedBy
        ? `By ${job.completion.completedBy.name}`
        : undefined,
    });
  }
  if (job.cancellation) {
    moments.push({
      key: "cancelled",
      at: job.cancellation.cancelledAt,
      icon: Ban,
      title: cancelledLabel(wasSkipped(job)),
      description:
        job.cancellation.by === "empire"
          ? "By Empire Cleaning"
          : "By the client",
    });
  }
  if (job.noAccess) {
    moments.push({
      key: "no-access",
      at: job.noAccess.recordedAt,
      icon: DoorClosed,
      title: jobStatusLabel.no_access,
      description: job.noAccess.recordedBy
        ? `Recorded by ${job.noAccess.recordedBy.name}`
        : undefined,
    });
  }
  return moments.sort((a, b) => b.at.localeCompare(a.at));
};

// the Job's story, newest first, as a Timeline
export function JobHistory({ job }: { job: OfficeJob }) {
  const moments = momentsOf(job);
  return (
    <Section title="History">
      {moments.length === 0 ? (
        <p className="text-sm text-fg-muted">Nothing has happened yet.</p>
      ) : (
        <Timeline aria-label="History, newest first">
          {moments.map((m) => (
            <TimelineItem
              key={m.key}
              icon={m.icon}
              title={m.title}
              when={formatDate(m.at)}
              description={m.description}
            />
          ))}
        </Timeline>
      )}
    </Section>
  );
}
