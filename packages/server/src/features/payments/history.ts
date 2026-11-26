import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { ClientPayment, ClientPaymentKind } from "@empire-cleaning/models";
import {
  addDays,
  catalog,
  inLanguage,
  messages,
} from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { db } from "../../db/index.ts";
import { billNumber } from "../bills/billed-weekly.ts";
import { bills } from "../bills/bills.schema.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { clientHolds } from "../quotes/deposit-paying.ts";
import { pendingDeposits, quotes } from "../quotes/quotes.schema.ts";
import { servicePlans } from "../service-plans/service-plans.schema.ts";
import { addOnNamesIn } from "../price-list/price-list.ts";
import {
  currentServices,
  serviceNameOf,
  serviceOf,
} from "../services/services.ts";
import { attemptsFor } from "./money.ts";
import {
  charges,
  refunds,
  type Charge,
  type ChargeItem,
} from "./payments.schema.ts";

// what a payment's one change to a price did, after what was changed ("Inside
// the fridge", "1 more hour")
const howWords = catalog({
  en: {
    approved: (what: string) => what,
    corrected: (what: string) => `${what}, price corrected`,
    taken_off: (what: string) => `${what}, taken off`,
  },
  es: {
    approved: (what: string) => what,
    corrected: (what: string) => `${what}, precio corregido`,
    taken_off: (what: string) => `${what}, se quitó`,
  },
});

/**
 * Every payment between a Client and us, newest first, for their Payments
 * page: each Charge (a Job's Deposit, Balance and fees, a Service Plan's
 * Deposit, a Bill) and each refund from one. A Bill being paid by bank debit
 * shows while it clears, and one Office Staff recorded as paid another way
 * shows when it was paid. A Quote's Deposit taken, but given back as
 * nothing could be booked, has no Charge, as it was for no Job or plan: it
 * shows by its Quote, taken and given back (#534's UX design, Screen 4);
 * and so does one their bank is still finishing, pending, as a Bill's bank
 * debit does, as the money's left their bank (#534's UX review U3). A
 * Charge that failed moved no money, so it isn't here: what's owed is on
 * the page above it.
 */
