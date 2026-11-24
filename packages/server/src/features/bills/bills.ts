import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  or,
} from "drizzle-orm";
import { currentLanguage } from "#services/request";
import type {
  BillPayOutcome,
  BillSummary,
  BillView,
  ClientBillingInput,
  ClientBillingSaved,
  SettledJobView,
} from "@empire-cleaning/models";
import {
  because,
  addDays,
  clientPayingBill,
  DAY_MS,
  dayOf,
  mondayOf,
  startOfDay,
  timeOf,
  catalog,
  firstNameOf,
  formats,
  messages,
  paymentNotDone,
  type Language,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import env from "../../env.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock } from "../../services/clock/index.ts";
import { email, notify } from "../../services/email/index.ts";
import type { CallingOff } from "../../services/payment-gateway/index.ts";
import {
  billEmail,
  chargedPerCleanEmail,
  creditRefundedEmail,
  jobNamed,
  lineLabel,
  type LineToSay,
  type Occasion,
  type PlanNote,
  type SettledJob,
} from "./emails.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { officeClientView } from "../clients/clients.ts";
import { counts, paymentOf, settleAfterChange } from "../completion/balance.ts";
import { holds, payingOn, standing, type PayingOn } from "./standing.ts";
import {
  adjustments,
  reportedChange,
} from "../completion/completion.schema.ts";
import { NO_QUOTE } from "../completion/pricing.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { REMINDER_TIME } from "../jobs/reminders.ts";
import {
  attemptsFor,
  chargeOpen,
  chargeSaved,
  NOT_APPROVED,
  recordTakenEarlier,
  refundFrom,
  WAITING_ON_PROVIDER,
  waitOf,
} from "../payments/money.ts";
import { cardIn } from "../payments/payments.ts";
import {
  charges,
  paymentMethods,
  refunds,
} from "../payments/payments.schema.ts";
import { LATE, nowTheirs, unpaidKind, whyNotPaid } from "../payments/unpaid.ts";
import { properties } from "../properties/properties.schema.ts";
import { currentPriceList, namedByKey } from "../price-list/price-list.ts";
import { changedOf } from "../completion/emails.ts";
import { jobQuotes } from "../quotes/job-quotes.ts";
import { holdOrResumePlan } from "../service-plans/on-hold.ts";
import {
  servicePlans,
  servicePlanVisits,
} from "../service-plans/service-plans.schema.ts";
import {
  billLinesOf,
  billNumber,
  isBilledWeekly,
  owesOnBill,
} from "./billed-weekly.ts";
import { billLines, bills, type Bill, type BillLine } from "./bills.schema.ts";
import { cleanOf } from "../services/services.ts";
import { log, monitoring } from "../../services/monitoring/index.ts";

// a credit no Bill follows within this long is refunded (ADR-0016)
const CREDIT_REFUND_DAYS = 30;
// a Bill paid on its page is first reminded this many days before it's due
const BILL_REMINDER_DAYS = 3;

// ---- what a Bill bills ----

// one thing billed for a Job, tax included, by the key its lines carry,
// with what its words are made from: a fee's Job status, a price change
type Part = Pick<BillLine, "key" | "fee" | "change"> & {
  amountCents: number;
  taxCents: number;
};

// tax in part of a Job's price, at the share of tax in the whole
const taxShare = (
  cents: number,
  option: { totalCents: number; taxCents: number },
) =>
  option.totalCents === 0
    ? 0
    : Math.round((cents * option.taxCents) / option.totalCents);

/**
 * Everything a Job should have billed in all, as parts: once Completed, its
 * price, the Adjustments that count and any Late Reschedule fee; once
 * Cancelled or No Access with a fee, that fee. Either way less its Deposit
 * and anything already charged for it on its own, as before weekly billing
 * was switched on. A Job that owes nothing a Bill bills, as when its
 * completion was undone, should have billed nothing.
 */
const partsOf = async (job: Job, tx: Tx | typeof db): Promise<Part[]> => {
  if (!owesOnBill(job)) return [];
  // one after the other, as a transaction's queries share one connection
  // (ADR-0024)
  const [quoted] = await jobQuotes([job.id], tx);
  const rows = await tx
    .select()
    .from(adjustments)
    .where(eq(adjustments.jobId, job.id));
  const taken = await tx
    .select()
    .from(charges)
    .where(eq(charges.jobId, job.id));
  if (!quoted) throw new ConflictError(NO_QUOTE);
  const given =
    taken.length === 0
      ? []
      : await tx
          .select()
          .from(refunds)
          .where(
            and(
              inArray(
                refunds.chargeId,
                taken.map((c) => c.id),
              ),
              isNull(refunds.failedAt),
            ),
          );
  // a refund made in the provider's dashboard is a discount: it still counts
  // as taken, so it's never billed back
  const net = (kind: "deposit" | "other") =>
    taken
      .filter((c) => (c.kind === "deposit") === (kind === "deposit"))
      .reduce(
        (sum, c) =>
          sum +
          c.amountCents -
          given
            .filter((r) => r.chargeId === c.id && !r.atProvider)
            .reduce((s, r) => s + r.amountCents, 0),
        0,
      );

  const { option } = quoted;
  const none = { fee: null, change: null };
  const share = (key: string, cents: number): Part => ({
    key,
    ...none,
    amountCents: cents,
    taxCents: taxShare(cents, option),
  });

  const priced: Part[] = [
    {
      key: "price",
      ...none,
      amountCents: option.totalCents,
      taxCents: option.taxCents,
    },
    ...rows.filter(counts).map((a) => ({
      key: `adjustment:${a.id}`,
      fee: null,
      change: reportedChange(a),
      amountCents: a.totalCents,
      taxCents: a.taxCents,
    })),
  ];
  // Reductions take a price down to nothing, never below, as settling a Job
  // on its own has it (#241)
  const below = {
    amountCents: priced.reduce((sum, p) => sum + p.amountCents, 0),
    taxCents: priced.reduce((sum, p) => sum + p.taxCents, 0),
  };
  if (below.amountCents < 0) {
    priced.push({
      key: "floor",
      ...none,
      amountCents: -below.amountCents,
      taxCents: -below.taxCents,
    });
  }

  const parts: Part[] =
    job.status === "completed"
      ? [
          ...priced,
          ...(job.rescheduleFeeCents > 0
            ? [share("reschedule_fee", job.rescheduleFeeCents)]
            : []),
        ]
      : [
          {
            ...share("fee", job.feeCents ?? 0),
            fee: job.status as "cancelled" | "no_access",
          },
        ];
  const deposit = net("deposit");
  if (deposit !== 0) parts.push(share("deposit", -deposit));
  const paid = net("other");
  if (paid !== 0) parts.push(share("paid", -paid));
  return parts;
};

type NewLine = Omit<
  BillLine,
  "id" | "billId" | "position" | "createdAt" | "updatedAt"
>;

// What a Job's next Bill bills: each part less what Bills not voided have
// billed for it already (`before`, billLinesOf), so nothing is billed twice;
// whatever was billed and is no longer owed comes off, as a correction.
// Nothing for a Job never billed that nets to nothing, such as a fee its
// Deposit already covers.
const linesFor = async (
  job: Job,
  before: Awaited<ReturnType<typeof billLinesOf>>,
  tx: Tx | typeof db,
): Promise<NewLine[]> => {
  const parts = await partsOf(job, tx);
  const billed = new Map<string, Part>();
  for (const { line } of before) {
    const known = billed.get(line.key);
    billed.set(line.key, {
      key: line.key,
      fee: known?.fee ?? line.fee,
      change: known?.change ?? line.change,
      amountCents: (known?.amountCents ?? 0) + line.amountCents,
      taxCents: (known?.taxCents ?? 0) + line.taxCents,
    });
  }

  const lines: NewLine[] = [];
  const keys = new Set([...parts.map((p) => p.key), ...billed.keys()]);
  for (const key of keys) {
    const part = parts.find((p) => p.key === key);
    const was = billed.get(key);
    const amountCents = (part?.amountCents ?? 0) - (was?.amountCents ?? 0);
    if (amountCents === 0) continue;
    // a part no longer owed (an Adjustment taken off) is said as it was
    const said = part ?? was!;
    lines.push({
      jobId: job.id,
      key,
      corrected: was !== undefined,
      fee: said.fee,
      change: said.change,
      amountCents,
      taxCents: (part?.taxCents ?? 0) - (was?.taxCents ?? 0),
    });
  }
  if (
    before.length === 0 &&
    lines.reduce((s, l) => s + l.amountCents, 0) === 0
  ) {
    return [];
  }
  return lines;
};

// the credit a Client has from their latest Bill below zero, that no Bill
// has carried since and that hasn't all been refunded
const openCreditOf = async (clientId: string, tx: Tx | typeof db) => {
  const carriers = tx
    .select({ id: bills.creditFromBillId })
    .from(bills)
    .where(and(isNotNull(bills.creditFromBillId), ne(bills.status, "void")));
  const [credit] = await tx
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.clientId, clientId),
        lt(bills.totalCents, 0),
        ne(bills.status, "void"),
        isNull(bills.creditRefundedAt),
        notInArray(bills.id, carriers),
      ),
    )
    .orderBy(desc(bills.madeAt))
    .limit(1);
  return credit
    ? { bill: credit, cents: -credit.totalCents - credit.creditRefundedCents }
    : null;
};

