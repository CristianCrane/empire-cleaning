import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { CleanerJob } from "@empire-cleaning/models";
import {
  Card,
  Heading,
  List,
  ListItem,
  StatusBadge,
} from "@empire-cleaning/ui";
import {
  addressOf,
  cleanTypeLabel,
  formatDateTime,
  formatHours,
  formatTime,
} from "../format.ts";

// whether the Cleaner has taken their place yet, or once done, that it is
export function PlaceBadge({ job }: { job: CleanerJob }) {
  if (job.outcome === "completed") {
    return <StatusBadge tone="success">Completed</StatusBadge>;
  }
  return job.assignment.status === "confirmed" ? (
    <StatusBadge tone="success">Confirmed</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Offered</StatusBadge>
  );
}

// the Cleaner area's first screen: their Jobs today, then those to come
export function CleanerHome() {
  const { today, upcoming } = useLoaderData({ from: "/cleaner/" });

  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Your Jobs</Heading>
      <Card title="Today">
        <Jobs
          label="Today's Jobs"
          jobs={today}
          when={(job) => formatTime(job.startsAt)}
          empty="No Jobs today."
        />
      </Card>
      <Card title="Coming up">
        <Jobs
          label="Jobs coming up"
          jobs={upcoming}
          when={(job) => formatDateTime(job.startsAt)}
          empty="Nothing coming up yet."
        />
      </Card>
    </div>
  );
}

function Jobs({
  label,
  jobs,
  when,
  empty,
}: {
  label: string;
  jobs: CleanerJob[];
  when: (job: CleanerJob) => string;
  empty: string;
}) {
  const navigate = useNavigate();

  return (
    <List
      aria-label={label}
      onAction={(id) =>
        navigate({ to: "/cleaner/jobs/$jobId", params: { jobId: String(id) } })
      }
      renderEmptyState={() => (
        <p className="p-6 text-center text-fg-muted">{empty}</p>
      )}
    >
      {jobs.map((job) => (
        <ListItem
          key={job.id}
          id={job.id}
          title={when(job)}
          description={[
            addressOf(job.property),
            cleanTypeLabel[job.cleanType],
            `${formatHours(job.hoursOnSite)} on site`,
          ].join(" · ")}
          end={<PlaceBadge job={job} />}
        />
      ))}
    </List>
  );
}
