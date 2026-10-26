import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { PropertyStatus } from "@empire-cleaning/models";
import {
  Breadcrumbs,
  Card,
  Heading,
  List,
  ListItem,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { addressOf, formatDateTime, homeSummary } from "../format.ts";

// a Client for the Office: their contact details and their homes, each with
// where it stands and opening its own page, which holds its history
export function ClientDetail() {
  const client = useLoaderData({ from: "/office/clients/$clientId" });
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Clients", href: linkTo({ to: "/office/clients" }) },
            { label: client.name },
          ]}
        />
        <Heading level={1}>{client.name}</Heading>
      </div>

      <Card title="Contact details">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Email</dt>
          <dd>{client.email}</dd>
          <dt className="font-semibold">Phone</dt>
          <dd>{client.phone}</dd>
        </dl>
      </Card>

      <Card title="Properties">
        <List
          aria-label={`${client.name}'s Properties`}
          renderEmptyState={() => (
            <p className="p-4 text-center text-fg-muted">No Properties yet.</p>
          )}
        >
          {client.properties.map((home) => (
            <ListItem
              key={home.id}
              id={home.id}
              title={addressOf(home)}
              description={`${statusLine(home.status)} · ${homeSummary(home)}`}
              onAction={() =>
                void navigate({
                  to: "/office/properties/$propertyId",
                  params: { propertyId: home.id },
                })
              }
            />
          ))}
        </List>
      </Card>
    </div>
  );
}

const statusLine = (status: PropertyStatus) => {
  switch (status.kind) {
    case "request_waiting":
      return "Quote Request waiting";
    case "quote_sent":
      return status.quoteKind === "service_plan"
        ? "Service Plan Quote sent"
        : "Quote sent";
    case "job_booked":
      return `Job booked ${formatDateTime(status.startsAt)}`;
    case "first_clean_done":
      return "First Clean done";
    case "nothing_booked":
      return "Nothing booked";
  }
};
