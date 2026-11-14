import type { Crumb } from "@empire-cleaning/ui";
import type { ClientName, PropertyView } from "@empire-cleaning/models";
import { linkTo } from "../../links.ts";
import { addressOf, clientName } from "../format.ts";

// The Office's breadcrumbs below its Clients section: from the section, every
// step (docs/ux.md, Screen types). A page's own crumb, last, is its own.

type Home = Pick<PropertyView, "id" | "street" | "unit" | "postcode">;

// each step, by name, so a trail that leaves one out says which
export const clientsCrumb: Crumb = {
  label: "Clients",
  href: linkTo({ to: "/office/clients" }),
};

const clientCrumb = (client: ClientName): Crumb => ({
  label: clientName(client),
  href: linkTo({
    to: "/office/clients/$clientId",
    params: { clientId: client.id },
  }),
});

const homeCrumb = (home: Home): Crumb => ({
  label: addressOf(home),
  href: linkTo({
    to: "/office/properties/$propertyId",
    params: { propertyId: home.id },
  }),
});

// the pages below a Client's (a Bill, a home)
export const clientTrail = (client: ClientName): Crumb[] => [
  clientsCrumb,
  clientCrumb(client),
];

// a home's Client, then the home: under Clients (a Site Visit, a plan), or
// under Quotes (a Quote)
export const homeCrumbs = (client: ClientName, home: Home): Crumb[] => [
  clientCrumb(client),
  homeCrumb(home),
];

// the pages below a home's
export const homeTrail = (client: ClientName, home: Home): Crumb[] => [
  clientsCrumb,
  ...homeCrumbs(client, home),
];