/**
 * Makes a Client's Bill for the week from `weekStart` (a Monday), unless
 * they have one for it already, even voided: one per week, so making Bills
 * again makes nothing twice. It bills everything owed and not yet billed for
 * their Jobs, at all their Properties, from the week weekly billing was
 * switched on to the end of this one; anything settled since an earlier
 * Bill was made goes on this one, and a Job whose own payment is still going
 * through goes on the next. An open credit from an earlier Bill comes off
 * it. With nothing to bill, there's no Bill, and a credit waits.
 */
const makeBill = async (
  clientId: string,
  weekStart: string,
): Promise<string | null> =>
  db.transaction(async (tx) => {
    // held, so two runs at once make one Bill
    const [client] = await tx
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .for("update");
    if (!client?.billedWeeklyFrom || weekStart < client.billedWeeklyFrom) {
      return null;
    }
    const [made] = await tx
      .select({ id: bills.id })
      .from(bills)
      .where(and(eq(bills.clientId, clientId), eq(bills.weekStart, weekStart)));
    if (made) return null;

    // held while billed, in the order settling a Job holds it
    const candidates = await tx
      .select({ job: jobs, property: properties })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .where(
        and(
          eq(properties.clientId, clientId),
          gte(jobs.startsAt, startOfDay(client.billedWeeklyFrom)),
          lt(jobs.startsAt, startOfDay(addDays(weekStart, 7))),
        ),
      )
      .orderBy(asc(jobs.startsAt), asc(jobs.id))
      .for("update", { of: jobs });
    const lines: NewLine[] = [];
    for (const { job } of candidates) {
      // its own payment may still take the money (the one rule): it waits
      // for the next Bill, so the Client isn't asked for it twice at once
      if (await chargeOpen(job.id, tx)) continue;
      const before = await billLinesOf(job.id, tx);
      if (!isBilledWeekly(job, client, { lines: before.length })) continue;
      lines.push(...(await linesFor(job, before, tx)));
    }
    if (lines.length === 0) return null;

    const credit = await openCreditOf(clientId, tx);
    if (credit && credit.cents > 0) {
      lines.push({
        jobId: null,
        key: "credit",
        corrected: false,
        fee: null,
        change: null,
        amountCents: -credit.cents,
        taxCents: 0,
      });
    }

    const now = clock.now();
    const today = dayOf(now);
    const totalCents = lines.reduce((s, l) => s + l.amountCents, 0);
    const [bill] = await tx
      .insert(bills)
      .values({
        clientId,
        weekStart,
        madeAt: now,
        payment: client.billPayment,
        dueOn:
          client.billPayment === "on_page"
            ? addDays(today, client.billTermsDays)
            : today,
        totalCents,
        taxCents: lines.reduce((s, l) => s + l.taxCents, 0),
        creditFromBillId: credit && credit.cents > 0 ? credit.bill.id : null,
        // nothing to pay, as when it's a credit on the next
        ...(totalCents <= 0 && {
          status: "paid" as const,
          paidAt: now,
          paidVia: "nothing_due" as const,
        }),
      })
      .returning();
    await tx.insert(billLines).values(
      lines.map((line, position) => ({
        ...line,
        billId: bill!.id,
        position,
      })),
    );
    return bill!.id;
  });

// ---- paying ----

// the Service Plans with Jobs on a Bill, oldest first, each where it stands
// and at which home: On Hold while it's Unpaid, unless Ended
const plansOn = async (billId: string, tx: Tx | typeof db = db) =>
  tx
    .selectDistinct({
      id: servicePlans.id,
      status: servicePlans.status,
      startedAt: servicePlans.startedAt,
      property: {
        id: properties.id,
        street: properties.street,
        unit: properties.unit,
        postcode: properties.postcode,
      },
    })
    .from(billLines)
    .innerJoin(servicePlanVisits, eq(servicePlanVisits.jobId, billLines.jobId))
    .innerJoin(
      servicePlans,
      eq(servicePlans.id, servicePlanVisits.servicePlanId),
    )
    .innerJoin(properties, eq(properties.id, servicePlans.propertyId))
    .where(eq(billLines.billId, billId))
    .orderBy(asc(servicePlans.startedAt));

