import { eq } from "drizzle-orm";
import type {
  AddOnChoice,
  CompletionReport,
  PriceBreakdown,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError } from "../../middleware/errors.ts";
import { priceListAddOns } from "../price-list/price-list.schema.ts";
import { services } from "../services/services.schema.ts";
import { addOnCents, taxOn } from "../price-list/suggested-price.ts";
import { jobQuotes } from "../quotes/job-quotes.ts";

// What a Job was quoted at, with the figures its Adjustments are priced from:
// the Service its Client accepted on the Quote that booked it, and the
// Price List version that Quote used (ADR-0009). Tax included.
export type QuotedJob = {
  totalCents: number;
  suggested: PriceBreakdown;
  priceListId: string;
};

// A Service Plan's Job is quoted at its discounted price; its Adjustments are
// at the full hourly rate, with no Plan Discount, but taxed as a Service Plan
// Job, at the plan rate of the Service version its Quote priced it with.
export const quotedJob = async (
  jobId: string,
  tx: Tx | typeof db = db,
): Promise<QuotedJob> => {
  const [row] = await jobQuotes([jobId], tx);
  if (!row) throw new ConflictError("This Job has no Quote to price it from");
  const { quote, revision, option } = row;
  let { suggested } = option;
  if (quote.kind === "service_plan") {
    const [service] = await tx
      .select({
        plan: services.taxPlanPercent,
        oneOff: services.taxOneOffPercent,
      })
      .from(services)
      .where(eq(services.id, option.serviceId));
    suggested = {
      ...suggested,
      taxPercent: service!.plan ?? service!.oneOff,
    };
  }
  return {
    totalCents: option.totalCents,
    suggested,
    priceListId: revision.priceListId,
  };
};

// the Price List version's Add-ons, in its order
const addOnsOfVersion = (priceListId: string) =>
  db
    .select()
    .from(priceListAddOns)
    .where(eq(priceListAddOns.priceListId, priceListId))
    .orderBy(priceListAddOns.position);

// what can be reported at completion: the Quote's own Add-ons, as not done,
// and the active others from its Price List version, as done
export const reportableAddOns = async (
  quoted: QuotedJob,
): Promise<{ quoted: AddOnChoice[]; others: AddOnChoice[] }> => {
  const onQuote = new Set(quoted.suggested.addOns.map((a) => a.key));
  const all = await addOnsOfVersion(quoted.priceListId);
  return {
    quoted: quoted.suggested.addOns.map(({ key, name }) => ({ key, name })),
    others: all
      .filter((a) => a.active && !onQuote.has(a.key))
      .map(({ key, name }) => ({ key, name })),
  };
};

// the tax on part of a Job's price, at the rate its Quote used
export const taxFor = (
  priceCents: number,
  taxExempt: boolean,
  suggested: PriceBreakdown,
) => (taxExempt ? 0 : taxOn(priceCents, { ...suggested, addOns: [] }));

export type PricedReport = {
  addOnKey: string | null;
  addOnName: string | null;
  hours: number | null;
  taxExempt: boolean;
  // before tax, and positive: a reduction's sign is applied by signed()
  workedOutCents: number;
};

export const isReduction = (kind: CompletionReport["kind"]) =>
  kind === "add_on_not_done";

// a price before tax as the signed amounts an Adjustment holds
export const signed = (
  kind: CompletionReport["kind"],
  priceCents: number,
  taxExempt: boolean,
  suggested: PriceBreakdown,
) => {
  const taxCents = taxFor(priceCents, taxExempt, suggested);
  const sign = isReduction(kind) ? -1 : 1;
  return {
    priceCents: sign * priceCents,
    taxCents: sign * taxCents,
    totalCents: sign * (priceCents + taxCents),
  };
};

/**
 * Prices what the assigned Staff reported, from the figures the Job's Quote
 * was priced with: an Add-on's hours, or the extra Labour Hours, at its
 * hourly rate. Staff never set amounts (ADR-0009). Refuses an Add-on that
 * isn't reportable that way, or one reported twice.
 */
export const priceReports = async (
  quoted: QuotedJob,
  reports: CompletionReport[],
): Promise<PricedReport[]> => {
  const { suggested } = quoted;
  const all = await addOnsOfVersion(quoted.priceListId);
  const seen = new Set<string>();

  return reports.map((report): PricedReport => {
    if (report.kind === "extra_time") {
      return {
        addOnKey: null,
        addOnName: null,
        hours: report.hours,
        taxExempt: false,
        workedOutCents: addOnCents(report.hours, suggested.hourlyRateCents),
      };
    }

    if (seen.has(report.addOnKey)) {
      throw new ConflictError("Report each Add-on once");
    }
    seen.add(report.addOnKey);
    const onQuote = suggested.addOns.find((a) => a.key === report.addOnKey);
    const addOn =
      report.kind === "add_on_not_done"
        ? onQuote
        : onQuote
          ? undefined
          : all.find((a) => a.key === report.addOnKey && a.active);
    if (!addOn) {
      throw new ConflictError(
        report.kind === "add_on_not_done"
          ? "That Add-on isn't on this Job"
          : "That Add-on can't be added to this Job",
      );
    }
    return {
      addOnKey: addOn.key,
      addOnName: addOn.name,
      hours: null,
      taxExempt: addOn.taxExempt,
      workedOutCents: addOnCents(addOn.hours, suggested.hourlyRateCents),
    };
  });
};
