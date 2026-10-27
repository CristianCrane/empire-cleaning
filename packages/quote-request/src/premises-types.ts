import type { PremisesTypeChoice } from "@empire-cleaning/models";

// the types of business premises on offer now, by name. Without them (the
// API unreachable) the form can't describe business premises, and says so.
export const loadPremisesTypes = async (
  apiUrl: string,
): Promise<PremisesTypeChoice[]> => {
  try {
    const res = await fetch(`${apiUrl}/api/price-list/premises-types`, {
      credentials: "omit",
    });
    return res.ok ? ((await res.json()) as PremisesTypeChoice[]) : [];
  } catch {
    return [];
  }
};
