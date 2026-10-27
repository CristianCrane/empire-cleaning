import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import {
  Button,
  Heading,
  List,
  ListItem,
  Section,
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

// The Office's open Quotes, newest first: Requested, Draft and Sent, and
// those Expired lately, which may be revived. Closed ones are on their
// Client's and Property's pages. A New Quote is for someone who phones
// (#34). #103 prototypes this list's layout.
export function QuotesScreen() {
  const quotes = useLoaderData({ from: "/office/quotes" });
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={1}>Quotes</Heading>
        <Button onPress={() => void navigate({ to: "/office/quotes/new" })}>
          <Phone aria-hidden size={18} />
          New Quote
        </Button>
      </div>
      <Section title="Open Quotes">
        <List
          aria-label="Open Quotes"
          onAction={(id) =>
            void navigate({
              to: "/office/quotes/$quoteId",
              params: { quoteId: String(id) },
            })
          }
          renderEmptyState={() => (
            <p className="p-6 text-center text-fg-muted">No open Quotes.</p>
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
                // at most half the row, wrapping, so the name keeps room
                <div className="flex max-w-1/2 flex-wrap justify-end gap-2">
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
                  <QuoteStatusBadge status={quote.status} />
                  {quote.drafting &&
                    (quote.status === "sent" || quote.status === "expired") && (
                      <StatusBadge tone="info">Draft changes</StatusBadge>
                    )}
                </div>
              }
            />
          ))}
        </List>
      </Section>
    </div>
  );
}
