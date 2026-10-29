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
import type { OfficeJob } from "@empire-cleaning/models";
import { Section, Timeline, TimelineItem } from "@empire-cleaning/ui";
import { formatDate, formatDateTime, formatMoney } from "../format.ts";

type Moment = {
  key: string;
  at: string;
  icon: LucideIcon;
  title: string;
  description?: string;
};

const chargeLabel = { deposit: "Deposit", balance: "Balance", fee: "Fee" };

// everything that happened to a Job, newest first: its places Offered,
// Confirmed and Released, Reschedule Requests and their answers, each
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
    if (a.answeredAt) {
      moments.push({
        key: `answered-${a.id}`,
        at: a.answeredAt,
        icon: a.status === "confirmed" ? UserCheck : UserMinus,
        title: `${a.staff.name} ${a.status === "confirmed" ? "Confirmed" : "Released"}`,
      });
    }
  }
  const request = job.rescheduleRequest;
  if (request) {
    moments.push({
      key: "asked",
      at: request.requestedAt,
      icon: CalendarClock,
      title: `${request.byClient ? "The Client" : "The Office"} asked to move it`,
      description: `${formatDateTime(request.fromStartsAt)} to ${formatDateTime(request.startsAt)}`,
    });
    if (request.answeredAt) {
      moments.push({
        key: "answered",
        at: request.answeredAt,
        icon: request.status === "confirmed" ? CalendarCheck : CalendarX,
        title:
          request.status === "confirmed"
            ? "Moved"
            : request.status === "turned_down"
              ? "Move turned down"
              : "Move withdrawn by the Client",
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
      title: "Completed",
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
      title:
        job.servicePlanId && job.cancellation.by === "client"
          ? "Skipped"
          : "Cancelled",
      description:
        job.cancellation.by === "empire"
          ? "By Empire Cleaning"
          : "By the Client",
    });
  }
  if (job.noAccess) {
    moments.push({
      key: "no-access",
      at: job.noAccess.recordedAt,
      icon: DoorClosed,
      title: "No Access",
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