export const paymentHistoryFor = async (
  clientId: string,
): Promise<ClientPayment[]> => {
  const [ownJobs, ownPlans, ownBills, ownQuotes] = await Promise.all([
    db
      .select({ job: jobs })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .where(eq(properties.clientId, clientId)),
    db
      .select({ id: servicePlans.id })
      .from(servicePlans)
      .innerJoin(properties, eq(properties.id, servicePlans.propertyId))
      .where(eq(properties.clientId, clientId)),
    db.select().from(bills).where(eq(bills.clientId, clientId)),
    db
      .select({
        id: quotes.id,
        kind: quotes.kind,
        serviceKey: quotes.serviceKey,
      })
      .from(quotes)
      .innerJoin(properties, eq(properties.id, quotes.propertyId))
      .where(eq(properties.clientId, clientId)),
  ]);
  const jobIds = ownJobs.map((r) => r.job.id);
  const planIds = ownPlans.map((p) => p.id);
  const billIds = ownBills.map((b) => b.id);

  const theirs = [
    jobIds.length > 0 && inArray(charges.jobId, jobIds),
    planIds.length > 0 && inArray(charges.servicePlanId, planIds),
    billIds.length > 0 && inArray(charges.billId, billIds),
  ].filter((c) => c !== false);
  const charged =
    theirs.length === 0
      ? []
      : await db
          .select()
          .from(charges)
          .where(or(...theirs))
          // newest first; two taken at one moment by the clock (a test's
          // stands still) by when each was recorded, as balance.ts orders them
          .orderBy(desc(charges.chargedAt), desc(charges.createdAt));
  const given =
    charged.length === 0
      ? []
      : await db
          .select()
          .from(refunds)
          .where(
            and(
              inArray(
                refunds.chargeId,
                charged.map((c) => c.id),
              ),
              // one that failed gave nothing back
              isNull(refunds.failedAt),
            ),
          );

  const names = new Map<string, string>();
  for (const { job } of ownJobs) {
    if (!names.has(job.serviceId)) {
      names.set(
        job.serviceId,
        await serviceNameOf(currentLanguage(), job.serviceId),
      );
    }
  }
  const jobOf = (jobId: string | null) => {
    const job = ownJobs.find((r) => r.job.id === jobId)?.job;
    return job
      ? {
          id: job.id,
          serviceName: names.get(job.serviceId)!,
          startsAt: job.startsAt.toISOString(),
          status: job.status,
        }
      : null;
  };
  const billOf = (billId: string | null) => {
    const bill = ownBills.find((b) => b.id === billId);
    return bill
      ? {
          id: bill.id,
          number: billNumber(bill.number),
          weekStart: bill.weekStart,
          weekEnd: addDays(bill.weekStart, 6),
        }
      : null;
  };
  const forWhat = (charge: Charge) => ({
    job: jobOf(charge.jobId),
    servicePlanId: charge.servicePlanId,
    bill: billOf(charge.billId),
    quote: null,
  });

  // a Quote's Deposit given back unbooked, with money in it (a 0%
  // Deposit's card saved took none), by the Service it was to book: its
  // pending Deposit's, else what it asked for, else the Quote's own (on
  // one asked before attempts kept it), as its pages read it
  // (depositPaying)
  const givenBack = (
    await attemptsFor(
      "deposit",
      ownQuotes.map((q) => q.id),
    )
  ).filter(
    ({ attempt }) => attempt.status === "given_back" && attempt.amountCents > 0,
  );
  const refs = givenBack.flatMap(({ attempt }) => attempt.gatewayRef ?? []);
  const pending =
    refs.length === 0
      ? []
      : await db
          .select({
            gatewayRef: pendingDeposits.gatewayRef,
            serviceKey: pendingDeposits.serviceKey,
          })
          .from(pendingDeposits)
          .where(inArray(pendingDeposits.gatewayRef, refs));
  // and one their bank is finishing, with money in it, by its pending
  // Deposit's Service, as its pages read it going through (depositPaying)
  const holds = await clientHolds(ownQuotes.map((q) => q.id));
  const going = ownQuotes.flatMap((q) => {
    const held = holds(q.id);
    return held && !held.onClient && held.attempt.amountCents > 0 ? held : [];
  });
  const services =
    givenBack.length + going.length === 0 ? [] : await currentServices();
  const quoteNamed = (
    quoteId: string,
    key: string | null,
  ): ClientPayment["quote"] => {
    const quote = ownQuotes.find((q) => q.id === quoteId)!;
    if (quote.kind === "service_plan")
      return { id: quote.id, serviceName: null };
    return {
      id: quote.id,
      serviceName: inLanguage(
        currentLanguage(),
        serviceOf(services, key ?? quote.serviceKey),
      ).name,
    };
  };
  const quoteOf = ({ attempt, offer }: (typeof givenBack)[number]) =>
    quoteNamed(
      attempt.forId,
      pending.find((p) => p.gatewayRef === attempt.gatewayRef)?.serviceKey ??
        offer?.serviceKey ??
        null,
    );

  // a Job's Balance taken after its first was for an increase approved later.
  // The charges come newest first, so its first is the last seen. Two
  // recorded in one transaction at one moment of the clock still tie, as
  // created_at is the transaction's start
  const firstBalance = new Map<string, Charge>();
  for (const c of charged) {
    if (c.kind === "balance" && c.jobId) firstBalance.set(c.jobId, c);
  }
  const kindOf = (c: Charge): ClientPaymentKind =>
    c.kind === "balance" && firstBalance.get(c.jobId!)?.id !== c.id
      ? "adjustment"
      : c.kind;

  // each one's change to a price, worded in the reply's language
  const lang = currentLanguage();
  const addOnName = await addOnNamesIn(lang);
  const said = (item: ChargeItem | null) =>
    item &&
    howWords[lang][item.how](
      messages[lang].adjustmentItem({
        ...item,
        addOnName:
          item.addOnName &&
          addOnName({ key: item.addOnKey, name: item.addOnName }),
      }),
    );

  const history: ClientPayment[] = [
    ...charged.map((c) => ({
      id: c.id,
      at: c.chargedAt.toISOString(),
      kind: kindOf(c),
      amountCents: c.amountCents,
      ...forWhat(c),
      clearing: false,
      item: said(c.item),
    })),
    ...given.map((r) => {
      const from = charged.find((c) => c.id === r.chargeId)!;
      return {
        id: r.id,
        at: r.refundedAt.toISOString(),
        kind: "refund" as const,
        amountCents: -r.amountCents,
        ...forWhat(from),
        clearing: false,
        item: said(r.item),
      };
    }),
    // taken when it was found taken, by the Clock; one their bank approved
    // is found taken only as it's given back (finalizeDeposit), so then.
    // The refund first, as newest, when both were at once
    ...givenBack.flatMap((row) => {
      const { attempt } = row;
      const of = {
        job: null,
        servicePlanId: null,
        bill: null,
        quote: quoteOf(row),
        clearing: false,
        item: null,
      };
      return [
        {
          id: `${attempt.id}-back`,
          at: attempt.givenBackAt!.toISOString(),
          kind: "refund" as const,
          amountCents: -attempt.amountCents,
          ...of,
        },
        {
          id: attempt.id,
          at: (attempt.endedAt ?? attempt.givenBackAt!).toISOString(),
          kind: "deposit" as const,
          amountCents: attempt.amountCents,
          ...of,
        },
      ];
    }),
    ...going.map(({ attempt, pending: row }) => ({
      id: attempt.id,
      at: attempt.askedAt.toISOString(),
      kind: "deposit" as const,
      amountCents: attempt.amountCents,
      job: null,
      servicePlanId: null,
      bill: null,
      quote: quoteNamed(attempt.forId, row.serviceKey),
      clearing: true,
      item: null,
    })),
    // what hasn't a Charge (yet): a bank debit clearing, or paid another way
    ...ownBills
      .filter(
        (b) =>
          b.status === "processing" ||
          (b.status === "paid" && b.paidVia === "outside"),
      )
      .map((b) => ({
        id: b.id,
        // paid, or processing, which always has clearing_since (the
        // bills table's check)
        at: (b.paidAt ?? b.clearingSince)!.toISOString(),
        kind: "bill" as const,
        amountCents: b.totalCents,
        job: null,
        servicePlanId: null,
        bill: billOf(b.id),
        quote: null,
        clearing: b.status === "processing",
        item: null,
      })),
  ];
  return history.sort((a, b) => b.at.localeCompare(a.at));
};
