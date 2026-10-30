import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import {
  DateTile,
  EmptyState,
  Heading,
  List,
  ListItem,
  Section,
  StatusBadge,
} from "@empire-cleaning/ui";
import { formatDateTime, formatHours } from "../format.ts";
import { crewOf } from "./OpenPlaceScreen.tsx";

// Places that aren't the Cleaner's yet, apart from Your Jobs so their own
// list says only where they're working (UX pass, #96): those the Office
// offered them, to Confirm or Release, and those open to them (ADR-0019),
// first come first served.
export function CleanerOffers() {
  const { offered, open } = useLoaderData({ from: "/cleaner/offers" });
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <Heading level={1}>Offers</Heading>

      {offered.length > 0 && (
        <Section
          title="Offered to you"
          description="The Office picked you for these. Confirm, or let them go to someone else."
        >
          <List
            aria-label="Offered to you"
            onAction={(id) =>
              navigate({
                to: "/cleaner/jobs/$jobId",
                params: { jobId: String(id) },
              })
            }
          >
            {offered.map((job) => (
              <ListItem
                key={job.id}
                id={job.id}
                start={<DateTile date={job.startsAt} size="sm" />}
                title={formatDateTime(job.startsAt)}
                description={`${job.property.postcode} · ${job.serviceName}, ${formatHours(job.hoursOnSite)}`}
                end={<StatusBadge tone="warning">Offered</StatusBadge>}
              />
            ))}
          </List>
        </Section>
      )}

      <Section
        title="Open to you"
        description="Places on Jobs in the next 7 days, when you're free. The first to confirm takes each."
      >
        {open.length > 0 ? (
          <List
            aria-label="Open to you"
            onAction={(id) =>
              navigate({
                to: "/cleaner/open/$jobId",
                params: { jobId: String(id) },
              })
            }
          >
            {open.map((place) => (
              <ListItem
                key={place.jobId}
                id={place.jobId}
                start={<DateTile date={place.startsAt} size="sm" />}
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
        ) : (
          <EmptyState
            headingLevel={3}
            icon={Inbox}
            title="Nothing open to you right now"
            description="When a Job needs someone while you're free, it shows here."
          />
        )}
      </Section>
    </div>
  );
}
