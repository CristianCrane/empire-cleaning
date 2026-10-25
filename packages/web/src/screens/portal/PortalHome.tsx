import { useLoaderData } from "@tanstack/react-router";
import {
  ButtonLink,
  Card,
  Heading,
  List,
  ListItem,
  StatusBadge,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  conditionLabel,
  formatDate,
  homeSummary,
} from "../format.ts";

export function PortalHome() {
  const client = useLoaderData({ from: "/portal/" });
  const [firstName] = client.name.split(" ");
  const homes = new Map(client.properties.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading level={1}>Welcome, {firstName}</Heading>
        <ButtonLink href={linkTo({ to: "/portal/request" })}>
          Request a Quote
        </ButtonLink>
      </div>

      <Card
        title="Your Quote Requests"
        description="We email your Quote, usually within a working day."
      >
        <List
          aria-label="Your Quote Requests"
          renderEmptyState={() => (
            <p className="p-6 text-center text-fg-muted">
              No Quote Requests yet.
            </p>
          )}
        >
          {client.quoteRequests.map((request) => {
            const home = homes.get(request.propertyId);
            return (
              <ListItem
                key={request.id}
                id={request.id}
                title={home ? addressOf(home) : "Your home"}
                description={[
                  `Sent ${formatDate(request.createdAt)}`,
                  `${conditionLabel[request.condition]} clean`,
                  request.addOns.length > 0 &&
                    `Extras: ${request.addOns.map((a) => a.name).join(", ")}`,
                  request.wantsRegularService && "Regular visits wanted",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                end={<StatusBadge tone="info">Received</StatusBadge>}
              />
            );
          })}
        </List>
      </Card>

      <Card title="Your homes">
        <List aria-label="Your homes">
          {client.properties.map((home) => (
            <ListItem
              key={home.id}
              id={home.id}
              title={addressOf(home)}
              description={homeSummary(home)}
            />
          ))}
        </List>
      </Card>
    </div>
  );
}
