import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type {
  CleanerJob,
  CleanerSiteVisit,
  OpenPlace,
} from "@empire-cleaning/models";
import {
  Card,
  Heading,
  List,
  ListItem,
  StatusBadge,
} from "@empire-cleaning/ui";
import {
  addressOf,
  clientName,
  formatDateTime,
  formatHours,
  formatMinutes,
  formatTime,
} from "../format.ts";
import { crewOf } from "./OpenPlaceScreen.tsx";

// whether the Cleaner has taken their place yet, or once done, that it is
export function PlaceBadge({ job }: { job: CleanerJob }) {
  if (job.outcome === "completed") {
    return <StatusBadge tone="success">Completed</StatusBadge>;
  }
  if (job.outcome === "no_access") {
    return <StatusBadge tone="danger">No Access</StatusBadge>;
  }
  return job.assignment.status === "confirmed" ? (
    <StatusBadge tone="success">Confirmed</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Offered</StatusBadge>
  );
}

// the Cleaner area's first screen: their Jobs today, then those to come,
// each with any Site Visits they're making (#73), then Jobs with places
// open to them (ADR-0019)
export function CleanerHome() {
  const { today, upcoming, siteVisits, open } = useLoaderData({
    from: "/cleaner/",
  });

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
        <SiteVisits
          label="Today's Site Visits"
          visits={siteVisits.today}
          when={(visit) => formatTime(visit.startsAt)}
        />
      </Card>
      <Card title="Coming up">
        <Jobs
          label="Jobs coming up"
          jobs={upcoming}
          when={(job) => formatDateTime(job.startsAt)}
          empty="Nothing coming up yet."
        />
        <SiteVisits
          label="Site Visits coming up"
          visits={siteVisits.upcoming}
          when={(visit) => formatDateTime(visit.startsAt)}
        />
      </Card>
      <Card
        title="Open to you"
        description="Jobs in the next 7 days with a place open, when you're free. The first to confirm takes each place."
      >
        <OpenPlaces places={open} />
      </Card>
    </div>
  );
}

function OpenPlaces({ places }: { places: OpenPlace[] }) {
  const navigate = useNavigate();

  return (
    <List
      aria-label="Jobs open to you"
      onAction={(id) =>
        navigate({ to: "/cleaner/open/$jobId", params: { jobId: String(id) } })
      }
      renderEmptyState={() => (
        <p className="p-6 text-center text-fg-muted">
          Nothing open to you right now.
        </p>
      )}
    >
      {places.map((place) => (
        <ListItem
          key={place.jobId}
          id={place.jobId}
          title={formatDateTime(place.startsAt)}
          description={[
            place.postcode,
            place.serviceName,
            `${formatHours(place.hoursOnSite)} on site`,
            crewOf(place),
          ].join(" · ")}
        />
      ))}
    </List>
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
            job.serviceName,
            `${formatHours(job.hoursOnSite)} on site`,
          ].join(" · ")}
          end={<PlaceBadge job={job} />}
        />
      ))}
    </List>
  );
}

// Site Visits they're making: free visits to see a Property before it's
// quoted, with nothing to confirm or complete here; the Office records what
// they found
function SiteVisits({
  label,
  visits,
  when,
}: {
  label: string;
  visits: CleanerSiteVisit[];
  when: (visit: CleanerSiteVisit) => string;
}) {
  if (visits.length === 0) return null;
  return (
    <>
      <Heading level={3}>{label}</Heading>
      <List aria-label={label}>
        {visits.map((visit) => (
          <ListItem
            key={visit.id}
            id={visit.id}
            title={when(visit)}
            description={[
              addressOf(visit.property),
              clientName(visit.client),
              visit.client.phone,
              `${formatMinutes(visit.minutes)} to see it`,
              visit.property.accessInstructions,
            ]
              .filter(Boolean)
              .join(" · ")}
            end={<StatusBadge tone="info">Site Visit</StatusBadge>}
          />
        ))}
      </List>
    </>
  );
}
