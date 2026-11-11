import { inArray } from "drizzle-orm";
import type {
  AddOnChoice,
  CompletionReport,
  PriceBreakdown,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { catalog } from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { ConflictError } from "../../middleware/errors.ts";
import { offeredWith } from "../price-list/price-list.ts";
import {
  priceListAddOns,
  type PriceListAddOnRow,
} from "../price-list/price-list.schema.ts";
import { services } from "../services/services.schema.ts";
import { addOnCents, taxOnPart } from "../price-list/suggested-price.ts";
import { jobQuotes } from "../quotes/job-quotes.ts";
import type { PricedAddOn } from "../quotes/quotes.schema.ts";

// What a Job was quoted at, with the figures its Adjustments are priced from:
// the Service its Client accepted on the Quote that booked it, and the
// Price List version that Quote used (ADR-0009). Tax included.
export type QuotedJob = {
  // the Service its Client accepted, by key
  serviceKey: string;
  totalCents: number;
  suggested: PriceBreakdown;
  // what each of its Add-ons added to its price, which one not done takes off
  addOns: PricedAddOn[];
  priceListId: string;
  // a Service Plan Job's Plan Discount, off its one-off price; null for a
  // one-off Job
  planDiscountPercent: number | null;
};

// A Service Plan's Job is quoted at its discounted price. An increase is at
// the full hourly rate, with no Plan Discount; a quoted Add-on not done comes
// off at what it added, after the Plan Discount. Both are taxed as a Service
// Plan Job, at the plan rate of the Service version its Quote priced it with.
// By Job; one with no Quote to price it from isn't there.
export const quotedJobs = async (
  jobIds: string[],
  tx: Tx | typeof db = db,
): Promise<Map<string, QuotedJob>> => {
  const rows = await jobQuotes(jobIds, tx);
  const planServices = [
    ...new Set(
      rows
        .filter((r) => r.quote.kind === "service_plan")
        .map((r) => r.option.serviceId),
    ),
  ];
  const rates =
    planServices.length === 0
      ? []
      : await tx
          .select({
            id: services.id,
            plan: services.taxPlanPercent,
            oneOff: services.taxOneOffPercent,
          })
          .from(services)
          .where(inArray(services.id, planServices));
  return new Map(
    rows.map(({ jobId, quote, revision, option }) => {
      let { suggested } = option;
      if (quote.kind === "service_plan") {
        const service = rates.find((r) => r.id === option.serviceId)!;
        suggested = {
          ...suggested,
          taxPercent: service.plan ?? service.oneOff,
        };
      }
      return [
        jobId,
        {
          serviceKey: option.serviceKey,
          totalCents: option.totalCents,
          suggested,
          addOns: option.addOns,
          priceListId: revision.priceListId,
          planDiscountPercent:
            quote.kind === "service_plan" ? revision.planDiscountPercent : null,
        },
      ];
    }),
  );
};

// what a Cleaner reporting extras is told, in the request's language, tú in
// Spanish (ADR-0025)
const words = catalog({
  en: {
    ONCE: "Report each extra once.",
    NOT_ON_JOB: "That extra isn't on this job.",
    CANT_ADD: "That extra can't be added to this job.",
  },
  es: {
    ONCE: "Indica cada adicional una sola vez.",
    NOT_ON_JOB: "Ese adicional no está en este trabajo.",
    CANT_ADD: "Ese adicional no se puede agregar a este trabajo.",
  },
});

// a Job to be priced from a Quote it hasn't got
export const NO_QUOTE = "This job has no quote to price it from.";

export const quotedJob = async (
  jobId: string,
  tx: Tx | typeof db = db,
): Promise<QuotedJob> => {
  const quoted = (await quotedJobs([jobId], tx)).get(jobId);
  if (!quoted) throw new ConflictError(NO_QUOTE);
  return quoted;
};

// the Price List versions' Add-ons, each in its order
export const addOnsOfVersions = (priceListIds: string[]) =>
  priceListIds.length === 0
    ? Promise.resolve([])
    : db
        .select()
        .from(priceListAddOns)
        .where(inArray(priceListAddOns.priceListId, priceListIds))
        .orderBy(priceListAddOns.position);

// what can be reported at completion: the Quote's own Add-ons, as not done,
// and the others from its Price List version on offer with its Service, as
// done (`addOns`: its version's, or more versions' with it), each named
// by `nameOf` (addOnNamesIn: the reply's language)
export const reportableAddOns = (
  quoted: QuotedJob,
  addOns: PriceListAddOnRow[],
  nameOf: (addOn: { key: string; name: string }) => string,
): { quoted: AddOnChoice[]; others: AddOnChoice[] } => {
  const onQuote = new Set(quoted.suggested.addOns.map((a) => a.key));
  const choice = (a: { key: string; name: string }) => ({
    key: a.key,
    name: nameOf(a),
  });
  return {
    quoted: quoted.suggested.addOns.map(choice),
    others: addOns
      .filter(
        (a) =>
          a.priceListId === quoted.priceListId &&
          offeredWith(a, quoted.serviceKey) &&
          !onQuote.has(a.key),
      )
      .map(choice),
  };
};

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
  // at the rate the Job's Quote used
  const taxCents = taxOnPart(priceCents, taxExempt, suggested.taxPercent);
  const sign = isReduction(kind) ? -1 : 1;
  return {
    priceCents: sign * priceCents,
    taxCents: sign * taxCents,
    totalCents: sign * (priceCents + taxCents),
  };
};

/**
 * Prices what the assigned Staff reported, from the figures the Job's Quote
 * was priced with: a quoted Add-on not done at what it added to the price,
 * and an Add-on done or the extra Labour Hours at its hourly rate. Staff
 * never set amounts (ADR-0009). Refuses an Add-on that isn't reportable that
 * way, or one reported twice.
 */
export const priceReports = async (
  quoted: QuotedJob,
  reports: CompletionReport[],
): Promise<PricedReport[]> => {
  const { suggested } = quoted;
  const all = await addOnsOfVersions([quoted.priceListId]);
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
      throw new ConflictError(words[currentLanguage()].ONCE);
    }
    seen.add(report.addOnKey);
    const onQuote = suggested.addOns.find((a) => a.key === report.addOnKey);
    const addOn =
      report.kind === "add_on_not_done"
        ? onQuote
        : onQuote
          ? undefined
          : all.find(
              (a) =>
                a.key === report.addOnKey && offeredWith(a, quoted.serviceKey),
            );
    if (!addOn) {
      const w = words[currentLanguage()];
      throw new ConflictError(
        report.kind === "add_on_not_done" ? w.NOT_ON_JOB : w.CANT_ADD,
      );
    }
    return {
      addOnKey: addOn.key,
      addOnName: addOn.name,
      hours: null,
      taxExempt: addOn.taxExempt,
      workedOutCents:
        report.kind === "add_on_not_done"
          ? quoted.addOns.find((a) => a.key === addOn.key)!.priceCents
          : addOnCents(addOn.hours, suggested.hourlyRateCents),
    };
  });
};