// puts the plans with Jobs on a Bill On Hold, or back on, as it now stands
const holdOrResumePlansOf = async (billId: string, tx: Tx) => {
  let held = false;
  let resumed = false;
  for (const { id: planId } of await plansOn(billId, tx)) {
    const changed = await holdOrResumePlan(tx, planId);
    held ||= changed === "held";
    resumed ||= changed === "resumed";
  }
  return held ? "held" : resumed ? "resumed" : null;
};

type Charged = {
  failure: string | null;
  becameUnpaid: boolean;
  plan: "held" | "resumed" | null;
};

/**
 * Charges a due Bill to its Client's saved Payment Method, off-session. If
 * it can't be (declined, no card saved, the provider unreachable), the Bill
 * is Unpaid, and so the Client's Service Plans with Jobs on it are On Hold,
 * until a later try takes it or it's paid another way. Null when it isn't
 * charged: nothing owed, a Bill paid on its page, or the Client paying it
 * there now (ADR-0022's one rule).
 */
const chargeBill = async (
  billId: string,
  {
    // the first try, as issuing it makes: none if another server made it
    // meanwhile, as seen once the Bill is held (#241)
    first = false,
    // whatever made it Unpaid, as after a new card; else only a payment we
    // try again ourselves (WAITING_ON_PROVIDER), so a card declined, or a
    // payment the Client made on its page that failed, isn't charged again
    // by the Clock (#534 critical review C4)
    anyReason = false,
  } = {},
): Promise<Charged | null> =>
  db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update");
    if (bill?.status !== "due" || bill.totalCents <= 0) return null;
    if (bill.payment === "on_page") return null;
    if (first && bill.chargeAttemptedAt) return null;
    if (
      !anyReason &&
      bill.unpaidReason !== null &&
      !WAITING_ON_PROVIDER.includes(bill.unpaidReason)
    ) {
      return null;
    }
    // the Client paying it on its page: theirs to finish, or settleBill's
    // (#534 critical review C1)
    if (
      (await attemptsFor("bill", [bill.id], tx)).some(
        (a) => a.open && a.call === "bill",
      )
    ) {
      return null;
    }
    const [owner] = await tx
      .select({ client: clients, method: paymentMethods })
      .from(clients)
      .leftJoin(paymentMethods, eq(paymentMethods.clientId, clients.id))
      .where(eq(clients.id, bill.clientId));
    const { client, method } = owner!;
    const now = clock.now();

    const charged = await chargeSaved(tx, {
      client,
      source: method,
      amount: bill.totalCents,
      description: `Empire Cleaning bill ${billNumber(bill.number)}`,
      for: { billId: bill.id, kind: "bill" },
    });
    const failure = charged.ok ? null : charged.reason;

    await tx
      .update(bills)
      .set({
        chargeAttemptedAt: bill.chargeAttemptedAt ?? now,
        ...(failure
          ? { unpaidSince: bill.unpaidSince ?? now, unpaidReason: failure }
          : {
              status: "paid" as const,
              paidAt: now,
              paidVia: "charge" as const,
              unpaidSince: null,
              unpaidReason: null,
            }),
      })
      .where(eq(bills.id, bill.id));
    const becameUnpaid =
      failure !== null &&
      nowTheirs(bill.unpaidSince ? (bill.unpaidReason ?? "") : null, failure);
    const plan = await holdOrResumePlansOf(bill.id, tx);
    return {
      failure,
      becameUnpaid,
      // a plan held already, as while the payment only waited on the
      // provider, is told now the payment is the Client's to put right
      plan:
        becameUnpaid &&
        !plan &&
        (await plansOn(bill.id, tx)).some((p) => p.status === "on_hold")
          ? ("held" as const)
          : plan,
    };
  });

/**
 * Sends a Bill just made to its Client, once: charged first if they're
 * charged automatically, so it goes as their receipt, or as the notice that
 * it couldn't be taken; otherwise to pay on its page by its due date.
 * Making Bills runs this again for any never sent, as after a crash.
 */
const issueBill = async (billId: string) => {
  const [bill] = await db.select().from(bills).where(eq(bills.id, billId));
  if (!bill || bill.sentAt) return;
  const charged =
    bill.payment === "automatic" && !bill.chargeAttemptedAt
      ? await chargeBill(billId, { first: true })
      : null;
  // claimed first, so two runs at once send it once
  const [claimed] = await db
    .update(bills)
    .set({ sentAt: clock.now() })
    .where(and(eq(bills.id, billId), isNull(bills.sentAt)))
    .returning();
  if (!claimed) return;
  try {
    await sendBill(
      billId,
      "made",
      charged?.plan === "held" ? { plan: "paused" } : {},
    );
  } catch (error) {
    monitoring.error(error, { what: `Bill ${billId} not sent` });
    await db.update(bills).set({ sentAt: null }).where(eq(bills.id, billId));
  }
};

/**
 * Makes each Monday's Bills, for the week before, for every Client billed
 * weekly, and sends them; sends any made but never sent; and refunds credits
 * no Bill has followed within 30 days. Safe to run as often as you like, and
 * on more than one server.
 */
export const makeDueBills = async () => {
  const lastWeek = addDays(mondayOf(dayOf(clock.now())), -7);
  const billed = await db
    .select({ id: clients.id })
    .from(clients)
    .where(lte(clients.billedWeeklyFrom, lastWeek));
  for (const { id } of billed) {
    try {
      await makeBill(id, lastWeek);
    } catch (error) {
      monitoring.error(error, { what: `Bill for Client ${id} not made` });
    }
  }
  const unsent = await db
    .select({ id: bills.id })
    .from(bills)
    .where(isNull(bills.sentAt))
    .orderBy(asc(bills.madeAt));
  // one that fails stops no other, and the next run tries it again
  for (const { id } of unsent) {
    try {
      await issueBill(id);
    } catch (error) {
      monitoring.error(error, { what: `Bill ${id} not issued` });
    }
  }
  await refundLapsedCredits();
};

/**
 * Charges a due Bill again, as after a new Payment Method (`anyReason`), or
 * a payment we try again ourselves (ADR-0022); one that still fails stays
 * Unpaid. A Bill it doesn't charge, as one paid on its page, or paid
 * another way meanwhile, or voided, has what its payments came to settled
 * (settleBill).
 */
export const retryBill = async (billId: string, { anyReason = false } = {}) => {
  const charged = await chargeBill(billId, { anyReason });
  if (!charged) {
    await settleBill(billId, "abandoned");
    return;
  }
  if (!charged.failure) await tellPaid(billId, charged.plan);
  // declined now, after the provider kept us waiting: told only now
  else if (charged.becameUnpaid) await tellUnpaid(billId, charged.plan);
};

// After a Client saves a new Payment Method, tries their Unpaid Bills again
// with it, as their Jobs are
export const retryUnpaidBillsFor = async (clientId: string) => {
  const unpaid = await db
    .select({ id: bills.id })
    .from(bills)
    .where(
      and(
        eq(bills.clientId, clientId),
        eq(bills.payment, "automatic"),
        eq(bills.status, "due"),
        isNotNull(bills.unpaidSince),
      ),
    );
  for (const { id } of unpaid) await retryBill(id, { anyReason: true });
};

