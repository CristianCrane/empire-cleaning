import { inArray } from "drizzle-orm";
import type { AddOnChoice, PriceList } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { quoteAddOns } from "./quotes.schema.ts";

// the Add-ons asked for on each Quote, in the Price List's order, named from
// `list`, the current Price List the caller has read (retired Add-ons keep
// their names there)
export const askedAddOns = async (
  quoteIds: string[],
  list: PriceList,
  tx: Tx | typeof db = db,
) => {
  const byQuote = new Map<string, AddOnChoice[]>(
    quoteIds.map((id) => [id, []]),
  );
  if (quoteIds.length === 0) return byQuote;

  const chosen = await tx
    .select()
    .from(quoteAddOns)
    .where(inArray(quoteAddOns.quoteId, quoteIds));
  const order = new Map(list.addOns.map((a, i) => [a.key, i]));
  const names = new Map(list.addOns.map((a) => [a.key, a.name]));

  for (const { quoteId, addOnKey } of chosen) {
    byQuote
      .get(quoteId)!
      .push({ key: addOnKey, name: names.get(addOnKey) ?? "Extra" });
  }
  for (const choices of byQuote.values()) {
    choices.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  }
  return byQuote;
};
