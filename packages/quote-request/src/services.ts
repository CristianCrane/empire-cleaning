import type { OpenQuote, ServiceOffer } from "@empire-cleaning/models";

// the Services a Quote can be asked for now. Without them (the API
// unreachable) the form can't be filled in, and says so.
export const loadServices = async (apiUrl: string): Promise<ServiceOffer[]> => {
  try {
    const res = await fetch(`${apiUrl}/api/services/on-offer`, {
      credentials: "omit",
    });
    return res.ok ? ((await res.json()) as ServiceOffer[]) : [];
  } catch {
    return [];
  }
};

// whether a Service is offered for homes or business premises
export const offeredAt = (service: ServiceOffer, premises: boolean) =>
  service.offeredFor === "both" ||
  service.offeredFor === (premises ? "businesses" : "homes");

// What an open Quote holds at its Property, as the API decides it (holdsOf,
// ADR-0018): a one-off Quote, its Service's one-off; a Service Plan Quote,
// the Service Plan Quote; a Requested one, both, the second only if its
// Service can recur. A Service no longer on offer is taken not to.
const holdsOf = (
  services: ServiceOffer[],
  quote: Pick<OpenQuote, "kind" | "serviceKey">,
) => [
  ...(quote.kind === "service_plan" ? [] : [`one_off:${quote.serviceKey}`]),
  ...(quote.kind === "service_plan" ||
  (quote.kind === null &&
    services.find((s) => s.key === quote.serviceKey)?.canRecur)
    ? ["service_plan"]
    : []),
];

// whether asking for `serviceKey` at a Property would overlap a Quote open
// there, so the API would refuse it
export const isHeld = (
  services: ServiceOffer[],
  open: OpenQuote[],
  propertyId: string,
  serviceKey: string,
) => {
  const wanted = holdsOf(services, { kind: null, serviceKey });
  return open.some(
    (q) =>
      q.propertyId === propertyId &&
      holdsOf(services, q).some((h) => wanted.includes(h)),
  );
};