// ---- on its page ----

// why the Client can't pay a Bill on its page now, or null when they can:
// a bank debit of theirs on its way, or a payment going through, or one we
// try again ourselves (ADR-0022); or nothing owed. One their bank asks
// them to approve they may start over, as that calls it off
const notPayable = (
  bill: Bill,
  on: PayingOn,
): "onItsWay" | "ours" | "nothingToPay" | null => {
  if (bill.status === "processing") return "onItsWay";
  if (bill.status !== "due" || bill.totalCents <= 0) return "nothingToPay";
  const waiting =
    bill.unpaidReason !== null && unpaidKind(bill.unpaidReason) === "waiting";
  return waiting || on.goingSince ? "ours" : null;
};

const clientBill = async (clientId: string, billId: string) => {
  const [bill] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.clientId, clientId)));
  if (!bill) throw new NotFoundError("Bill not found");
  return bill;
};

// what the API says to a Client paying a Bill, in the request's language
// (ADR-0025): each refusal what happened, then what to do
const payWords = catalog({
  en: {
    onItsWay: "Your bank payment for this bill is on its way.",
    ours: `This bill's payment is pending. ${messages.en.NOTHING_TO_DO}`,
    nothingToPay: "There's nothing to pay on this bill.",
    notThrough: (because: string) =>
      `Your payment didn't go through${because}, so nothing was taken. ${messages.en.PAY_AGAIN}`,
    notApproved: `The payment wasn't approved, so nothing was taken. ${messages.en.PAY_AGAIN}`,
  },
  es: {
    onItsWay: "Su pago bancario de esta factura ya está en camino.",
    ours: `El pago de esta factura está pendiente. ${messages.es.NOTHING_TO_DO}`,
    nothingToPay: "No hay nada que pagar en esta factura.",
    notThrough: (because: string) =>
      `Su pago no pasó${because}, así que no se cobró nada. ${messages.es.PAY_AGAIN}`,
    notApproved: `El pago no se aprobó, así que no se cobró nada. ${messages.es.PAY_AGAIN}`,
  },
});

// a payment on a Bill's page that took nothing, as the dialog says it: never
// approved, or why it didn't go through when that's known
const nothingTaken = (reason: string) => {
  const lang = currentLanguage();
  if (NOT_APPROVED(reason))
    return new ConflictError(payWords[lang].notApproved);
  const { why } = whyNotPaid(lang, reason);
  return new ConflictError(payWords[lang].notThrough(because(why)));
};

// a bank debit on a Bill's page on its way, from now: not due meanwhile, so
// its plans book again while it clears. Why it was Unpaid stays, for if it
// fails, so the Clock never charges a card that was declined (#534 critical
// review C4)
const clears = async (tx: Tx, billId: string) => {
  await tx
    .update(bills)
    .set({ status: "processing", clearingSince: clock.now() })
    .where(eq(bills.id, billId));
  await holdOrResumePlansOf(billId, tx);
};

/**
 * The Client pays a Bill on its page, with the card or US bank account they
 * entered (`token`), as a Charge attempt, so the one ledger reads and
 * finishes it and nothing else that moves money on the Bill starts
 * meanwhile (ADR-0022's one rule; #534). A payment of theirs their bank
 * still asks them to approve is called off first, as they're starting over,
 * and one that took money counts. Paid by card: a receipt. A bank debit: on
 * its way, the Bill processing until it clears. Their bank asking them to
 * approve it: `secret`, for the browser, then finishBillPayment. Not known
 * yet: going through, pending. Refused: why, as an error; nothing taken.
 */
export const payBillOnPage = async (
  client: Client,
  billId: string,
  token: string,
): Promise<BillPayOutcome> => {
  const lang = currentLanguage();
  const paid = await db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(and(eq(bills.id, billId), eq(bills.clientId, client.id)))
      .for("update");
    if (!bill) throw new NotFoundError("Bill not found");
    const not = notPayable(bill, (await payingOn([bill.id], tx))(bill.id));
    if (not) throw new ConflictError(payWords[lang][not]);

    const charged = await chargeSaved(tx, {
      client,
      source: { token, reference: bill.id },
      amount: bill.totalCents,
      description: `Empire Cleaning bill ${billNumber(bill.number)}`,
      for: { billId: bill.id, kind: "bill" },
      callOff: "client_retried",
    });
    if (charged.ok) {
      await tx
        .update(bills)
        .set({
          status: "paid",
          paidAt: clock.now(),
          paidVia: "page",
          clearingSince: null,
          unpaidSince: null,
          unpaidReason: null,
        })
        .where(eq(bills.id, bill.id));
      return {
        kind: "paid",
        plan: await holdOrResumePlansOf(bill.id, tx),
      } as const;
    }
    if ("secret" in charged) {
      return { kind: "approve", secret: charged.secret } as const;
    }
    // a bank debit on its way, which the attempt says (keep): a card
    // whose bank finishes it is going through, but not on its way
    const open = (await attemptsFor("bill", [bill.id], tx)).filter(
      (a) => a.open,
    );
    if (
      open.some((a) => a.call === "bill" && a.attempt.status === "processing")
    ) {
      await clears(tx, bill.id);
    }
    // still open, it may yet take the money: going through
    return open.length > 0
      ? ({ kind: "going" } as const)
      : ({ kind: "refused", reason: charged.reason } as const);
  });
  if (paid.kind === "approve") {
    return { status: "needs_approval", secret: paid.secret };
  }
  if (paid.kind === "refused") throw nothingTaken(paid.reason);
  if (paid.kind === "paid") await tellPaid(billId, paid.plan);
  return { status: "done", bill: await billView(billId, client.id) };
};

/**
 * The Client's browser, once their bank's check (3D Secure) on a payment on
 * a Bill's page is done: approved, it's read and recorded; not, it's called
 * off, as they've left it (ADR-0022). The Bill as it now stands, or what
 * the dialog says when nothing was taken, as an error.
 */
export const finishBillPayment = async (
  client: Client,
  billId: string,
  approved: boolean,
) => {
  await clientBill(client.id, billId);
  const ended = await settleBill(billId, approved ? null : "client_retried");
  if (ended?.failed) throw nothingTaken(ended.failed);
  return billView(billId, client.id);
};

/**
 * Settles what the payments on a Bill came to (ADR-0022), as the provider's
 * webhook, the Client's browser after their bank's check, the Clock, or
 * Office Staff about to cancel it or record a payment ask: each open
 * attempt is read, or called off as `callOff` says (approving), and what
 * one took is recorded. Enough taken pays a due Bill, or one whose bank
 * debit was on its way; taken for a Bill paid another way or cancelled,
 * it's given back. A bank debit started on its page makes it processing,
 * and one that failed makes it due again. A payment on its page the Client
 * left going through, which then failed, is emailed to them (#534 critical
 * review C3). Returns how the Client's latest payment on its page ended, if
 * it ended now: `failed`, why, or null when it was taken.
 */
