import { and, eq } from "drizzle-orm";
import type {
  AddOnChoice,
  CompletionReport,
  PriceBreakdown,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError } from "../../middleware/errors.ts";
import { priceListAddOns } from "../price-list/price-list.schema.ts";
import { addOnCents, taxOn } from "../price-list/suggested-price.ts";
import { quoteOptions, quotes } from "../quotes/quotes.schema.ts";

// What a Job was quoted at, with the figures its Adjustments are priced from:
// the Clean Type its Client accepted on the Quote that booked it, and the
// Price List version that Quote used (ADR-0009). Tax included.
export type QuotedJob = {
  totalCents: number;
  suggested: PriceBreakdown;
  priceListId: string;
};

export const quotedJob = async (
  jobId: string,
  tx: Tx | typeof db = db,
): Promise<QuotedJob> => {
  const [row] = await tx
    .select({ quote: quotes, option: quoteOptions })
    .from(quotes)
    .innerJoin(
      quoteOptions,
      and(
        eq(quoteOptions.quoteId, quotes.id),
        eq(quoteOptions.cleanType, quotes.acceptedCleanType),
      ),
    )
    .where(eq(quotes.jobId, jobId));
  // every Job is booked by accepting a Quote, until Service Plans (#14)
  if (!row) throw new ConflictError("This Job has no Quote to price it from");
  return {
    totalCents: row.option.totalCents,
    suggested: row.option.suggested,
    priceListId: row.quote.priceListId,
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
