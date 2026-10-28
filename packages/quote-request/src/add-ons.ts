import type { AddOnChoice } from "@empire-cleaning/models";

// the Add-ons on offer now for a Service, by name: never prices, which are
// on the Quote. Without them (the API unreachable, none on offer) the form
// simply has no Add-ons section; asking for a Quote still works.
export const loadAddOns = async (
  apiUrl: string,
  serviceKey: string,
): Promise<AddOnChoice[]> => {
  try {
    const res = await fetch(
      `${apiUrl}/api/price-list/add-ons?service=${serviceKey}`,
      { credentials: "omit" },
    );
    return res.ok ? ((await res.json()) as AddOnChoice[]) : [];
  } catch {
    return [];
  }
};
