import { inArray } from "drizzle-orm";
import type { AddOnChoice } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { quoteAddOns } from "./quotes.schema.ts";

// the Add-ons asked for on each Quote, in the Price List's order, named from
// the current Price List (retired Add-ons keep their names there)
export const askedAddOns = async (quoteIds: string[]) => {
  const byQuote = new Map<string, AddOnChoice[]>(
    quoteIds.map((id) => [id, []]),
  );
  if (quoteIds.length === 0) return byQuote;

  const [chosen, list] = await Promise.all([
    db.select().from(quoteAddOns).where(inArray(quoteAddOns.quoteId, quoteIds)),
    currentPriceList(),
  ]);
  const order = new Map(list.addOns.map((a, i) => [a.key, i]));
  const names = new Map(list.addOns.map((a) => [a.key, a.name]));

  for (const { quoteId, addOnKey } of chosen) {
    byQuote
      .get(quoteId)!
      .push({ key: addOnKey, name: names.get(addOnKey) ?? "Add-on" });
  }
  for (const choices of byQuote.values()) {
    choices.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  }
  return byQuote;
};
