import {
  formats,
  type JobsTab,
  type ScheduledJob,
} from "@empire-cleaning/models";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { BrushCleaning } from "lucide-react";
import { ListPage, type ListRow } from "@empire-cleaning/ui";
import { clientName } from "../format.ts";
import { JobBadge } from "../JobBadges.tsx";
import { useListUrl } from "../list-search.ts";

const { formatDateTime } = formats.en;

// the list's Tabs, Upcoming first: the Jobs still to do
export const jobTabs = ["upcoming", "past", "cancelled"] as const;

const tabLabel: Record<JobsTab, string> = {
  upcoming: "Upcoming",
  past: "Past",
  cancelled: "Cancelled",
};

// what a Tab holds, for when it's empty
const noneIn: Record<JobsTab, string> = {
  upcoming: "No jobs booked.",
  past: "No jobs done yet.",
  cancelled: "No jobs cancelled.",
};

const homeOf = (job: ScheduledJob) =>
  [job.property.street, job.property.unit].filter(Boolean).join(", ");

// The Office's Jobs (#96, #433), a List: a Tab per where they stand with its
// count: Upcoming (booked, soonest first), then Past (Completed or No
// Access) and Cancelled (Skipped too), newest first, by month. A search by
// the Client or the address looks through every Tab. A Tab holds 50 at a
// time and Show more adds 50, so it stays quick however many Jobs there
// are. Only a Job that needs something says where it stands: Needs
// cleaners
export function JobsScreen() {
  const { jobs, counts } = useLoaderData({ from: "/office/jobs" });
  const url = useListUrl<JobsTab>();
  const navigate = useNavigate();
  const tab = url.tab ?? "upcoming";

  const row = (job: ScheduledJob): ListRow => ({
    id: job.id,
    at: job.startsAt,
    title: clientName(job.client),
    description: `${homeOf(job)} · ${job.serviceName}`,
    status: {
      badge: <JobBadge job={job} />,
      // as it should be: booked with a whole crew, done, or called off
      plain: job.status !== "booked" || job.assignment === "assigned",
    },
    onOpen: () =>
      void navigate({ to: "/office/jobs/$jobId", params: { jobId: job.id } }),
  });

  return (
    <ListPage
      title="Jobs"
      tabs={jobTabs.map((t) => ({
        id: t,
        label: tabLabel[t],
        count: counts[t],
        none: noneIn[t],
      }))}
      tab={tab}
      onTabChange={url.onTabChange}
      search={{
        label: "Search jobs",
        placeholder: "Client or address",
        query: url.q,
        onSearch: url.onSearch,
        found: counts.all,
      }}
      items={jobs}
      row={row}
      columns={[
        {
          id: "when",
          label: "When",
          cell: (job) => formatDateTime(job.startsAt),
        },
        {
          id: "client",
          label: "Client",
          cell: (job) => clientName(job.client),
        },
        { id: "home", label: "Home", cell: homeOf },
        {
          id: "service",
          label: "Service",
          from: "lg",
          cell: (job) => job.serviceName,
        },
      ]}
      more={{
        left: (url.q ? counts.all : counts[tab]) - jobs.length,
        onMore: url.onMore,
      }}
      empty={{ icon: BrushCleaning, title: "No jobs yet" }}
    />
  );
}
