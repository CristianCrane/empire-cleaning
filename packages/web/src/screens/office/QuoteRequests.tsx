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
import { QuoteStatusBadge } from "../QuoteParts.tsx";
import {
  addressOf,
  clientName,
  conditionText,
  formatDate,
  propertySummary,
  wantedCleaning,
} from "../format.ts";

// The Office's open Quotes, newest first: Requested, Draft and Sent; open
// one asked for to see what was asked, or a Draft or Sent one to work on
// it. A New Quote is for someone who phones (#34). #101 and #103 reshape
// this list.
export function QuoteRequests() {
  const quotes = useLoaderData({ from: "/office/requests" });
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
          onAction={(id) => {
            const quote = quotes.find((q) => q.id === id)!;
            void navigate(
              quote.status === "requested"
                ? {
                    to: "/office/requests/$requestId",
                    params: { requestId: quote.id },
                  }
                : {
                    to: "/office/quotes/$quoteId",
                    params: { quoteId: quote.id },
                  },
            );
          }}
          renderEmptyState={() => (
            <p className="p-6 text-center text-fg-muted">
              No open Quote Requests.
            </p>
          )}
        >
          {quotes.map((quote) => (
            <ListItem
              key={quote.id}
              id={quote.id}
              title={clientName(quote.client)}
              description={[
                addressOf(quote.property),
                propertySummary(quote.property),
                quote.asked
                  ? quote.property.kind === "commercial"
                    ? wantedCleaning(quote.asked)
                    : conditionText(quote.asked.condition)
                  : "Offered unprompted",
                formatDate(quote.createdAt),
              ].join(" · ")}
              end={
                <div className="flex flex-wrap justify-end gap-2">
                  {quote.siteVisit === "needed" && (
                    <StatusBadge tone="warning">Needs Site Visit</StatusBadge>
                  )}
                  {quote.siteVisit === "booked" && (
                    <StatusBadge tone="info">Site Visit booked</StatusBadge>
                  )}
                  {quote.homePlanId
                    ? quote.asked && (
                        <StatusBadge tone="info">Plan change</StatusBadge>
                      )
                    : quote.asked?.wantsRegularService && (
                        <StatusBadge tone="success">Regular visits</StatusBadge>
                      )}
                  {/* this list was asks, so only a further status shows */}
                  {quote.status !== "requested" && (
                    <QuoteStatusBadge status={quote.status} />
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
