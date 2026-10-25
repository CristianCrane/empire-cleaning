import type { AddOnChoice } from "@empire-cleaning/models";

// the Add-ons on offer now, by name: never prices, which are on the Quote.
// Without them (the API unreachable, none on offer) the form simply has no
// Add-ons section; asking for a Quote still works.
export const loadAddOns = async (apiUrl: string): Promise<AddOnChoice[]> => {
  try {
    const res = await fetch(`${apiUrl}/api/price-list/add-ons`, {
      credentials: "omit",
    });
    return res.ok ? ((await res.json()) as AddOnChoice[]) : [];
  } catch {
    return [];
  }
};