export const settleBill = async (
  billId: string,
  callOff: CallingOff | null,
) => {
  const done = await db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update");
    if (!bill) return null;
    const all = await attemptsFor("bill", [billId], tx);
    const before = all.filter((a) => a.open);
    // a bank debit on its page that ended, while the Bill still reads
    // processing (the attempt's end is written apart from the transaction
    // that would have made it due): settled below. One processing from
    // before Bills were paid as attempts has none, and waits on its webhook
    const stale =
      bill.status === "processing" && all.some((a) => a.call === "bill");
    if (before.length === 0 && !stale) return null;
    const taken = await recordTakenEarlier(
      tx,
      { billId, kind: "bill" },
      null,
      callOff,
    );
    // read again: each attempt's end is written apart from this transaction
    const after = new Map(
      (await attemptsFor("bill", [billId], tx)).map((a) => [a.attempt.id, a]),
    );
    const ended = before
      .map((b) => ({ before: b, now: after.get(b.attempt.id)! }))
      .filter(({ now }) => !now.open);
    // the newest, as the Client last pressed Pay
    const page = ended.find(({ now }) => now.call === "bill")?.now.attempt;
    const endedNow = page
      ? { failed: page.status === "failed" ? (page.reason ?? "") : null }
      : null;
    // one they were told was going through, or left with their bank
    // finishing it, that failed: not one they saw refused in the dialog,
    // nor one never approved, nor called off as the Bill was paid
    // another way or cancelled
    const failed = ended.find(
      ({ before: b, now }) =>
        now.call === "bill" &&
        !waitOf(b.attempt).onClient &&
        now.attempt.status === "failed" &&
        !NOT_APPROVED(now.attempt.reason),
    )?.now.attempt.reason;

    if (!("unknown" in taken) && taken.length > 0) {
      if (bill.status === "paid" || bill.status === "void") {
        return { endedNow, next: { kind: "refund", taken } } as const;
      }
      const cents = taken.reduce((sum, c) => sum + c.amountCents, 0);
      if (cents >= bill.totalCents) {
        const onPage = taken.some((c) =>
          [...after.values()].some(
            (a) => a.call === "bill" && a.attempt.gatewayRef === c.gatewayRef,
          ),
        );
        await tx
          .update(bills)
          .set({
            status: "paid",
            paidAt: clock.now(),
            paidVia: onPage ? "page" : "charge",
            clearingSince: null,
            unpaidSince: null,
            unpaidReason: null,
          })
          .where(eq(bills.id, bill.id));
        const plan = await holdOrResumePlansOf(bill.id, tx);
        return { endedNow, next: { kind: "paid", plan } } as const;
      }
    }
    const going = [...after.values()].some(
      (a) => a.open && a.call === "bill" && a.attempt.status === "processing",
    );
    if (bill.status === "due" && going) await clears(tx, bill.id);
    let status = bill.status;
    if (bill.status === "processing" && !going) {
      await tx
        .update(bills)
        .set({ status: "due", clearingSince: null })
        .where(eq(bills.id, bill.id));
      await holdOrResumePlansOf(bill.id, tx);
      status = "due";
    }
    if (failed === undefined || status !== "due") {
      return { endedNow, next: null };
    }
    // its plans paused, as an Unpaid Bill pauses them
    const paused =
      bill.unpaidSince !== null &&
      (await plansOn(bill.id, tx)).some((p) => p.status === "on_hold");
    return {
      endedNow,
      next: { kind: "tell", reason: failed ?? "", paused },
    } as const;
  });

  const next = done?.next;
  if (next?.kind === "refund") {
    for (const charge of next.taken) {
      const refunded = await refundFrom(db, [charge], charge.amountCents, {
        for: charge.id,
      });
      if (refunded < charge.amountCents) {
        // refund_failed was raised; this says which Bill
        log.error(
          `a second payment for Bill ${billId} couldn't be refunded: refund it by hand`,
        );
      }
    }
  }
  if (next?.kind === "paid") await tellPaid(billId, next.plan);
  if (next?.kind === "tell") {
    await tellNotThrough(billId, next.reason, next.paused);
  }
  return done?.endedNow ?? null;
};

// ---- the Office ----

// why Office Staff can't act on a Bill that isn't due: `then` follows a bank
// payment still on its way
const notDue = (bill: Pick<Bill, "status">, then = "") =>
  bill.status === "processing"
    ? `A bank payment for this bill is on its way${then}.`
    : `This bill is already ${bill.status === "void" ? "cancelled" : "paid"}.`;

// why Office Staff can't cancel a due Bill, or record a payment on it, yet:
// a payment on it may still take the money (ADR-0022's one rule), ours to
// the saved card or the Client's on its page, or the Client's bank is
// asking them to approve theirs, until it's called off. Its page says so
// beforehand (canCancelOrRecord), so this answers a page opened before
const refuseWhilePaying = async (
  bill: Bill,
  what: "cancel" | "record",
  tx: Tx,
) => {
  const on = (await payingOn([bill.id], tx))(bill.id);
  if (on.approvingUntil) {
    const [client] = await tx
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.id, bill.clientId));
    throw new ConflictError(
      clientPayingBill[what](
        firstNameOf(client!.name),
        formats.en.formatTime(on.approvingUntil),
      ),
    );
  }
  // one going through, or one waited out that calling off couldn't reach
  // the provider to end, which may still take the money
  if (await chargeOpen(bill.id, tx)) {
    throw new ConflictError(paymentNotDone[what]);
  }
};

/**
 * Office Staff void a Bill that shouldn't have gone out, while it's unpaid:
 * it stays, as voided, and everything on it goes on the next Bill, or is
 * charged per Job if the Client is no longer billed weekly. Its plans come
 * off hold, and a credit it carried is open again.
 */
export const voidBill = async (
  billId: string,
  { byAccountId, reason }: { byAccountId: string; reason: string },
) => {
  // what its payments came to first: one that took it, or one past its wait
  // on the Client's bank, called off (ADR-0022's one rule)
  await settleBill(billId, "abandoned");
  const voided = await db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update");
    if (!bill) throw new NotFoundError("Bill not found");
    if (bill.status !== "due") {
      throw new ConflictError(notDue(bill, ", so it can't be cancelled"));
    }
    await refuseWhilePaying(bill, "cancel", tx);
    await tx
      .update(bills)
      .set({
        status: "void",
        voidedAt: clock.now(),
        voidedBy: byAccountId,
        voidReason: reason,
        unpaidSince: null,
        unpaidReason: null,
      })
      .where(eq(bills.id, billId));
    await holdOrResumePlansOf(billId, tx);
    return bill;
  });

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, voided.clientId));
  const settled = client!.billedWeeklyFrom
    ? []
    : await settleEach(await jobsOn(billId));
  await notify(`Voided notice for Bill ${billId}`, () =>
    sendBill(billId, "voided", { settled }),
  );
  return billView(billId);
};

