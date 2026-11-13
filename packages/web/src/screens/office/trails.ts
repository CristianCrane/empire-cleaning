import type { Crumb } from "@empire-cleaning/ui";
import type { ClientName, PropertyView } from "@empire-cleaning/models";
import { linkTo } from "../../links.ts";
import { addressOf, clientName } from "../format.ts";

// The Office's breadcrumbs below its Clients section: from the section, every
// step (docs/ux.md, Screen types). A page's own crumb, last, is its own.

// a Client's page, and the pages below it (a Bill)
export const clientTrail = (client: ClientName): Crumb[] => [
  { label: "Clients", href: linkTo({ to: "/office/clients" }) },
  {
    label: clientName(client),
    href: linkTo({
      to: "/office/clients/$clientId",
      params: { clientId: client.id },
    }),
  },
];

// a home's Client, then the home: under Clients (a Property, a Site Visit,
// a plan), or under Quotes (a Quote)
export const homeCrumbs = (
  client: ClientName,
  home: Pick<PropertyView, "id" | "street" | "unit" | "postcode">,
): Crumb[] => [
  clientTrail(client)[1]!,
  {
    label: addressOf(home),
    href: linkTo({
      to: "/office/properties/$propertyId",
      params: { propertyId: home.id },
    }),
  },
];

// a home's page, and the pages below it
export const homeTrail = (
  client: ClientName,
  home: Pick<PropertyView, "id" | "street" | "unit" | "postcode">,
): Crumb[] => [clientTrail(client)[0]!, ...homeCrumbs(client, home)];
