import type { PremisesTypeChoice } from "@empire-cleaning/models";
import { loadList } from "./list.ts";

// the types of business premises on offer now, by name. Without them (the
// API unreachable) the form can't describe business premises, and says so.
export const loadPremisesTypes = (apiUrl: string) =>
  loadList<PremisesTypeChoice>(`${apiUrl}/api/price-list/premises-types`);