const jobsOn = async (billId: string) =>
  (
    await db
      .selectDistinct({ jobId: billLines.jobId })
      .from(billLines)
      .where(and(eq(billLines.billId, billId), isNotNull(billLines.jobId)))
  ).map((r) => r.jobId!);

// Office Staff record a payment made another way, such as a cheque or bank
// transfer, with a note; it settles the Bill
export const recordOutsidePayment = async (
  billId: string,
  { byAccountId, note }: { byAccountId: string; note: string },
) => {
  // what its payments came to first, as voidBill
  await settleBill(billId, "abandoned");
  const plan = await db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update");
    if (!bill) throw new NotFoundError("Bill not found");
    if (bill.status !== "due") {
      throw new ConflictError(notDue(bill));
    }
    await refuseWhilePaying(bill, "record", tx);
    await tx
      .update(bills)
      .set({
        status: "paid",
        paidAt: clock.now(),
        paidVia: "outside",
        paymentNote: note,
        recordedBy: byAccountId,
        unpaidSince: null,
        unpaidReason: null,
      })
      .where(eq(bills.id, billId));
    return holdOrResumePlansOf(billId, tx);
  });
  await tellPaid(billId, plan);
  return billView(billId);
};

const commercial = async (clientId: string) => {
  const [found] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(eq(properties.clientId, clientId), eq(properties.kind, "commercial")),
    )
    .limit(1);
  return found !== undefined;
};

/**
 * Office Staff set how a Client is billed. Weekly billing is for a
 * commercial Client only, and applies from the current week: their Jobs
 * from its Monday on go on Bills, and any of them Unpaid now waits for the
 * Bill instead. Switched off, Bills already made stay due, and whatever is
 * owed and not yet billed is charged per Job, as before.
 */
export const setBilling = async (
  clientId: string,
  input: ClientBillingInput,
): Promise<ClientBillingSaved> => {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!client) throw new NotFoundError("Client not found");
  if (
    input.weekly &&
    !client.billedWeeklyFrom &&
    !(await commercial(clientId))
  ) {
    throw new ConflictError(
      "Only a client with a business can be billed weekly.",
    );
  }
  const from = input.weekly
    ? (client.billedWeeklyFrom ?? mondayOf(dayOf(clock.now())))
    : null;
  await db
    .update(clients)
    .set({
      billedWeeklyFrom: from,
      billPayment: input.payment,
      billTermsDays: input.termsDays,
      billingEmail: input.billingEmail?.trim().toLowerCase() || null,
    })
    .where(eq(clients.id, clientId));

  const was = client.billedWeeklyFrom;
  let settled: SettledJob[] = [];
  if (from !== was) {
    // switched on, its Unpaid Jobs this week wait for the Bill; switched
    // off, everything owed since is charged or refunded per Job
    const since = from ?? was!;
    const affected = await db
      .select({ id: jobs.id })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .where(
        and(
          eq(properties.clientId, clientId),
          gte(jobs.startsAt, startOfDay(since)),
          from ? isNotNull(jobs.unpaidSince) : undefined,
          from
            ? undefined
            : inArray(jobs.status, ["completed", "cancelled", "no_access"]),
        ),
      )
      .orderBy(asc(jobs.startsAt));
    if (from) {
      for (const { id } of affected) await settleAfterChange(id);
    } else {
      settled = await settleEach(affected.map((j) => j.id));
      if (settled.length > 0) {
        await notify(`Per-clean billing notice for Client ${clientId}`, () =>
          tellChargedPerClean(clientId, settled),
        );
      }
    }
  }
  return {
    client: (await officeClientView(clientId))!,
    settled: settled.map(toSettledView),
  };
};

// ---- settling per Job, once weekly billing no longer takes a Job ----

// Settles each Job on its own, in order, and keeps those whose money moved
// or couldn't be taken
const settleEach = async (jobIds: string[]) => {
  const moved: SettledJob[] = [];
  for (const jobId of jobIds) {
    const settled = await settleAfterChange(jobId);
    if (!settled.chargedCents && !settled.refundedCents && !settled.failure) {
      continue;
    }
    const [found] = await db
      .select({ job: jobs, property: properties })
      .from(jobs)
      .innerJoin(properties, eq(properties.id, jobs.propertyId))
      .where(eq(jobs.id, jobId));
    const { job, property } = found!;
    moved.push({
      jobId,
      clean: await cleanOf(job, property),
      fee:
        job.status === "cancelled" || job.status === "no_access"
          ? job.status
          : null,
      settled,
      unpaidCents: settled.failure ? (await paymentOf(job)).owedCents : null,
    });
  }
  return moved;
};

const toSettledView = (s: SettledJob): SettledJobView => ({
  jobId: s.jobId,
  label: jobNamed("en", s),
  chargedCents: s.settled.chargedCents,
  refundedCents: s.settled.refundedCents,
  unpaidCents: s.unpaidCents,
});

// tells the Client they're charged per clean again, and what that charged
// for what no Bill had taken yet
const tellChargedPerClean = async (clientId: string, settled: SettledJob[]) => {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId));
  await email.send({
    to: client!.billingEmail ?? client!.email,
    ...chargedPerCleanEmail(client!.preferredLanguage, {
      name: client!.name,
      settled,
    }),
  });
};

// ---- the Clock: credits ----

/**
 * Refunds each credit no Bill has followed within 30 days, from the
 * Client's latest Charges first. A refund that fails is tried again on the
 * next run.
 */
const refundLapsedCredits = async () => {
  const cutoff = new Date(clock.now().getTime() - CREDIT_REFUND_DAYS * DAY_MS);
  const lapsed = await db
    .selectDistinct({ clientId: bills.clientId })
    .from(bills)
    .where(
      and(
        lt(bills.totalCents, 0),
        ne(bills.status, "void"),
        isNull(bills.creditRefundedAt),
        lte(bills.madeAt, cutoff),
      ),
    );
  for (const { clientId } of lapsed) {
    const refunded = await refundCredit(clientId, cutoff).catch(
      (error: unknown) => {
        monitoring.error(error, {
          what: `credit for Client ${clientId} not refunded`,
        });
        return null;
      },
    );
    if (refunded) {
      await notify(`Credit refund notice for Bill ${refunded.billId}`, () =>
        tellCreditRefunded(refunded.billId, refunded.cents),
      );
    }
  }
};

