import type { ClientUpcomingJob, JobStatus } from "@empire-cleaning/models";
import { StatusBadge } from "@empire-cleaning/ui";
import { JobStatusBadge } from "../JobBadges.tsx";
import type { Said } from "../words.ts";

// where a Client's clean stands, as their screens badge it
export type CleanState = {
  status: JobStatus;
  // a charge or fee for it that didn't go through
  unpaid: boolean;
  // a price change the Office proposed, waiting on their OK
  priceChange: boolean;
  // a plan clean they cancelled, which the plan carries on past
  skipped: boolean;
  // a move they asked for, waiting on us
  moveAsked: boolean;
};

// A clean's badge: where two states hold, the one waiting on the Client
// first (unpaid, then a price change to OK), and the same word on each of
// their screens, the Cleans list and the clean's page (the `ui` skill, a
// screen says only what's true for this reader now). A list row leaves the
// plain states, booked and done, unbadged; the clean's page shows them
// (`plain`), and a row with none has none, so a list's Status shows only
// while a row has one.
export function cleanBadge(t: Said, clean: CleanState, plain = false) {
  if (clean.unpaid) return <StatusBadge tone="danger">{t.unpaid}</StatusBadge>;
  if (clean.priceChange)
    return <StatusBadge tone="warning">{t.p.needsOk}</StatusBadge>;
  if (clean.status === "no_access")
    return <JobStatusBadge status="no_access" />;
  if (clean.status === "cancelled")
    return <StatusBadge>{t.cancelledLabel(clean.skipped)}</StatusBadge>;
  if (clean.moveAsked)
    return <StatusBadge tone="info">{t.p.moveAsked}</StatusBadge>;
  if (!plain) return null;
  return clean.status === "completed" ? (
    <StatusBadge tone="success">{t.jobStatusLabel.completed}</StatusBadge>
  ) : (
    <JobStatusBadge status="booked" />
  );
}

// an upcoming clean's badge, wherever it's listed (Cleans, a plan's page):
// nothing while it's simply booked, Move asked while a move waits
export const upcomingBadge = (
  t: Said,
  job: Pick<ClientUpcomingJob, "movingTo">,
) =>
  cleanBadge(t, {
    status: "booked",
    unpaid: false,
    priceChange: false,
    skipped: false,
    moveAsked: job.movingTo !== null,
  });
