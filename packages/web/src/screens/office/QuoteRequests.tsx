import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  Card,
  Heading,
  List,
  ListItem,
  StatusBadge,
} from "@empire-cleaning/ui";
import {
  addressOf,
  conditionLabel,
  formatDate,
  homeSummary,
} from "../format.ts";

// the Office's open Quote Requests, newest first; open one to see its Client
export function QuoteRequests() {
  const requests = useLoaderData({ from: "/office/requests" });
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Quote Requests</Heading>
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
              title={request.client.name}
              description={[
                addressOf(request.property),
                homeSummary(request.property),
                `${conditionLabel[request.condition]} · ${formatDate(request.createdAt)}`,
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