const refundCredit = async (clientId: string, cutoff: Date) =>
  db.transaction(async (tx) => {
    // held, so making a Bill can't carry the credit while it's refunded
    await tx
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .for("update");
    const credit = await openCreditOf(clientId, tx);
    if (!credit || credit.bill.madeAt > cutoff) return null;

    // from what the Client's Bills took, as the credit is Bills' money: a
    // Job's own Charges, such as a Deposit, still pay for that Job (#241).
    // What isn't refunded now, the next run tries again.
    const theirs = await tx
      .select({ charge: charges })
      .from(charges)
      .innerJoin(bills, eq(bills.id, charges.billId))
      .where(eq(bills.clientId, clientId));
    const cents = await refundFrom(
      tx,
      theirs.map((t) => t.charge),
      credit.cents,
      { for: credit.bill.id, creditBillId: credit.bill.id },
    );
    if (cents === 0) return null;
    await tx
      .update(bills)
      .set({
        creditRefundedCents: credit.bill.creditRefundedCents + cents,
        ...(cents === credit.cents && { creditRefundedAt: clock.now() }),
      })
      .where(eq(bills.id, credit.bill.id));
    return { billId: credit.bill.id, cents };
  });

// ---- the Clock: reminders and late Bills ----

// The day of the latest reminder a Bill paid on its page is owed by `today`:
// 3 days before it's due, on the day, the day after (when it's Unpaid), then
// each week after the due date while it's unpaid; null before the first.
const reminderDayOf = (dueOn: string, today: string) => {
  if (today < addDays(dueOn, -BILL_REMINDER_DAYS)) return null;
  if (today < dueOn) return addDays(dueOn, -BILL_REMINDER_DAYS);
  if (today === dueOn) return dueOn;
  if (today < addDays(dueOn, 7)) return addDays(dueOn, 1);
  let day = addDays(dueOn, 7);
  while (addDays(day, 7) <= today) day = addDays(day, 7);
  return day;
};

// a Bill paid on its page with something still to pay, and no bank debit
// paying it on its way
const onPageToPay = () =>
  and(
    eq(bills.payment, "on_page"),
    eq(bills.status, "due"),
    gt(bills.totalCents, 0),
  );

/**
 * Makes each Bill paid on its page and not paid by its due date Unpaid,
 * from the day after, so the Client's Service Plans with Jobs on it are On
 * Hold until it's paid; then sends the reminders such Bills are owed. One
 * with a payment on it that may still take the money waits (ADR-0022's one
 * rule): its page says Payment pending, nothing to do, so it's neither
 * late nor chased till that's ended, and if it failed, it's late from the
 * day after its due date, as ever (#534's critical review C5). Safe to run
 * as often as you like, and on more than one server.
 *
 * Nothing calls this but the timer in src/scheduler.ts (and tests).
 */
export const chaseBills = async () => {
  const late = await db
    .select({ id: bills.id })
    .from(bills)
    .where(
      and(
        onPageToPay(),
        isNull(bills.unpaidSince),
        lt(bills.dueOn, dayOf(clock.now())),
      ),
    );
  for (const { id } of late) {
    try {
      await markLate(id);
    } catch (error) {
      monitoring.error(error, { what: `Bill ${id} not made Unpaid` });
    }
  }
  return sendBillReminders();
};

const markLate = (billId: string) =>
  db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update");
    if (bill?.status !== "due" || bill.unpaidSince) return;
    if (await chargeOpen(billId, tx)) return;
    await tx
      .update(bills)
      .set({
        unpaidSince: startOfDay(addDays(bill.dueOn, 1)),
        unpaidReason: LATE,
      })
      .where(eq(bills.id, billId));
    await holdOrResumePlansOf(billId, tx);
  });

/**
 * From 8am (New York), emails each reminder a Bill paid on its page is owed
 * (see reminderDayOf), once, while it's still to pay: none for a day on or
 * before the one the Bill itself went out, and after a gap only the latest.
 * Each is claimed before its email goes, and let go again if the email
 * fails, so the next run tries again.
 */
const sendBillReminders = async () => {
  const now = clock.now();
  if (timeOf(now) < REMINDER_TIME) return 0;
  const today = dayOf(now);
  const owed = await db
    .select()
    .from(bills)
    .where(
      and(
        onPageToPay(),
        isNotNull(bills.sentAt),
        lte(bills.dueOn, addDays(today, BILL_REMINDER_DAYS)),
      ),
    )
    .orderBy(asc(bills.dueOn));

  let sent = 0;
  for (const bill of owed) {
    const day = reminderDayOf(bill.dueOn, today)!;
    if (day <= dayOf(bill.sentAt!)) continue;
    if (bill.remindedOn && bill.remindedOn >= day) continue;
    // one going through waits, as markLate does
    if (await chargeOpen(bill.id)) continue;
    const [claimed] = await db
      .update(bills)
      .set({ remindedOn: day })
      .where(
        and(
          eq(bills.id, bill.id),
          onPageToPay(),
          or(isNull(bills.remindedOn), lt(bills.remindedOn, day)),
        ),
      )
      .returning();
    if (!claimed) continue;

    try {
      // its Jobs from Service Plans that haven't Ended
      const plans = (await plansOn(bill.id)).some((p) => p.status !== "ended");
      await sendBill(
        bill.id,
        "reminder",
        {
          plan: !plans
            ? null
            : claimed.unpaidSince
              ? "paused"
              : "pauses_if_late",
        },
        // the Office is copied once it's late, to chase it
        claimed.unpaidSince ? env.OFFICE_EMAIL : undefined,
      );
      sent += 1;
    } catch (error) {
      monitoring.error(error, {
        what: `reminder for Bill ${bill.id} not sent`,
      });
      await db
        .update(bills)
        .set({ remindedOn: bill.remindedOn })
        .where(and(eq(bills.id, bill.id), eq(bills.remindedOn, day)));
    }
  }
  return sent;
};

// ---- views ----

// a Bill as its pages and lists show it, where it stands as each says it
// (standing)
const toSummary = (
  bill: Bill,
  client: Pick<Client, "id" | "name" | "businessName">,
  on: PayingOn,
): BillSummary => {
  return {
    id: bill.id,
    number: billNumber(bill.number),
    client: {
      id: client.id,
      name: client.name,
      businessName: client.businessName,
    },
    weekStart: bill.weekStart,
    weekEnd: addDays(bill.weekStart, 6),
    madeAt: bill.madeAt.toISOString(),
    payment: bill.payment,
    dueOn: bill.dueOn,
    status: bill.status,
    totalCents: bill.totalCents,
    taxCents: bill.taxCents,
    ...standing(bill, on),
    // set whenever it's processing (the bills table's check)
    clearingSince:
      bill.status === "processing" ? bill.clearingSince!.toISOString() : null,
    paidAt: bill.paidAt?.toISOString() ?? null,
    paidVia: bill.paidVia,
  };
};

