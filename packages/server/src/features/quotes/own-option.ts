import type { Revision } from "./quotes.schema.ts";

// whether an option is its Revision's own, for the Service it was drafted
// for, which has every Add-on it chose: a one-off Quote's recommended
// Service prices only those that go with it
export const isOwnOption = (
  revision: Pick<Revision, "serviceKey">,
  row: { serviceKey: string },
) => row.serviceKey === revision.serviceKey;

// a Revision's option for its own Service
export const ownOption = <T extends { serviceKey: string }>(
  revision: Pick<Revision, "serviceKey">,
  rows: T[],
) => rows.find((row) => isOwnOption(revision, row))!;
