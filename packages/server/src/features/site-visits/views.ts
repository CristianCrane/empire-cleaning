import { asc, eq, type SQL } from "drizzle-orm";
import type { SiteVisitView } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { staff } from "../staff/staff.schema.ts";
import { siteVisits, type SiteVisit } from "./site-visits.schema.ts";

export const toSiteVisitView = (
  visit: SiteVisit,
  property: Pick<
    typeof properties.$inferSelect,
    "id" | "street" | "unit" | "postcode" | "kind"
  >,
  client: Pick<typeof clients.$inferSelect, "id" | "name" | "businessName">,
  visitor: { id: string; name: string } | null,
): SiteVisitView => ({
  id: visit.id,
  quoteId: visit.quoteId,
  status: visit.status,
  startsAt: visit.startsAt?.toISOString() ?? null,
  minutes: visit.minutes,
  visitor,
  client: {
    id: client.id,
    name: client.name,
    businessName: client.businessName,
  },
  property: {
    id: property.id,
    street: property.street,
    unit: property.unit,
    postcode: property.postcode,
    kind: property.kind,
  },
  bookedAt: visit.bookedAt.toISOString(),
  doneAt: visit.doneAt?.toISOString() ?? null,
  cancelledAt: visit.cancelledAt?.toISOString() ?? null,
});

// Site Visits as the Office sees them, earliest first (findings recorded
// without a visit last)
export const siteVisitViews = async (
  where: SQL | undefined,
): Promise<SiteVisitView[]> => {
  const rows = await db
    .select({
      visit: siteVisits,
      property: properties,
      client: clients,
      visitor: { id: staff.id, name: staff.name },
    })
    .from(siteVisits)
    .innerJoin(properties, eq(properties.id, siteVisits.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .leftJoin(staff, eq(staff.id, siteVisits.staffId))
    .where(where)
    .orderBy(asc(siteVisits.startsAt), asc(siteVisits.createdAt));
  return rows.map(({ visit, property, client, visitor }) =>
    toSiteVisitView(visit, property, client, visitor),
  );
};
