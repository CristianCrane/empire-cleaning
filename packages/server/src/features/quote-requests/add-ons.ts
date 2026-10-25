import { inArray } from "drizzle-orm";
import type { AddOnChoice } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { quoteRequestAddOns } from "./quote-requests.schema.ts";

// the Add-ons each request chose, in the Price List's order, named from the
// current Price List (retired Add-ons keep their names there)
export const addOnsForRequests = async (requestIds: string[]) => {
  const byRequest = new Map<string, AddOnChoice[]>(
    requestIds.map((id) => [id, []]),
  );
  if (requestIds.length === 0) return byRequest;

  const [chosen, list] = await Promise.all([
    db
      .select()
      .from(quoteRequestAddOns)
      .where(inArray(quoteRequestAddOns.quoteRequestId, requestIds)),
    currentPriceList(),
  ]);
  const order = new Map(list.addOns.map((a, i) => [a.key, i]));
  const names = new Map(list.addOns.map((a) => [a.key, a.name]));

  for (const { quoteRequestId, addOnKey } of chosen) {
    byRequest
      .get(quoteRequestId)!
      .push({ key: addOnKey, name: names.get(addOnKey) ?? "Add-on" });
  }
  for (const choices of byRequest.values()) {
    choices.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  }
  return byRequest;
};
