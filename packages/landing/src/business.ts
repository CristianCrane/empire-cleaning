import { business as shared } from "@empire-cleaning/models";

// the facts the page, its search data and its tests all share: the business
// itself (shared with the emails), and how the page presents it
export const business = {
  ...shared,
  title:
    "Empire Cleaning & Pro Services | House and office cleaning in Queens, NY",
  description:
    "Professional house, office and post-construction cleaning in Queens, NY. Request a Quote in minutes, with no account needed, and save 10% with a Service Plan.",
} as const;