// A Bill's lines with what their words are made from (lineLabel): each
// Job as an email gives it, each price change's Add-on in both languages,
// and the Bill a credit is from
const linesToSay = async (bill: Bill) => {
  const lines = await db
    .select()
    .from(billLines)
    .where(eq(billLines.billId, bill.id))
    .orderBy(asc(billLines.position));
  const jobIds = [...new Set(lines.flatMap((l) => (l.jobId ? [l.jobId] : [])))];
  const [rows, list, [from]] = await Promise.all([
    jobIds.length === 0
      ? []
      : db
          .select({ job: jobs, property: properties })
          .from(jobs)
          .innerJoin(properties, eq(properties.id, jobs.propertyId))
          .where(inArray(jobs.id, jobIds)),
    currentPriceList(),
    bill.creditFromBillId
      ? db
          .select({ number: bills.number })
          .from(bills)
          .where(eq(bills.id, bill.creditFromBillId))
      : [],
  ]);
  const cleans = new Map(
    await Promise.all(
      rows.map(
        async ({ job, property }) =>
          [job.id, await cleanOf(job, property)] as const,
      ),
    ),
  );
  const named = namedByKey(list.addOns);
  return lines.map(
    (l): LineToSay & { jobId: string | null; taxCents: number } => ({
      jobId: l.jobId,
      key: l.key,
      corrected: l.corrected,
      fee: l.fee,
      change: l.change && changedOf(named, l.change),
      clean: l.jobId ? cleans.get(l.jobId)! : null,
      creditFrom: from ? billNumber(from.number) : null,
      amountCents: l.amountCents,
      taxCents: l.taxCents,
    }),
  );
};

const homesOf = async (clientId: string) => {
  const [homes] = await db
    .select({ n: count() })
    .from(properties)
    .where(eq(properties.clientId, clientId));
  return homes!.n;
};

// a Bill with its lines; the Office's own, or one of the Client's
export const billView = async (
  billId: string,
  clientId?: string,
): Promise<BillView> => {
  const [found] = await db
    .select({ bill: bills, client: clients })
    .from(bills)
    .innerJoin(clients, eq(clients.id, bills.clientId))
    .where(
      and(
        eq(bills.id, billId),
        clientId ? eq(bills.clientId, clientId) : undefined,
      ),
    );
  if (!found) throw new NotFoundError("Bill not found");
  const { bill, client } = found;
  const on = (await payingOn([bill.id]))(bill.id);
  const lines = await linesToSay(bill);
  // each clean's home for the Office; for the Client only when they have
  // more than one, as their rows say (docs/ux.md, Lists)
  const home = clientId ? (await homesOf(clientId)) > 1 : true;
  return {
    ...toSummary(bill, client, on),
    // worded in the reply's language: the Office's English, the Client's own
    lines: lines.map((l) => ({
      jobId: l.jobId,
      label: lineLabel(currentLanguage(), l, { home }),
      amountCents: l.amountCents,
      taxCents: l.taxCents,
    })),
    paymentNote: bill.paymentNote,
    voidedAt: bill.voidedAt?.toISOString() ?? null,
    voidReason: bill.voidReason,
    payable: notPayable(bill, on) === null,
    canCancelOrRecord: bill.status === "due" && !holds(on),
    plans: (await plansOn(bill.id)).map(({ startedAt: _, ...plan }) => plan),
  };
};

// Bills newest first: a Client's, or only Unpaid ones, or every one
export const listBills = async ({
  clientId,
  unpaid,
}: {
  clientId?: string;
  unpaid?: boolean;
}): Promise<BillSummary[]> => {
  const rows = await db
    .select({ bill: bills, client: clients })
    .from(bills)
    .innerJoin(clients, eq(clients.id, bills.clientId))
    .where(
      and(
        clientId ? eq(bills.clientId, clientId) : undefined,
        unpaid ? isNotNull(bills.unpaidSince) : undefined,
      ),
    )
    .orderBy(desc(bills.weekStart), desc(bills.number));
  const on = await payingOn(rows.map((r) => r.bill.id));
  return rows.map(({ bill, client }) => toSummary(bill, client, on(bill.id)));
};

// ---- emails ----

// The whole Bill, as an email to the billing email, or else the Client's:
// its number, week, due date, each line, tax and total, with why it's sent
// and a link to it in the portal
const sendBill = async (
  billId: string,
  occasion: Occasion,
  // what else it says, as billEmail takes it
  extra: {
    plan?: PlanNote | null;
    settled?: SettledJob[];
    failed?: string;
  } = {},
  // the Office's copy, in English (ADR-0025): sent after the Client's, and
  // one that fails is logged, so the Client's isn't sent again
  officeCopy?: string,
) => {
  const [found] = await db
    .select({ bill: bills, client: clients, method: paymentMethods })
    .from(bills)
    .innerJoin(clients, eq(clients.id, bills.clientId))
    .leftJoin(paymentMethods, eq(paymentMethods.clientId, clients.id))
    .where(eq(bills.id, billId));
  const { bill, client, method } = found!;
  const lines = await linesToSay(bill);
  const billIn = (lang: Language) =>
    billEmail(lang, {
      name: client.name,
      bill: {
        ...bill,
        number: billNumber(bill.number),
        unpaid: bill.unpaidSince ? unpaidKind(bill.unpaidReason ?? "") : null,
        lines,
      },
      occasion,
      ...extra,
      card: method && cardIn(method),
      today: dayOf(clock.now()),
      billedWeekly: client.billedWeeklyFrom !== null,
      creditRefundDays: CREDIT_REFUND_DAYS,
    });
  await email.send({
    to: client.billingEmail ?? client.email,
    ...billIn(client.preferredLanguage),
  });
  if (officeCopy) {
    await notify(`Office's copy of Bill ${billId}`, () =>
      email.send({ to: officeCopy, ...billIn("en") }),
    );
  }
};

const tellPaid = (billId: string, plan: "held" | "resumed" | null) =>
  notify(`Receipt for Bill ${billId}`, () =>
    sendBill(billId, "paid", plan === "resumed" ? { plan: "back_on" } : {}),
  );

const tellUnpaid = (billId: string, plan: "held" | "resumed" | null) =>
  notify(`Unpaid notice for Bill ${billId}`, () =>
    sendBill(billId, "unpaid", plan === "held" ? { plan: "paused" } : {}),
  );

// a payment on its page the Client left going through that then failed,
// and why (#534 critical review C3), with its plans if they're paused
const tellNotThrough = (billId: string, reason: string, paused: boolean) =>
  notify(`Not-through notice for Bill ${billId}`, () =>
    sendBill(billId, "not_through", {
      failed: reason,
      ...(paused ? { plan: "paused" as const } : {}),
    }),
  );

const tellCreditRefunded = async (billId: string, cents: number) => {
  const [found] = await db
    .select({ bill: bills, client: clients })
    .from(bills)
    .innerJoin(clients, eq(clients.id, bills.clientId))
    .where(eq(bills.id, billId));
  const { bill, client } = found!;
  await email.send({
    to: client.billingEmail ?? client.email,
    ...creditRefundedEmail(client.preferredLanguage, {
      name: client.name,
      billId,
      number: billNumber(bill.number),
      cents,
      creditRefundDays: CREDIT_REFUND_DAYS,
    }),
  });
};
