import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import {
  Button,
  Card,
  Heading,
  List,
  ListItem,
  StatusBadge,
} from "@empire-cleaning/ui";
import {
  addressOf,
  clientName,
  conditionText,
  formatDate,
  propertySummary,
  wantedCleaning,
} from "../format.ts";

// the Office's open Quote Requests, newest first; open one to see its Client.
// A New Quote is for someone who phones (#34).
export function QuoteRequests() {
  const requests = useLoaderData({ from: "/office/requests" });
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={1}>Quote Requests</Heading>
        <Button onPress={() => void navigate({ to: "/office/quotes/new" })}>
          <Phone aria-hidden size={18} />
          New Quote
        </Button>
      </div>
      <Card>
        <List
          aria-label="Open Quote Requests"
          onAction={(id) =>
            navigate({
              to: "/office/requests/$requestId",
              params: { requestId: String(id) },
            })
          }
          renderEmptyState={() => (
            <p className="p-6 text-center text-fg-muted">
              No open Quote Requests.
            </p>
          )}
        >
          {requests.map((request) => (
            <ListItem
              key={request.id}
              id={request.id}
              title={clientName(request.client)}
              description={[
                addressOf(request.property),
                propertySummary(request.property),
                request.property.kind === "commercial"
                  ? wantedCleaning(request)
                  : conditionText(request.condition),
                formatDate(request.createdAt),
              ].join(" · ")}
              end={
                <div className="flex flex-wrap justify-end gap-2">
                  {request.state === "quoted" && (
                    <StatusBadge tone="info">Quoted</StatusBadge>
                  )}
                  {request.servicePlanId ? (
                    <StatusBadge tone="info">Plan change</StatusBadge>
                  ) : (
                    request.wantsRegularService && (
                      <StatusBadge tone="success">Regular visits</StatusBadge>
                    )
                  )}
                </div>
              }
            />
          ))}
        </List>
      </Card>
    </div>
  );
}
