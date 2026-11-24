import {
  dayOf,
  REVISION_CHANGES,
  weekdayOf,
  type RevisionChange,
} from "@empire-cleaning/models";
import type { Revision, RevisionOptionRow } from "./quotes.schema.ts";
import { ownOption } from "./quote-state.ts";

// a Sent Revision as the History compares it: its terms, its options, and
// the price it led with
export type SentRevision = {
  revision: Revision;
  options: RevisionOptionRow[];
  headline: { totalCents: number };
};

// a Sent Service Plan Revision's options, by the weekday of each one's first
// clean: sending times every weekday
const byWeekday = (options: RevisionOptionRow[]) =>
  new Map(options.map((o) => [weekdayOf(dayOf(o.startsAt!)), o]));

const addOnKeys = (o: RevisionOptionRow) =>
  o.addOns
    .map((a) => a.key)
    .sort()
    .join();

/**
 * What a Sent Revision changed of the one sent before it, in the order the
 * Office reads them: its terms, as the Draft names them, and its price.
 * Compared field by field, so two sends alike read "nothing changed", and a
 * price that moved with no term ("price", "offeredPrice") is the Price List's
 * between the two sends. A one-off Quote's options pair up by Service; a
 * Service Plan Quote's by weekday, and those on one weekday only are
 * "weekdays".
 */
export const revisionChanges = (
  before: SentRevision,
  after: SentRevision,
): RevisionChange[] => {
  const a = before.revision;
  const b = after.revision;
  const changed = new Set<RevisionChange>();
  const plan = b.recurrence !== null;
  // the options both have, before and after
  const pairs: [RevisionOptionRow, RevisionOptionRow][] = [];
  if (plan) {
    const was = byWeekday(before.options);
    const now = byWeekday(after.options);
    const weekdays = (m: Map<number, unknown>) =>
      [...m.keys()].sort((x, y) => x - y).join();
    if (weekdays(was) !== weekdays(now)) changed.add("weekdays");
    for (const [weekday, o] of now) {
      const old = was.get(weekday);
      if (old) pairs.push([old, o]);
    }
    if (pairs.some(([x, y]) => x.startsAt?.getTime() !== y.startsAt?.getTime()))
      changed.add("time");
  } else {
    for (const o of after.options) {
      const old = before.options.find((x) => x.serviceKey === o.serviceKey);
      if (old) pairs.push([old, o]);
    }
    if (a.proposedStartsAt?.getTime() !== b.proposedStartsAt?.getTime())
      changed.add("time");
  }
  if (a.serviceKey !== b.serviceKey) changed.add("service");
  if (before.headline.totalCents !== after.headline.totalCents)
    changed.add("price");
  else if (pairs.some(([x, y]) => x.totalCents !== y.totalCents))
    changed.add("offeredPrice");
  if (
    a.crewSize !== b.crewSize ||
    pairs.some(([x, y]) => x.crewSize !== y.crewSize)
  )
    changed.add("cleaners");
  // a one-off Quote's extras are its own Service's option's, whichever
  // Service that is; the other Service's follow them, less those that don't
  // go with it
  const own: [RevisionOptionRow, RevisionOptionRow][] = plan
    ? pairs
    : [[ownOption(a, before.options), ownOption(b, after.options)]];
  if (own.some(([x, y]) => addOnKeys(x) !== addOnKeys(y)))
    changed.add("extras");
  if (a.area !== b.area) changed.add("area");
  if (a.condition !== b.condition) changed.add("condition");
  if (a.depositPercent !== b.depositPercent) changed.add("deposit");
  if (a.planDiscountPercent !== b.planDiscountPercent)
    changed.add("planDiscount");
  if (a.recurrence !== b.recurrence) changed.add("recurrence");
  if (a.validityDays !== b.validityDays) changed.add("validity");
  return REVISION_CHANGES.filter((c) => changed.has(c));
};
