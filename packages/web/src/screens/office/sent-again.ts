import {
  formats,
  lineOf,
  messages,
  type RevisionChange,
  type RevisionSummary,
} from "@empire-cleaning/models";

const { formatList, plural } = formats.en;
const { planDays } = messages.en;

// what a send changed, as words in a sentence, each the Draft's name for it
const changeWords: Record<RevisionChange, string> = {
  service: "service",
  price: "price",
  offeredPrice: "price",
  time: "time",
  weekdays: "weekdays",
  cleaners: "cleaners",
  extras: "extras",
  area: "area",
  condition: "condition",
  deposit: "deposit",
  planDiscount: "plan discount",
  recurrence: "how often",
  validity: "how long it's valid",
};

// a Quote's History entry for a send after the first, naming what it
// changed, so two sends that read alike tell apart (#548): "Quote sent
// again · cleaners changed", "· nothing changed" when sent as it was, and
// "· Deep Clean price changed" when the Service offered beside its own got
// dearer or cheaper
export const sentAgain = (
  revision: Pick<RevisionSummary, "changed" | "offeredServiceName">,
) => {
  const changed = (revision.changed ?? []).map((c) =>
    c === "offeredPrice"
      ? `${revision.offeredServiceName} ${changeWords[c]}`
      : changeWords[c],
  );
  return lineOf([
    "Quote sent again",
    `${changed.length > 0 ? formatList(changed) : "nothing"} changed`,
  ]);
};

const cleaners = (n: number) =>
  `${n} ${plural(n, { one: "cleaner", other: "cleaners" })}`;

// the crew a send went with, on its History line beside its price and time,
// so a send that changed only its cleaners shows its before and after:
// "2 cleaners", or a plan's whose weekdays differ, each crew with its days,
// "2 cleaners on Mondays and 1 cleaner on Wednesdays"
export const sentWith = (crew: RevisionSummary["crew"]) => {
  const kinds = new Map<number, string[]>();
  for (const d of crew)
    kinds.set(d.crewSize, [...(kinds.get(d.crewSize) ?? []), d.startsAt]);
  const sizes = [...kinds.keys()];
  return sizes.length === 1
    ? cleaners(sizes[0]!)
    : formatList(
        sizes.map((n) => `${cleaners(n)} on ${planDays(kinds.get(n)!)}`),
      );
};
