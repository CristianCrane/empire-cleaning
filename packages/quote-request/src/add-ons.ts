import type { AddOnChoice, Language } from "@empire-cleaning/models";
import { loadList } from "./list.ts";

// the Add-ons on offer now for a Service, by name: never prices, which are
// on the Quote. Without them (the API unreachable, none on offer) the form
// simply has no Add-ons section; asking for a Quote still works.
export const loadAddOns = (
  apiUrl: string,
  lang: Language,
  serviceKey: string,
) =>
  loadList<AddOnChoice>(
    `${apiUrl}/api/price-list/add-ons?service=${serviceKey}`,
    lang,
  );
