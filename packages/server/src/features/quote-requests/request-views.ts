import { desc, type SQL } from "drizzle-orm";
import type { QuoteRequestView, Weekday } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { requestStates } from "../quotes/quote-state.ts";
import { siteVisitStages } from "../site-visits/site-visits.ts";
import { addOnsForRequests } from "./add-ons.ts";
import { quoteRequests } from "./quote-requests.schema.ts";

// Quote Requests with their Add-ons and where each stands, newest first
export const quoteRequestViews = async (
  where: SQL | undefined,
): Promise<QuoteRequestView[]> => {
  const requests = await db
    .select()
    .from(quoteRequests)
    .where(where)
    .orderBy(desc(quoteRequests.createdAt));
  const ids = requests.map((r) => r.id);
  const [addOns, states, stages] = await Promise.all([
    addOnsForRequests(ids),
    requestStates(ids),
    siteVisitStages(requests.map((r) => r.propertyId)),
  ]);

  return requests.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    condition: r.condition,
    wantsRegularService: r.wantsRegularService,
    weekdays: r.weekdays as Weekday[],
    preferredTime: r.preferredTime,
    notes: r.notes,
    addOns: addOns.get(r.id) ?? [],
    createdAt: r.createdAt.toISOString(),
    state: states.get(r.id)!,
    siteVisit: siteVisitOf(states.get(r.id)!, stages.get(r.propertyId)),
  }));
};

// a request's Site Visit stage shows only while it awaits a Quote
export const siteVisitOf = (
  state: QuoteRequestView["state"],
  stage: "needed" | "booked" | undefined,
) => (state === "awaiting_quote" ? (stage ?? null) : null);
